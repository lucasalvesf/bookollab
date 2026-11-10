import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { fileUrl } from '@/lib/files';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Avatar, colorFor } from './avatar';
import { IconButton } from './ui';

/**
 * Profile hero (Amino-like): full-width cover, overlapping avatar, name, handle and badges.
 * Actions (edit, "⋯") sit on the cover, top right.
 */
export function ProfileHero({ name, handle, avatarKey, coverKey, badges, actions }: {
  name: string;
  handle: string;
  avatarKey?: string | null;
  coverKey?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  const styles = useStyles();
  const router = useRouter();
  const cover = fileUrl(coverKey);
  return (
    <View style={styles.hero}>
      <View style={[styles.cover, { backgroundColor: colorFor(handle) }]}>
        {cover ? <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" transition={200} /> : null}
        <View style={styles.coverBar}>
          <IconButton icon={ChevronLeft} label="Voltar" tone="onImage" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={styles.flex} />
          {actions}
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.avatarRing}>
          <Avatar name={name} imageKey={avatarKey} size={104} />
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          <Text style={styles.handle}>@{handle}</Text>
          {badges ? <View style={styles.badges}>{badges}</View> : null}
        </View>
      </View>
    </View>
  );
}

/** Row of counters (e.g. 3 fichas · 12 capítulos). Each one can jump to its tab. */
export function StatRow({ stats }: { stats: { label: string; value: number; onPress?: () => void }[] }) {
  const styles = useStyles();
  return (
    <View style={styles.stats}>
      {stats.map((s) => (
        <Pressable key={s.label} accessibilityRole={s.onPress ? 'button' : undefined} onPress={s.onPress} style={({ hovered }) => [styles.stat, hovered && s.onPress ? styles.statHover : null]}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Horizontal pill tabs (community sections, profile content). */
export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; icon: LucideIcon; count?: number }[]; value: T; onChange: (key: T) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(t.key)}
            style={({ hovered }) => [styles.tab, active && styles.tabActive, hovered && !active && styles.tabHover]}>
            <t.icon size={16} color={active ? colors.brandText : colors.textMuted} strokeWidth={2.2} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            {t.count !== undefined ? <Text style={[styles.tabCount, active && styles.tabTextActive]}>{t.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hero: { width: '100%' },
  cover: { width: '100%', height: 200, overflow: 'hidden' },
  coverBar: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 20, marginTop: -52, marginBottom: 8, flexWrap: 'wrap' },
  avatarRing: { borderRadius: 60, borderWidth: 5, borderColor: colors.background, backgroundColor: colors.background, ...shadow(colors, 2) },
  nameBlock: { flex: 1, minWidth: 180, marginTop: 60, gap: 2 },
  name: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  handle: { fontSize: 15, color: colors.textMuted },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statHover: { backgroundColor: colors.surfaceAlt },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.textSubtle },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabHover: { borderColor: colors.borderStrong },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandText },
  tabCount: { fontSize: 12, fontWeight: '700', color: colors.textSubtle },
}));
