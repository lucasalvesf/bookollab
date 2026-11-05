import createClient from 'openapi-fetch';

import type { paths } from './schema';

/** Base URL of the Bookollab API. Override with EXPO_PUBLIC_API_URL. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5087';

/** Typed API client. Types come from `npm run api:gen` (never edit schema.d.ts by hand). */
export const api = createClient<paths>({ baseUrl: API_URL });
