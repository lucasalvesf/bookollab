import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Bell, Compass, CornerDownLeft, House, Plus, Search, UserRound, type LucideIcon } from 'lucide-react-native';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Avatar } from './avatar';

type Result = { key: string; label: string; hint: string; href: Href; icon?: LucideIcon; community?: { name: string; iconKey?: string | null } };

const PAGES: Result[] = [
  { key: 'home', label: 'Início', hint: 'Página', href: '/', icon: House },
  { key: 'discover', label: 'Descobrir comunidades', hint: 'Página', href: '/descobrir', icon: Compass },
  { key: 'notifications', label: 'Notificações', hint: 'Página', href: '/notificacoes', icon: Bell },
  { key: 'profile', label: 'Meu perfil e aparência', hint: 'Página', href: '/perfil', icon: UserRound },
  { key: 'new', label: 'Criar comunidade', hint: 'Ação', href: '/comunidades/nova', icon: Plus },
];

const Ctx = createContext<() => void>(() => undefined);

/** Quick switcher (Discord's Ctrl+K): jump to any of your communities or app page by typing. */
export function QuickSwitcherProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      {open ? <QuickSwitcher onClose={() => setOpen(false)} /> : null}
    </Ctx.Provider>
  );
}

export const useQuickSwitcher = () => useContext(Ctx);

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function QuickSwitcher({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const mine = useQuery({ queryKey: ['my-communities'], queryFn: () => unwrap(api.GET('/me/communities')) });

  const results = useMemo(() => {
    const q = normalize(term.trim());
    const communities: Result[] = (mine.data ?? []).map((c) => ({
      key: c.id,
      label: c.name,
      hint: 'Comunidade',
      href: { pathname: '/c/[slug]', params: { slug: c.slug } },
      community: { name: c.name, iconKey: c.iconKey },
    }));
    return [...communities, ...PAGES].filter((r) => !q || normalize(r.label).includes(q)).slice(0, 12);
  }, [mine.data, term]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, results.length - 1));
      else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, results.length]);

  return (
    <View style={styles.layer}>
      <Animated.View entering={FadeIn.duration(120)} style={styles.backdrop}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Fechar busca" />
      </Animated.View>
      <Animated.View entering={FadeInUp.duration(160)} style={styles.panel} accessibilityRole="search">
        <View style={styles.inputRow}>
          <Search size={20} color={colors.textSubtle} />
          <TextInput
            autoFocus
            value={term}
            onChangeText={(v) => {
              setTerm(v);
              setActive(0);
            }}
            onSubmitEditing={() => go(results[active])}
            placeholder="Para onde você quer ir?"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            accessibilityLabel="Buscar comunidades e páginas"
          />
          {Platform.OS === 'web' ? <Text style={styles.kbd}>Esc</Text> : null}
        </View>
        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
          {results.length === 0 ? <Text style={styles.empty}>Nada encontrado para “{term}”.</Text> : null}
          {results.map((r, i) => (
            <Pressable
              key={r.key}
              onPress={() => go(r)}
              onHoverIn={() => setActive(i)}
              style={[styles.result, i === active && styles.resultActive]}
              accessibilityRole="button">
              {r.community ? (
                <Avatar name={r.community.name} imageKey={r.community.iconKey} size={30} shape="rounded" />
              ) : r.icon ? (
                <View style={styles.resultIcon}>
                  <r.icon size={16} color={colors.textMuted} />
                </View>
              ) : null}
              <Text style={styles.resultLabel} numberOfLines={1}>{r.label}</Text>
              <Text style={styles.resultHint}>{r.hint}</Text>
              {i === active && Platform.OS === 'web' ? <CornerDownLeft size={14} color={colors.textSubtle} /> : null}
            </Pressable>
          ))}
        </ScrollView>
        {Platform.OS === 'web' ? <Text style={styles.footer}>↑ ↓ para navegar · Enter para abrir · Ctrl+K abre de qualquer lugar</Text> : null}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  fill: { flex: 1 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 900, alignItems: 'center', paddingTop: 90, paddingHorizontal: 16 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  panel: { width: '100%', maxWidth: 560, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(colors, 3) },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 16 },
  kbd: { fontSize: 11, fontWeight: '600', color: colors.textSubtle, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  results: { maxHeight: 380, padding: 6 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.sm },
  resultActive: { backgroundColor: colors.surfaceAlt },
  resultIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  resultLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  resultHint: { fontSize: 12, color: colors.textSubtle },
  empty: { padding: 16, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  footer: { fontSize: 12, color: colors.textSubtle, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
}));
