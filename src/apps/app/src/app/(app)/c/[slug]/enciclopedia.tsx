import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, ArrowUpDown, BookMarked, Folder as FolderIcon, FolderInput, FolderPlus, Layers, LayoutTemplate, Link2, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react-native';
import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { EncyclopediaAdmin } from '@/components/encyclopedia-admin';
import { EntryTile } from '@/components/feed';
import { Empty, Loadable, Page } from '@/components/layout';
import { NameLink, useFeatureMenu } from '@/components/links';
import { ContextMenu, MoreButton, useCopyLink, useMenu, type MenuItem } from '@/components/menu';
import { DialogModal, PromptModal } from '@/components/prompt';
import { SortableList } from '@/components/sortable';
import { Button } from '@/components/ui';
import { makeStyles, radius, useTheme } from '@/theme';

type Folder = components['schemas']['FolderDto'];

/**
 * Encyclopedia (Amino's wiki): a grid of cover cards, search on top, folders and kinds as filter chips.
 * Moderators manage everything right here: create/rename/order/delete folders, move sheets, feature,
 * templates and rules. Members without the permission don't see these actions.
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
  const queryClient = useQueryClient();
  const { openMenu, toast } = useMenu();
  const canManage = !!encyclopedia.data?.canManage;
  const featureMenu = useFeatureMenu(slug, canManage);
  const [prompt, setPrompt] = useState<{ folder?: Folder } | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [admin, setAdmin] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['encyclopedia', slug] });
  const saveFolder = async (name: string, folder?: Folder) => {
    const res = folder
      ? await api.PUT('/folders/{id}', { params: { path: { id: folder.id } }, body: { name, position: folder.position } })
      : await api.POST('/communities/{slug}/folders', { params: { path: { slug } }, body: { name, position: null } });
    if (!res.response.ok) return (res.error as { detail?: string } | undefined)?.detail ?? 'Não foi possível salvar a pasta.';
    await refresh();
  };
  const deleteFolder = async (folder: Folder) => {
    const res = await api.DELETE('/folders/{id}', { params: { path: { id: folder.id } } });
    toast(res.response.ok ? `Pasta "${folder.name}" apagada; as fichas ficaram sem pasta.` : 'Não foi possível apagar a pasta.');
    if (folderId === folder.id) setFolderId(undefined);
    await refresh();
  };
  const reorderFolders = async (folders: Folder[]) => {
    queryClient.setQueryData(['encyclopedia', slug, folderId ?? 'all', term], (old: typeof encyclopedia.data) => (old ? { ...old, folders } : old));
    await Promise.all(folders.map((f, i) => api.PUT('/folders/{id}', { params: { path: { id: f.id } }, body: { name: f.name, position: i } })));
    await refresh();
  };
  const moveTo = async (item: { id: string; itemType: string }, target: string | null) => {
    const body = { folderId: target };
    const res = item.itemType === 'Character'
      ? await api.PUT('/characters/{id}/folder', { params: { path: { id: item.id } }, body })
      : await api.PUT('/sheets/{id}/folder', { params: { path: { id: item.id } }, body });
    toast(res.response.ok ? 'Ficha movida' : 'Não foi possível mover.');
    await refresh();
  };
  const folderMenu = (folder: Folder): MenuItem[] => [
    { label: 'Renomear pasta', icon: Pencil, onPress: () => setPrompt({ folder }) },
    { label: 'Organizar pastas', icon: ArrowUpDown, onPress: () => setOrdering(true) },
    'separator',
    {
      label: 'Apagar pasta',
      icon: Trash2,
      danger: true,
      onPress: () => openMenu([{ label: `Apagar "${folder.name}"`, icon: Trash2, danger: true, onPress: () => void deleteFolder(folder) }, { label: 'Cancelar', icon: X, onPress: () => undefined }], undefined, 'As fichas ficam sem pasta. Apagar?'),
    },
  ];
  const manageMenu: MenuItem[] = [
    { label: 'Nova pasta', icon: FolderPlus, onPress: () => setPrompt({}) },
    { label: 'Organizar pastas', icon: ArrowUpDown, onPress: () => setOrdering(true) },
    { label: 'Modelos de ficha e regras', icon: LayoutTemplate, onPress: () => setAdmin(true) },
  ];
  const kinds = useMemo(() => [...new Set((encyclopedia.data?.items ?? []).map((i) => i.kind).filter(Boolean))].sort(), [encyclopedia.data]);

  return (
    <Page
      title="Enciclopédia"
      subtitle="Personagens, lugares, criaturas, famílias e tudo mais deste mundo."
      back
      actions={
        <View style={styles.inline}>
          {canManage ? <MoreButton items={manageMenu} title="Moderação da enciclopédia" size={40} label="Gerenciar a enciclopédia" /> : null}
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
                    <ContextMenu key={f.id} items={canManage ? folderMenu(f) : []} title={f.name}>
                      <Chip icon={FolderIcon} label={f.name} count={f.itemCount} selected={folderId === f.id} onPress={() => setFolderId(f.id)} />
                    </ContextMenu>
                  ))}
                  {canManage ? <Chip icon={FolderPlus} label="Nova pasta" selected={false} subtle onPress={() => setPrompt({})} /> : null}
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
                            ...featureMenu(item.itemType === 'Character' ? 'Character' : 'Sheet', item.id),
                            ...(canManage
                              ? ([{
                                  label: 'Mover para pasta',
                                  icon: FolderInput,
                                  onPress: () =>
                                    openMenu(
                                      [
                                        { label: 'Sem pasta', icon: Layers, onPress: () => void moveTo(item, null) },
                                        ...e.folders.map((fo) => ({ label: fo.name + (fo.id === item.folderId ? '  ✓' : ''), icon: FolderIcon, onPress: () => void moveTo(item, fo.id) })),
                                      ],
                                      undefined,
                                      'Mover para',
                                    ),
                                }] as MenuItem[])
                              : []),
                            'separator',
                            { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(path) },
                          ]}
                          onPress={open}
                        />
                        <NameLink label={`@${item.ownerUserName}`} href={{ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: item.ownerUserName } }} style={styles.owner} />
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          );
        }}
      </Loadable>

      {prompt ? (
        <PromptModal
          title={prompt.folder ? 'Renomear pasta' : 'Nova pasta'}
          label="Nome da pasta"
          initial={prompt.folder?.name}
          submitLabel={prompt.folder ? 'Salvar' : 'Criar pasta'}
          onSubmit={(name) => saveFolder(name, prompt.folder)}
          onClose={() => setPrompt(null)}
        />
      ) : null}
      {ordering && encyclopedia.data ? (
        <DialogModal title="Organizar pastas" onClose={() => setOrdering(false)} maxWidth={480}>
          <Text style={styles.count}>Arraste pela alça. É a ordem dos filtros de pasta.</Text>
          <SortableList
            items={encyclopedia.data.folders}
            keyOf={(f) => f.id}
            onReorder={(next) => void reorderFolders(next)}
            renderItem={(f) => (
              <View style={styles.folderRow}>
                <FolderIcon size={16} color={colors.textMuted} />
                <Text style={styles.folderName}>{f.name}</Text>
                <Text style={styles.count}>{f.itemCount}</Text>
              </View>
            )}
          />
        </DialogModal>
      ) : null}
      {admin ? (
        <DialogModal title="Modelos de ficha e regras" onClose={() => setAdmin(false)}>
          <EncyclopediaAdmin slug={slug} />
        </DialogModal>
      ) : null}
    </Page>
  );
}

function Chip({ label, icon: Icon, count, selected, subtle, onPress }: { label: string; icon?: typeof FolderIcon; count?: number; selected: boolean; subtle?: boolean; onPress: () => void }) {
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
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  folderName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
}));
