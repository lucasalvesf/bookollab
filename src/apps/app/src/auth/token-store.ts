import type { components } from '@/api/schema';

import { storage } from './storage';

export type Tokens = components['schemas']['TokenResponse'];

const STORAGE_KEY = 'bookollab.session';

type Listener = (tokens: Tokens | null) => void;

let current: Tokens | null = null;
const listeners = new Set<Listener>();

/** In-memory session tokens, mirrored to persistent storage. Single source of truth for the API client. */
export const tokenStore = {
  get: () => current,

  async load(): Promise<Tokens | null> {
    const raw = await storage.get(STORAGE_KEY);
    current = raw ? (JSON.parse(raw) as Tokens) : null;
    return current;
  },

  async set(tokens: Tokens | null): Promise<void> {
    current = tokens;
    await storage.set(STORAGE_KEY, tokens ? JSON.stringify(tokens) : null);
    listeners.forEach((l) => l(tokens));
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
