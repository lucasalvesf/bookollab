import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Literata_400Regular, Literata_600SemiBold } from '@expo-google-fonts/literata';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';

import { SessionProvider, useSession } from '@/auth/session';
import { AppThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AppThemeProvider>
          <NavigationTheme>
            <RootNavigator />
          </NavigationTheme>
        </AppThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/** Feeds our palette to the navigation container (screen backgrounds, transitions) and the status bar. */
function NavigationTheme({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  const value = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: colors.brand, background: colors.background, card: colors.surface, text: colors.text, border: colors.border } };
  }, [scheme, colors]);
  return (
    <ThemeProvider value={value}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Literata_400Regular,
    Literata_600SemiBold,
  });
  const ready = !isLoading && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

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
