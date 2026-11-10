import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, BookMarked, Folder, Layers, Link2, Plus, Search, Settings, UserRound, X } from 'lucide-react-native';
import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { EntryTile } from '@/components/feed';
import { Empty, Loadable, Page } from '@/components/layout';
import { useCopyLink } from '@/components/menu';
import { Button, IconButton } from '@/components/ui';
import { makeStyles, radius, useTheme } from '@/theme';

/**
 * Encyclopedia (Amino's wiki): a grid of cover cards, search on top, folders and kinds as filter chips.
 * Staff manage folders/templates from the community settings (gear).
 */
export default function EncyclopediaScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const copyLink = useCopyLink();
  const [folderId, setFolderId] = useState<string | undefined>();
  const [kind, setKind] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const encyclopedia = useQuery({
    queryKey: ['encyclopedia', slug, folderId ?? 'all', term],
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET('/communities/{slug}/encyclopedia', { params: { path: { slug }, query: { folderId, search: term || undefined } } })),
  });
  const kinds = useMemo(() => [...new Set((encyclopedia.data?.items ?? []).map((i) => i.kind).filter(Boolean))].sort(), [encyclopedia.data]);

  return (
    <Page
      title="Enciclopédia"
      subtitle="Personagens, lugares, criaturas, famílias e tudo mais deste mundo."
      back
      actions={
        <View style={styles.inline}>
          {encyclopedia.data?.canManage ? <IconButton icon={Settings} label="Pastas, modelos e regras" onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug } })} /> : null}
          {encyclopedia.data?.canCreate ? <Button title="Nova ficha" icon={Plus} size="sm" onPress={() => router.push({ pathname: '/c/[slug]/enciclopedia/nova', params: { slug } })} /> : null}
        </View>
      }>
      <View style={styles.search}>
        <Search size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou tipo"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          style={styles.searchInput}
          accessibilityLabel="Buscar na enciclopédia"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} accessibilityLabel="Limpar busca" hitSlop={8}>
            <X size={16} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      <Loadable query={encyclopedia}>
        {(e) => {
          const items = kind ? e.items.filter((i) => i.kind === kind) : e.items;
          return (
            <>
              <View style={styles.filters}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <Chip icon={Layers} label="Todas as pastas" selected={!folderId} onPress={() => setFolderId(undefined)} />
                  {e.folders.map((f) => (
                    <Chip key={f.id} icon={Folder} label={f.name} count={f.itemCount} selected={folderId === f.id} onPress={() => setFolderId(f.id)} />
                  ))}
                </ScrollView>
                {kinds.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    <Chip label="Todos os tipos" selected={!kind} onPress={() => setKind(undefined)} subtle />
                    {kinds.map((k) => (
                      <Chip key={k} icon={k === 'Personagem' ? UserRound : undefined} label={k} selected={kind === k} onPress={() => setKind(kind === k ? undefined : k)} subtle />
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              <Text style={styles.count}>{items.length === 1 ? '1 ficha' : `${items.length} fichas`}</Text>
              {items.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Empty icon={BookMarked}>{term || kind ? 'Nada encontrado com esses filtros.' : `Nenhuma ficha ${folderId ? 'nesta pasta' : 'ainda'}.`}</Empty>
                </View>
              ) : (
                <View style={styles.grid}>
                  {items.map((item) => {
                    const path = item.itemType === 'Character' ? `/personagens/${item.id}` : `/fichas/${item.id}`;
                    const open = () =>
                      item.itemType === 'Character' ? router.push({ pathname: '/personagens/[id]', params: { id: item.id } }) : router.push({ pathname: '/fichas/[id]', params: { id: item.id } });
                    return (
                      <View key={`${item.itemType}-${item.id}`} style={styles.tile}>
                        <EntryTile
                          entry={item}
                          menu={[
                            { label: 'Abrir ficha', icon: ArrowRight, onPress: open },
                            { label: 'Ver o autor', icon: UserRound, onPress: () => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: item.ownerUserName } }) },
                            'separator',
                            { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(path) },
                          ]}
                          onPress={open}
                        />
                        <Text style={styles.owner} numberOfLines={1}>@{item.ownerUserName}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          );
        }}
      </Loadable>
    </Page>
  );
}

function Chip({ label, icon: Icon, count, selected, subtle, onPress }: { label: string; icon?: typeof Folder; count?: number; selected: boolean; subtle?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fg = selected ? (subtle ? colors.brandSoftText : colors.brandText) : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ hovered }) => [styles.chip, selected && (subtle ? styles.chipSubtle : styles.chipSelected), hovered && !selected && styles.chipHover]}>
      {Icon ? <Icon size={15} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
      {count !== undefined ? <Text style={[styles.chipCount, { color: fg }]}>{count}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 11 },
  filters: { gap: 8 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.surface },
  chipHover: { borderColor: colors.borderStrong },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipSubtle: { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipCount: { fontSize: 12, fontWeight: '700', opacity: 0.8 },
  count: { fontSize: 13, fontWeight: '600', color: colors.textSubtle },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  tile: { width: 132, gap: 2 },
  owner: { fontSize: 12, color: colors.textSubtle },
}));
