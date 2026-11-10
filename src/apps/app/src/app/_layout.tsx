import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Literata_400Regular, Literata_600SemiBold } from '@expo-google-fonts/literata';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider, useSession } from '@/auth/session';
import { MenuProvider } from '@/components/menu';
import { AppThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <AppThemeProvider>
            <NavigationTheme>
              <RootNavigator />
            </NavigationTheme>
          </AppThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Feeds our palette to the navigation container (screen backgrounds, transitions) and the status bar. */
function NavigationTheme({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  const value = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: colors.brand, background: colors.background, card: colors.surface, text: colors.text, border: colors.border } };
  }, [scheme, colors]);
  // Web: visible, themed scrollbars (the browser default is invisible on some systems and clashes with dark mode).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let tag = document.getElementById('bookollab-scrollbars') as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'bookollab-scrollbars';
      document.head.appendChild(tag);
    }
    tag.textContent = `
      * { scrollbar-width: thin; scrollbar-color: ${colors.borderStrong} transparent; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background-color: ${colors.borderStrong}; border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
      ::-webkit-scrollbar-thumb:hover { background-color: ${colors.textSubtle}; }
    `;
  }, [colors]);
  return (
    <ThemeProvider value={value}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <MenuProvider>{children}</MenuProvider>
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
