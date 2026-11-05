import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { api } from '@/api/client';

import { tokenStore, type Tokens } from './token-store';

type SessionContextValue = {
  session: Tokens | null;
  isLoading: boolean;
  signIn: (tokens: Tokens) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Tokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = tokenStore.subscribe(setSession);
    tokenStore
      .load()
      .then(setSession)
      .finally(() => setIsLoading(false));
    return unsubscribe;
  }, []);

  const signIn = (tokens: Tokens) => tokenStore.set(tokens);

  const signOut = async () => {
    const tokens = tokenStore.get();
    if (tokens) await api.POST('/auth/logout', { body: { refreshToken: tokens.refreshToken } }).catch(() => undefined);
    await tokenStore.set(null);
  };

  return <SessionContext value={{ session, isLoading, signIn, signOut }}>{children}</SessionContext>;
}
