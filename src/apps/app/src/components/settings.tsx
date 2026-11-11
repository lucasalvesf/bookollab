import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Search, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { makeStyles, radius, useTheme } from '@/theme';

import { Empty } from './layout';
import { IconButton } from './ui';

export type SettingsPage = {
  key: string;
  group: string;
  title: string;
  icon: LucideIcon;
  /** Extra words people may search for (e.g. "capa" finds Aparência). */
  keywords?: string;
  description?: string;
  badge?: number;
  render: () => ReactNode;
};

const WIDE = 860;

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Discord-like settings: grouped topics in a sidebar with search (wide), or a grouped list that opens
 * each topic (narrow). Esc / the close button leave the settings.
 */
export function SettingsLayout({ title, subtitle, pages, onClose, identity }: {
  title: string;
  subtitle?: string;
  pages: SettingsPage[];
  onClose?: () => void;
  /** Whose settings these are (e.g. the community: cover, icon and name stay visible). */
  identity?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<string | undefined>();
  const close = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const filtered = useMemo(() => {
    const q = normalize(term.trim());
    if (!q) return pages;
    return pages.filter((p) => normalize(`${p.title} ${p.group} ${p.keywords ?? ''} ${p.description ?? ''}`).includes(q));
  }, [pages, term]);
  const groups = useMemo(() => {
    const map = new Map<string, SettingsPage[]>();
    for (const p of filtered) map.set(p.group, [...(map.get(p.group) ?? []), p]);
    return [...map.entries()];
  }, [filtered]);

  const current = pages.find((p) => p.key === selected) ?? (wide ? filtered[0] ?? pages[0] : undefined);

  const searchBox = (
    <View style={styles.search}>
      <Search size={16} color={colors.textSubtle} />
      <TextInput
        value={term}
        onChangeText={setTerm}
        placeholder="Buscar configurações"
        placeholderTextColor={colors.textSubtle}
        style={styles.searchInput}
        accessibilityLabel="Buscar configurações"
      />
      {term ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setTerm('')} hitSlop={8}>
          <X size={14} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );

  const nav = (
    <>
      {groups.length === 0 ? <Empty icon={Search}>Nenhuma configuração encontrada para “{term}”.</Empty> : null}
      {groups.map(([group, items]) => (
        <View key={group} style={styles.group}>
          <Text style={styles.groupTitle}>{group}</Text>
          {items.map((p) => {
            const active = wide && current?.key === p.key;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(p.key)}
                style={({ hovered }) => [styles.navItem, !wide && styles.navItemNarrow, active && styles.navItemActive, hovered && !active && styles.navItemHover]}>
                <p.icon size={18} color={active ? colors.brandSoftText : colors.textMuted} strokeWidth={2.1} />
                <View style={styles.navText}>
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>{p.title}</Text>
                  {!wide && p.description ? <Text style={styles.navDescription} numberOfLines={1}>{p.description}</Text> : null}
                </View>
                {p.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{p.badge}</Text>
                  </View>
                ) : null}
                {!wide ? <ChevronRight size={18} color={colors.textSubtle} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );

  const content = current ? (
    <Animated.View key={current.key} entering={FadeIn.duration(160)} style={styles.page}>
      <Text style={styles.breadcrumb}>{`${current.group} › ${current.title}`}</Text>
      {current.description ? <Text style={styles.pageDescription}>{current.description}</Text> : null}
      <View style={styles.pageBody}>{current.render()}</View>
    </Animated.View>
  ) : null;

  if (wide) {
    return (
      <View style={styles.wide}>
        <View style={styles.sidebar}>
          {identity}
          <ScrollView contentContainerStyle={styles.sidebarContent}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            {searchBox}
            {nav}
          </ScrollView>
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.contentScroll}>
          {content}
        </ScrollView>
        <View style={styles.close}>
          <IconButton icon={X} label="Fechar configurações (Esc)" onPress={close} />
          {Platform.OS === 'web' ? <Text style={styles.closeHint}>ESC</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.narrow} contentContainerStyle={styles.narrowContent} keyboardShouldPersistTaps="handled">
      {!current ? identity : null}
      <View style={styles.narrowHeader}>
        <IconButton icon={ChevronLeft} label="Voltar" size={38} onPress={() => (current ? setSelected(undefined) : close())} />
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>{current ? current.title : title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{current ? `${subtitle} · ${current.group}` : subtitle}</Text> : null}
        </View>
      </View>
      {current ? (
        content
      ) : (
        <>
          {searchBox}
          {nav}
        </>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  wide: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  sidebar: { width: 280, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  sidebarContent: { padding: 16, paddingTop: 24, gap: 6 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 9 },
  group: { gap: 2, marginTop: 10 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10, marginBottom: 4 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm },
  navItemNarrow: { backgroundColor: colors.surface, paddingVertical: 13, borderRadius: radius.md, marginBottom: 4, borderWidth: 1, borderColor: colors.border },
  navItemHover: { backgroundColor: colors.surfaceAlt },
  navItemActive: { backgroundColor: colors.brandSoft },
  navText: { flex: 1 },
  navLabel: { fontSize: 14, fontWeight: '500', color: colors.text },
  navLabelActive: { fontWeight: '700', color: colors.brandSoftText },
  navDescription: { fontSize: 12, color: colors.textSubtle, marginTop: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  contentScroll: { padding: 32, paddingRight: 96, alignItems: 'flex-start' },
  page: { width: '100%', maxWidth: 740, gap: 8 },
  breadcrumb: { fontSize: 13, fontWeight: '600', color: colors.textSubtle },
  pageDescription: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  pageBody: { gap: 24, marginTop: 12 },
  close: { position: 'absolute', top: 24, right: 24, alignItems: 'center', gap: 4 },
  closeHint: { fontSize: 10, fontWeight: '700', color: colors.textSubtle },
  narrow: { flex: 1, backgroundColor: colors.background },
  narrowContent: { padding: 16, gap: 8, paddingBottom: 40 },
  narrowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
}));
