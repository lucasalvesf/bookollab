import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Inbox, type LucideIcon } from 'lucide-react-native';
import { useEffect, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { IconButton, Notice } from './ui';

/**
 * Standard page of the logged-in area: scrollable centered column, header with optional back button.
 * Notifications live in the app shell (side rail / bottom bar), not in each page.
 */
export function Page({ title, subtitle, back, actions, hero, children }: PropsWithChildren<{
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: ReactNode;
  /** Full-width content above the column (e.g. a community cover). */
  hero?: ReactNode;
}>) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {hero}
      <View style={[styles.column, hero ? styles.columnAfterHero : null]}>
        {!hero ? (
          <View style={styles.header}>
            {back ? <IconButton icon={ChevronLeft} label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={38} /> : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {actions}
          </View>
        ) : null}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.body}>
          {children}
        </Animated.View>
      </View>
    </ScrollView>
  );
}

export function Section({ title, icon: Icon, right, children, plain }: PropsWithChildren<{ title: string; icon?: LucideIcon; right?: ReactNode; plain?: boolean }>) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {Icon ? <Icon size={18} color={colors.brand} strokeWidth={2.2} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {plain ? children : <View style={styles.card}>{children}</View>}
    </View>
  );
}

export function Row({ title, subtitle, left, icon: Icon, right, onPress }: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  /** Shortcut for a tinted icon on the left. */
  icon?: LucideIcon;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      {Icon ? (
        <View style={styles.rowIcon}>
          <Icon size={18} color={colors.brandSoftText} strokeWidth={2.2} />
        </View>
      ) : null}
      {left}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <ChevronRight size={18} color={colors.textSubtle} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed, hovered }) => [(hovered || pressed) && styles.rowActive]}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Empty({ children, icon: Icon = Inbox }: PropsWithChildren<{ icon?: LucideIcon }>) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={22} color={colors.textSubtle} strokeWidth={2} />
      </View>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

export type TagTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'live';

export function Tag({ label, tone = 'brand' }: { label: string; tone?: TagTone }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [bg, fg] = {
    neutral: [colors.surfaceAlt, colors.textMuted],
    brand: [colors.brandSoft, colors.brandSoftText],
    success: [colors.successBg, colors.success],
    warning: [colors.warningBg, colors.warning],
    danger: [colors.dangerBg, colors.danger],
    live: [colors.successBg, colors.success],
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {tone === 'live' ? <View style={[styles.liveDot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={styles.rowText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.rowSubtitle}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.brand, false: colors.borderStrong }} thumbColor="#FFFFFF" />
    </View>
  );
}

/** Pulsing placeholder block shown while content loads. */
export function Skeleton({ height = 16, width = '100%', round = false }: { height?: number; width?: number | `${number}%`; round?: boolean }) {
  const styles = useStyles();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.skeleton, { height, width, borderRadius: round ? height / 2 : radius.sm }, animated]} />;
}

function SkeletonRows() {
  const styles = useStyles();
  return (
    <View style={styles.skeletonRows} accessibilityLabel="Carregando">
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton height={40} width={40} round />
          <View style={styles.rowText}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="35%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Loading / error wrapper for react-query results. */
export function Loadable<T>({ query, children }: { query: { isPending: boolean; isError: boolean; error: Error | null; data: T | undefined }; children: (data: T) => ReactNode }) {
  if (query.isPending) return <SkeletonRows />;
  if (query.isError || query.data === undefined) return <Notice kind="error">{query.error?.message ?? 'Algo deu errado.'}</Notice>;
  return <Animated.View entering={FadeIn.duration(200)}>{children(query.data)}</Animated.View>;
}

const useStyles = makeStyles((colors) => ({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40, alignItems: 'center' },
  column: { width: '100%', maxWidth: 760, gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  columnAfterHero: { paddingTop: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  headerText: { flex: 1, minWidth: 180 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
  body: { gap: 24, marginTop: 8 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  sectionTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(colors, 1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowActive: { backgroundColor: colors.surfaceAlt },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 20 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 360 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 12, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  skeleton: { backgroundColor: colors.surfaceAlt },
  skeletonRows: { padding: 16, gap: 16 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));
