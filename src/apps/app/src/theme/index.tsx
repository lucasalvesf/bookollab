import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform, StyleSheet, useColorScheme, type TextStyle } from 'react-native';

import { storage } from '@/auth/storage';

/**
 * Design tokens. Every color is semantic (what it is for, not what it looks like), so screens never
 * hard-code a hex value and both themes come for free. Text/background pairs are checked for WCAG AA
 * (4.5:1): see docs/visao-produto.md → Visual e navegação do app.
 */
const light = {
  background: '#F6F5FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEDF7',
  border: '#E2DFEE',
  borderStrong: '#CBC6DD',
  text: '#1B1830',
  textMuted: '#5F5A75',
  textSubtle: '#6A6481',
  brand: '#5B3DF5',
  brandText: '#FFFFFF',
  brandSoft: '#ECE8FF',
  brandSoftText: '#4527D9',
  accent: '#F5B83D',
  accentText: '#3B2600',
  danger: '#C8102E',
  dangerBg: '#FDECEE',
  success: '#0E7A4F',
  successBg: '#E7F6EE',
  warning: '#9A4A06',
  warningBg: '#FEF3E2',
  overlay: 'rgba(17, 14, 35, 0.55)',
  shadow: '#1B1830',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0F0D1A',
  surface: '#181527',
  surfaceAlt: '#221E35',
  border: '#2E2944',
  borderStrong: '#3F3959',
  text: '#F2F0FA',
  textMuted: '#B3ADC8',
  textSubtle: '#948EAD',
  brand: '#9C8BFF',
  brandText: '#120E2B',
  brandSoft: '#2A2350',
  brandSoftText: '#C9BFFF',
  accent: '#F5B83D',
  accentText: '#3B2600',
  danger: '#FF8A9A',
  dangerBg: '#3A1620',
  success: '#5FE3A6',
  successBg: '#10301F',
  warning: '#FBBF5A',
  warningBg: '#33240C',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

/** Brand gradient (auth screens, default community cover). Text on it is always white. */
export const brandGradient = ['#5B3DF5', '#9B3DF5', '#E0458F'] as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Font families loaded in the root layout. Weight → family is applied automatically by makeStyles. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  reading: 'Literata_400Regular',
  readingBold: 'Literata_600SemiBold',
};

/** Same constraint StyleSheet.create uses (RN 0.88 does not export it by name). */
type NamedStyles = Parameters<typeof StyleSheet.create>[0];

const WEIGHT_FAMILY: Record<string, string> = {
  '100': fonts.regular, '200': fonts.regular, '300': fonts.regular, '400': fonts.regular, normal: fonts.regular,
  '500': fonts.medium, '600': fonts.semibold, '700': fonts.bold, bold: fonts.bold, '800': fonts.extrabold, '900': fonts.extrabold,
};

export type ThemePreference = 'light' | 'dark' | 'system';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const PREF_KEY = 'bookollab.theme';
const ThemeContext = createContext<Theme | null>(null);

/** Light by default (product decision), with dark mode or "follow the system" as options. */
export function AppThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('light');

  useEffect(() => {
    void storage.get(PREF_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
    });
  }, []);

  const value = useMemo<Theme>(() => {
    const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return {
      scheme,
      colors: scheme === 'dark' ? dark : light,
      preference,
      setPreference: (p) => {
        setPref(p);
        void storage.set(PREF_KEY, p);
      },
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside AppThemeProvider');
  return theme;
}

/** Adds the Inter family matching each text style's weight (custom fonts need one family per weight on native). */
function withFonts<T extends Record<string, object>>(styles: T): T {
  for (const style of Object.values(styles) as { -readonly [K in keyof TextStyle]: TextStyle[K] }[]) {
    if ((style.fontSize === undefined && style.fontWeight === undefined) || style.fontFamily) continue;
    style.fontFamily = WEIGHT_FAMILY[String(style.fontWeight ?? '400')] ?? fonts.regular;
    // Android would synthesize bold on top of an already-bold family.
    if (Platform.OS === 'android') delete style.fontWeight;
  }
  return styles;
}

/**
 * Theme-aware StyleSheet: `const useStyles = makeStyles((colors) => ({ ... }))`, then
 * `const styles = useStyles()` in the component. Each theme's sheet is built once and cached.
 */
export function makeStyles<T extends NamedStyles>(
  factory: (colors: Palette, theme: Theme) => T & NamedStyles,
) {
  const cache = new WeakMap<Palette, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let sheet = cache.get(theme.colors);
    if (!sheet) {
      sheet = StyleSheet.create(withFonts(factory(theme.colors, theme) as Record<string, object>) as T);
      cache.set(theme.colors, sheet);
    }
    return sheet;
  };
}

/** Soft elevation that works on web, iOS and Android. */
export function shadow(colors: Palette, level: 1 | 2 | 3 = 1) {
  const d = { 1: [1, 3, 0.06, 1], 2: [4, 12, 0.08, 3], 3: [10, 30, 0.14, 8] }[level];
  return Platform.select({
    web: { boxShadow: `0 ${d[0]}px ${d[1]}px rgba(27, 24, 48, ${d[2] * 1.6})` },
    default: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: d[0] }, shadowRadius: d[1] / 2, shadowOpacity: d[2] * 2, elevation: d[3] },
  }) as object;
}
