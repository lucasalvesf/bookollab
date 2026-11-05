import createClient, { type Middleware } from 'openapi-fetch';

import { tokenStore, type Tokens } from '@/auth/token-store';

import type { paths } from './schema';

/** Base URL of the Bookollab API. Override with EXPO_PUBLIC_API_URL. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5087';

/** Typed API client. Types come from `npm run api:gen` (never edit schema.d.ts by hand). */
export const api = createClient<paths>({ baseUrl: API_URL });

// Refresh the access token shortly before it expires. Concurrent requests share one refresh.
const REFRESH_MARGIN_MS = 30_000;
let refreshing: Promise<Tokens | null> | null = null;

async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const tokens = response.ok ? ((await response.json()) as Tokens) : null;
  await tokenStore.set(tokens); // null = session ended
  return tokens;
}

/** Current access token, refreshed first if it is about to expire. Also used by the realtime connection. */
export async function validAccessToken(): Promise<string | null> {
  const tokens = tokenStore.get();
  if (!tokens) return null;
  if (new Date(tokens.accessTokenExpiresAt).getTime() - Date.now() > REFRESH_MARGIN_MS) return tokens.accessToken;
  refreshing ??= refreshTokens(tokens.refreshToken).finally(() => {
    refreshing = null;
  });
  return (await refreshing)?.accessToken ?? null;
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (new URL(request.url).pathname.startsWith('/auth/')) return request;
    const token = await validAccessToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ response }) {
    // Token rejected (e.g. revoked by a password reset): end the local session.
    if (response.status === 401 && tokenStore.get()) await tokenStore.set(null);
    return response;
  },
};
api.use(authMiddleware);

/** Shape of ProblemDetails / ValidationProblemDetails returned by the API. */
export type ApiProblem = {
  detail?: string | null;
  title?: string | null;
  code?: string;
  errors?: Record<string, string[]>;
};

/** First error message for a field (validation) or a general message. */
export function problemMessage(problem: unknown, field?: string): string | undefined {
  const p = problem as ApiProblem | undefined;
  if (!p) return undefined;
  if (field) return p.errors?.[field]?.[0];
  return p.detail ?? Object.values(p.errors ?? {})[0]?.[0] ?? p.title ?? undefined;
}
