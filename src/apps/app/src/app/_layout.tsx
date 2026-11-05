import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/auth/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Logged-in area */}
      <Stack.Protected guard={!!session} redirectTo="/entrar">
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      {/* Only for visitors */}
      <Stack.Protected guard={!session} redirectTo="/">
        <Stack.Screen name="entrar" />
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="esqueci-senha" />
      </Stack.Protected>

      {/* Opened from email links, logged in or not */}
      <Stack.Screen name="confirmar-email" />
      <Stack.Screen name="redefinir-senha" />
    </Stack>
  );
}
