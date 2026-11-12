import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, ArrowUpDown, BookMarked, Folder as FolderIcon, FolderOpen, FolderInput, FolderPlus, Layers, LayoutTemplate, Link2, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react-native';
import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Avatar } from '@/components/avatar';
import { sectionTitle } from '@/components/community-admin';
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
type Entry = components['schemas']['EncyclopediaItemDto'];

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
  const [noFolder, setNoFolder] = useState(false);
  const community = useQuery({ queryKey: ['community', slug], queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } })) });
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

  const all = useQuery({
    queryKey: ['encyclopedia', slug, 'all', ''],
    queryFn: () => unwrap(api.GET('/communities/{slug}/encyclopedia', { params: { path: { slug }, query: {} } })),
  });
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const title = community.data ? sectionTitle(community.data, 'encyclopedia') : 'Enciclopédia';
  const previews = (id: string | null) => (all.data?.items ?? []).filter((i) => (id === null ? !i.folderId : i.folderId === id)).map((i) => ({ name: i.name, imageKey: i.imageKey })).slice(0, 3);
  const unfiled = (all.data?.items ?? []).filter((i) => !i.folderId).length;
  const selectFolder = (id: string | undefined, none = false) => {
    setFolderId(id);
    setNoFolder(none);
    setKind(undefined);
  };

  const itemMenu = (item: Entry, folders: Folder[]): MenuItem[] => {
    const path = item.itemType === 'Character' ? `/personagens/${item.id}` : `/fichas/${item.id}`;
    const open = () => (item.itemType === 'Character' ? router.push({ pathname: '/personagens/[id]', params: { id: item.id } }) : router.push({ pathname: '/fichas/[id]', params: { id: item.id } }));
    return [
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
                  ...folders.map((fo) => ({ label: fo.name + (fo.id === item.folderId ? '  ✓' : ''), icon: FolderIcon, onPress: () => void moveTo(item, fo.id) })),
                ],
                undefined,
                'Mover para',
              ),
          }] as MenuItem[])
        : []),
      'separator',
      { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(path) },
    ];
  };

  return (
    <Page
      title={title}
      subtitle="Personagens, lugares, criaturas, famílias e tudo mais deste mundo."
      back
      maxWidth={wide ? 1320 : 760}
      actions={
        <View style={styles.inline}>
          {canManage ? <MoreButton items={manageMenu} title="Moderação da enciclopédia" size={40} label="Gerenciar a enciclopédia" /> : null}
          {encyclopedia.data?.canCreate ? <Button title="Nova ficha" icon={Plus} size="sm" onPress={() => router.push({ pathname: '/c/[slug]/enciclopedia/nova', params: { slug } })} /> : null}
        </View>
      }>
      <View style={styles.search}>
        <Search size={18} color={colors.textSubtle} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nome ou tipo" placeholderTextColor={colors.textSubtle} autoCapitalize="none" style={styles.searchInput} accessibilityLabel="Buscar na enciclopédia" />
        {search ? (
          <Pressable onPress={() => setSearch('')} accessibilityLabel="Limpar busca" hitSlop={8}>
            <X size={16} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      <Loadable query={encyclopedia}>
        {(e) => {
          const base = noFolder ? e.items.filter((i) => !i.folderId) : e.items;
          const items = kind ? base.filter((i) => i.kind === kind) : base;
          const current = noFolder ? 'Sem pasta' : (e.folders.find((f) => f.id === folderId)?.name ?? 'Todas as fichas');
          const tree = (
            <View style={[styles.tree, !wide && styles.treeNarrow]}>
              <ScrollView horizontal={!wide} showsHorizontalScrollIndicator={false} contentContainerStyle={wide ? styles.treeList : styles.treeRow}>
                <FolderEntry name="Todas as fichas" count={all.data?.items.length ?? e.items.length} previews={(all.data?.items ?? []).slice(0, 3)} selected={!folderId && !noFolder} onPress={() => selectFolder(undefined)} wide={wide} icon={Layers} />
                {e.folders.map((f) => (
                  <ContextMenu key={f.id} items={canManage ? folderMenu(f) : []} title={f.name}>
                    <FolderEntry name={f.name} count={f.itemCount} previews={previews(f.id)} selected={folderId === f.id} onPress={() => selectFolder(f.id)} wide={wide} />
                  </ContextMenu>
                ))}
                {unfiled ? <FolderEntry name="Sem pasta" count={unfiled} previews={previews(null)} selected={noFolder} onPress={() => selectFolder(undefined, true)} wide={wide} icon={Layers} /> : null}
                {canManage ? (
                  <Pressable accessibilityRole="button" onPress={() => setPrompt({})} style={({ hovered }) => [styles.newFolder, hovered && styles.newFolderHover]}>
                    <FolderPlus size={16} color={colors.brand} />
                    <Text style={styles.newFolderText}>Nova pasta</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          );
          const content = (
            <View style={styles.content}>
              <View style={styles.contentHeader}>
                <FolderOpen size={20} color={colors.brand} />
                <Text style={styles.contentTitle} numberOfLines={1}>{current}</Text>
                <Text style={styles.count}>{items.length === 1 ? '1 ficha' : `${items.length} fichas`}</Text>
              </View>
              {kinds.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <Chip label="Todos os tipos" selected={!kind} onPress={() => setKind(undefined)} subtle />
                  {kinds.map((k) => (
                    <Chip key={k} icon={k === 'Personagem' ? UserRound : undefined} label={k} selected={kind === k} onPress={() => setKind(kind === k ? undefined : k)} subtle />
                  ))}
                </ScrollView>
              ) : null}
              {items.length === 0 ? (
                <Empty icon={BookMarked}>{term || kind ? 'Nada encontrado com esses filtros.' : `Nenhuma ficha ${folderId || noFolder ? 'nesta pasta' : 'ainda'}.`}</Empty>
              ) : (
                <View style={styles.grid}>
                  {items.map((item) => {
                    const open = () => (item.itemType === 'Character' ? router.push({ pathname: '/personagens/[id]', params: { id: item.id } }) : router.push({ pathname: '/fichas/[id]', params: { id: item.id } }));
                    return (
                      <View key={`${item.itemType}-${item.id}`} style={[styles.tile, wide && styles.tileWide]}>
                        <EntryTile entry={item} menu={itemMenu(item, e.folders)} onPress={open} />
                        <NameLink label={`@${item.ownerUserName}`} href={{ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: item.ownerUserName } }} style={styles.owner} />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
          return wide ? (
            <View style={styles.explorer}>
              {tree}
              {content}
            </View>
          ) : (
            <>
              {tree}
              {content}
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

/** Folder in the explorer list (Windows Explorer-like), with a small fan of the covers inside it. */
function FolderEntry({ name, count, previews, selected, onPress, wide, icon: Icon = FolderIcon }: {
  name: string;
  count: number;
  previews: { name: string; imageKey?: string | null }[];
  selected: boolean;
  onPress: () => void;
  wide: boolean;
  icon?: typeof FolderIcon;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ hovered }) => [styles.folder, !wide && styles.folderNarrow, selected && styles.folderOn, hovered && !selected && styles.folderHover]}>
      <View style={styles.fan}>
        {previews.length ? (
          previews.map((p, i) => (
            <View key={i} style={[styles.fanItem, { left: i * 12, top: i * 3, zIndex: 3 - i, transform: [{ rotate: `${(i - 1) * 6}deg` }] }]}>
              <Avatar name={p.name} imageKey={p.imageKey} size={36} shape="rounded" />
            </View>
          ))
        ) : (
          <View style={styles.fanEmpty}>
            <Icon size={18} color={selected ? colors.brandSoftText : colors.textSubtle} />
          </View>
        )}
      </View>
      <View style={styles.folderText}>
        <Text style={[styles.folderName, selected && styles.folderNameOn]} numberOfLines={1}>{name}</Text>
        <Text style={styles.count}>{count === 1 ? '1 ficha' : `${count} fichas`}</Text>
      </View>
    </Pressable>
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
  tileWide: { width: 156 },
  explorer: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  tree: { width: 320, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 8 },
  treeNarrow: { width: '100%', padding: 6 },
  treeList: { gap: 2 },
  treeRow: { gap: 6 },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.md },
  folderNarrow: { width: 220 },
  folderOn: { backgroundColor: colors.brandSoft },
  folderHover: { backgroundColor: colors.surfaceAlt },
  fan: { width: 64, height: 44 },
  fanItem: { position: 'absolute', borderRadius: 11, borderWidth: 2, borderColor: colors.surface },
  fanEmpty: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  folderText: { flex: 1, gap: 1 },
  folderNameOn: { color: colors.brandSoftText },
  newFolder: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: radius.md },
  newFolderHover: { backgroundColor: colors.surfaceAlt },
  newFolderText: { fontSize: 14, fontWeight: '600', color: colors.brand },
  content: { flex: 1, minWidth: 0, gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16 },
  contentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contentTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  owner: { fontSize: 12, color: colors.textSubtle },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  folderName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
}));
