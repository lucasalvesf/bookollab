import { useQuery } from '@tanstack/react-query';
import { BookMarked, Link2, MessagesSquare, NotebookPen, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { KIND_LABEL } from '@/lib/links';
import { makeStyles, radius, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { SECTION_INFO } from './community-admin';
import { DialogModal } from './prompt';
import { Button, Field } from './ui';

export type Linkable = components['schemas']['LinkableDto'];

const KIND_ICON: Record<string, LucideIcon> = { character: UserRound, sheet: BookMarked, chat: MessagesSquare, post: NotebookPen, member: Users };

/** Everything linkable in a community matching the term (debounce is up to the caller). */
export function useLinkables(slug: string | undefined, term: string, limit = 5) {
  return useQuery({
    queryKey: ['linkables', slug, term, limit],
    enabled: !!slug,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
    queryFn: () => unwrap(api.GET('/communities/{slug}/linkables', { params: { path: { slug: slug! }, query: { q: term, limit } } })),
  });
}

/** Grouped suggestion list ("Personagens: …, Chats: …"), with the On/Off pill on chats. */
export function LinkableList({ items, onPick, activeIndex }: { items: Linkable[]; onPick: (l: Linkable) => void; activeIndex?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const groups = new Map<string, Linkable[]>();
  for (const it of items) groups.set(it.kind, [...(groups.get(it.kind) ?? []), it]);
  let index = -1;
  return (
    <View>
      {[...groups.entries()].map(([kind, list]) => (
        <View key={kind}>
          <Text style={styles.group}>{KIND_LABEL[kind] ?? kind}</Text>
          {list.map((l) => {
            index++;
            const Icon = KIND_ICON[l.kind] ?? Link2;
            const active = index === activeIndex;
            return (
              <Pressable key={l.target} accessibilityRole="button" onPress={() => onPick(l)} style={({ hovered }) => [styles.item, (hovered || active) && styles.itemActive]}>
                {l.imageKey || l.kind === 'member' || l.kind === 'character' ? (
                  <Avatar name={l.label} imageKey={l.imageKey} size={28} shape={l.kind === 'member' || l.kind === 'character' ? 'circle' : 'rounded'} />
                ) : (
                  <View style={styles.icon}>
                    <Icon size={15} color={colors.brandSoftText} />
                  </View>
                )}
                <View style={styles.text}>
                  <Text style={styles.label} numberOfLines={1}>{l.label}</Text>
                  {l.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{l.subtitle}</Text> : null}
                </View>
                {l.tag ? (
                  <View style={[styles.pill, l.tag === 'On' ? styles.pillOn : styles.pillOff]}>
                    <Text style={[styles.pillText, l.tag === 'On' ? styles.pillTextOn : styles.pillTextOff]}>{l.tag}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Dialog to pick a link target: anything in the community, a main section or an external URL. */
export function LinkPickerModal({ slug, title = 'Adicionar link', onPick, onClose }: { slug: string; title?: string; onPick: (label: string, target: string) => void; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [term, setTerm] = useState('');
  const [url, setUrl] = useState('');
  const [urlLabel, setUrlLabel] = useState('');
  const found = useLinkables(slug, term.trim(), 6);
  const sections = Object.entries(SECTION_INFO).filter(([, s]) => !term || s.label.toLowerCase().includes(term.toLowerCase()));
  return (
    <DialogModal title={title} onClose={onClose} maxWidth={520}>
      <TextInput value={term} onChangeText={setTerm} autoFocus placeholder="Buscar personagens, fichas, chats, posts, membros…" placeholderTextColor={colors.textSubtle} style={styles.search} accessibilityLabel="Buscar o que linkar" />
      {sections.length ? (
        <View>
          <Text style={styles.group}>{KIND_LABEL.section}</Text>
          {sections.map(([key, s]) => (
            <Pressable key={key} accessibilityRole="button" onPress={() => onPick(s.label, `section:${key}`)} style={({ hovered }) => [styles.item, hovered && styles.itemActive]}>
              <View style={styles.icon}>
                <s.icon size={15} color={colors.brandSoftText} />
              </View>
              <Text style={[styles.label, styles.text]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <LinkableList items={found.data ?? []} onPick={(l) => onPick(l.label, l.target)} />
      <View style={styles.external}>
        <Text style={styles.group}>{KIND_LABEL.url}</Text>
        <Field label="Endereço (https://…)" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
        <Field label="Nome do link" value={urlLabel} onChangeText={setUrlLabel} />
        <Button title="Adicionar link externo" size="sm" variant="secondary" icon={Link2} disabled={!/^https?:\/\/\S+\.\S+/.test(url) || !urlLabel.trim()} onPress={() => onPick(urlLabel.trim(), `url:${url.trim()}`)} />
      </View>
    </DialogModal>
  );
}

const useStyles = makeStyles((colors) => ({
  search: { fontSize: 15, color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  group: { fontSize: 11, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.sm },
  itemActive: { backgroundColor: colors.surfaceAlt },
  icon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillOn: { backgroundColor: colors.successBg },
  pillOff: { backgroundColor: colors.surfaceAlt },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextOn: { color: colors.success },
  pillTextOff: { color: colors.textMuted },
  external: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
}));
