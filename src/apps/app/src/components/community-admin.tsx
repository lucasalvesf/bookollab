import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BookMarked, Check, GalleryHorizontal, LayoutGrid, Palette, PanelRight, PanelTop, Pin, PinOff, RotateCcw, MessagesSquare, ImagePlus, LayoutList, NotebookPen, Paintbrush, Trash2, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { communityPalette, isHex, THEME_TOKENS, type ThemeMode } from '@/lib/color';
import { pickAndUploadImage } from '@/lib/files';
import { makeStyles, PALETTES, radius, useTheme, type Palette as ThemePalette } from '@/theme';

import { ColorPicker } from './color-picker';
import { BackgroundPicker } from './page-background';

import { Avatar } from './avatar';
import { CommunityCover } from './community';
import { OptionCards } from './form';
import { Section } from './layout';
import { SortableList } from './sortable';
import { Button, Field, Notice } from './ui';

type Community = components['schemas']['CommunityDetail'];
type FeedLayout = components['schemas']['FeedLayout'];
type HomeLayout = components['schemas']['HomeLayout'];
type Pinned = components['schemas']['PinnedPostDto'];

export const SECTION_INFO: Record<string, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Visão geral', icon: LayoutGrid },
  activity: { label: 'Acontecimentos', icon: Activity },
  scenes: { label: 'Chats', icon: MessagesSquare },
  chapters: { label: 'Posts', icon: NotebookPen },
  encyclopedia: { label: 'Enciclopédia', icon: BookMarked },
  characters: { label: 'Personagens', icon: UserRound },
  members: { label: 'Membros', icon: Users },
};

/** Name of a section in this community: the moderation's custom title, or the default. */
export function sectionTitle(c: { sectionTitles?: Record<string, string> | null }, key: string): string {
  return c.sectionTitles?.[key] || SECTION_INFO[key]?.label || key;
}

/** Staff: community icon and cover. */
export function AppearanceAdmin({ community: c }: { community: Community }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'icon' | 'cover'>();
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: (body: { iconKey: string | null; coverKey: string | null }) => unwrap(api.PUT('/communities/{slug}/appearance', { params: { path: { slug: c.slug } }, body })),
    onSuccess: (data) => {
      queryClient.setQueryData(['community', c.slug], data);
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
    onError: (e) => setError(e.message),
  });

  async function pick(kind: 'icon' | 'cover') {
    setError(undefined);
    setBusy(kind);
    try {
      const key = await pickAndUploadImage(kind === 'icon' ? { aspect: 1, title: 'Ajustar ícone' } : { aspect: 3.2, title: 'Ajustar capa' });
      if (key) save.mutate({ iconKey: kind === 'icon' ? key : (c.iconKey ?? null), coverKey: kind === 'cover' ? key : (c.coverKey ?? null) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Section title="Aparência" icon={Paintbrush}>
      <CommunityCover name={c.name} coverKey={c.coverKey} height={120} />
      <View style={styles.appearance}>
        <View style={styles.iconSlot}>
          <Avatar name={c.name} imageKey={c.iconKey} size={64} shape="rounded" />
        </View>
        <View style={styles.buttons}>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <View style={styles.inline}>
            <Button title="Trocar ícone" icon={ImagePlus} size="sm" variant="secondary" loading={busy === 'icon'} onPress={() => pick('icon')} />
            <Button title="Trocar capa" icon={ImagePlus} size="sm" variant="secondary" loading={busy === 'cover'} onPress={() => pick('cover')} />
            {c.iconKey || c.coverKey ? <Button title="Remover imagens" icon={Trash2} size="sm" variant="ghost" onPress={() => save.mutate({ iconKey: null, coverKey: null })} /> : null}
          </View>
          <Text style={styles.hint}>Sem imagem, a comunidade usa uma cor gerada a partir do nome.</Text>
        </View>
      </View>
    </Section>
  );
}

/** Owner (or whoever has ArrangeSections): order of the sections members see, like in Amino. */
export function SectionsAdmin({ community: c }: { community: Community }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const order = c.sections ?? Object.keys(SECTION_INFO);
  const save = useMutation({
    mutationFn: (sections: string[]) => unwrap(api.PUT('/communities/{slug}/sections', { params: { path: { slug: c.slug } }, body: { sections } })),
    onMutate: (sections) => queryClient.setQueryData<Community>(['community', c.slug], (old) => (old ? { ...old, sections } : old)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['community', c.slug] }),
  });
  return (
    <>
      <Section title="Ordem das seções" icon={LayoutList}>
        {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
        <SortableList
          items={order.filter((k) => SECTION_INFO[k])}
          keyOf={(k) => k}
          onReorder={(next) => save.mutate(next)}
          renderItem={(key, i) => {
            const info = SECTION_INFO[key];
            return (
              <View style={styles.sectionRow}>
                <Text style={styles.position}>{i + 1}</Text>
                <View style={styles.sectionIcon}>
                  <info.icon size={18} color={colors.brandSoftText} />
                </View>
                <Text style={styles.sectionLabel}>{info.label}</Text>
              </View>
            );
          }}
        />
        <Text style={[styles.hint, styles.padded]}>Arraste pela alça para reordenar. É a ordem das abas na página da comunidade; a primeira abre por padrão.</Text>
      </Section>
      <FeedLayoutPicker community={c} />
    </>
  );
}

export const FEED_LAYOUTS: { value: FeedLayout; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'Highlight', label: 'Destaque + lista', description: 'O post mais recente grande em cima e os outros menores abaixo.', icon: PanelTop },
  { value: 'Carousel', label: 'Carrossel', description: 'Cartões lado a lado, para passar com o dedo ou as setas.', icon: GalleryHorizontal },
  { value: 'Gallery', label: 'Galeria de capas', description: 'Grade que valoriza a imagem de capa de cada post.', icon: LayoutGrid },
];

/** Owner: how the latest posts are laid out on the community home. */
export function FeedLayoutPicker({ community: c }: { community: Community }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (layout: FeedLayout) => unwrap(api.PUT('/communities/{slug}/feed-layout', { params: { path: { slug: c.slug } }, body: { layout } })),
    onMutate: (layout) => queryClient.setQueryData<Community>(['community', c.slug], (old) => (old ? { ...old, feedLayout: layout } : old)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['community', c.slug] }),
  });
  return (
    <Section title="Layout dos posts" icon={PanelTop} plain>
      <OptionCards<FeedLayout> value={c.feedLayout ?? 'Highlight'} onChange={(v) => save.mutate(v)} options={FEED_LAYOUTS} />
    </Section>
  );
}

const HOME_LAYOUTS: { value: HomeLayout; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'Stacked', label: 'Destaques no topo', description: 'Os destaques grandes em cima; ao abrir uma seção, a tela se divide.', icon: PanelTop },
  { value: 'FeaturedSide', label: 'Destaques à direita', description: 'Tela dividida: os destaques ficam no painel da direita até alguém abrir uma seção.', icon: PanelRight },
];

/** Moderation: community colors (accent only or full theme), secondary colors, background and naming. */
export function ThemeAdmin({ community: c }: { community: Community }) {
  const styles = useStyles();
  const { scheme } = useTheme();
  const queryClient = useQueryClient();
  const [color, setColor] = useState(c.accentColor ?? PALETTES.light.brand);
  const [mode, setMode] = useState<ThemeMode>(c.themeMode ?? 'Accent');
  const [overrides, setOverrides] = useState<Record<string, string>>({ ...(c.themeOverrides ?? {}) });
  const [editing, setEditing] = useState<keyof ThemePalette | null>(null);
  const [inventoryLabel, setInventoryLabel] = useState(c.inventoryLabel ?? '');
  const save = useMutation({
    mutationFn: (patch: Partial<{ accentColor: string | null; homeLayout: HomeLayout; themeMode: ThemeMode; themeOverrides: Record<string, string>; backgroundKey: string | null; backgroundBlur: number; inventoryLabel: string | null }>) =>
      unwrap(api.PUT('/communities/{slug}/theme', { params: { path: { slug: c.slug } }, body: {
        accentColor: c.accentColor ?? null, homeLayout: c.homeLayout ?? 'Stacked', themeMode: c.themeMode ?? 'Accent', themeOverrides: c.themeOverrides ?? {},
        backgroundKey: c.backgroundKey ?? null, backgroundBlur: c.backgroundBlur ?? 0, inventoryLabel: c.inventoryLabel ?? null, ...patch,
      } })),
    onSuccess: (data) => {
      queryClient.setQueryData<Community>(['community', c.slug], (old) => (old ? { ...old, ...data } : old));
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });
  const layout = c.homeLayout ?? 'Stacked';
  // Live palette of what is being edited, in the current theme (light or dark).
  const preview = isHex(color) ? communityPalette(PALETTES[scheme], scheme, color.toUpperCase(), mode, overrides) : PALETTES[scheme];
  const derived = isHex(color) ? communityPalette(PALETTES[scheme], scheme, color.toUpperCase(), mode, null) : PALETTES[scheme];
  const tokens = THEME_TOKENS.filter((t) => mode === 'Full' || ['brand', 'brandSoft', 'brandSoftText'].includes(t.key));
  const dirty = color.toUpperCase() !== (c.accentColor ?? '').toUpperCase() || mode !== (c.themeMode ?? 'Accent') || JSON.stringify(overrides) !== JSON.stringify(c.themeOverrides ?? {});
  return (
    <>
      <Section title="Cores da comunidade" icon={Palette}>
        <View style={styles.themeBody}>
          <View style={styles.themeLeft}>
            <OptionCards<ThemeMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'Accent', label: 'Só a cor de destaque', description: 'O fundo continua o da plataforma; botões, pílulas e links usam a sua cor.', icon: Paintbrush },
                { value: 'Full', label: 'Tema completo', description: 'Fundo, cartões, bordas e barra lateral também ganham tons da sua cor, em harmonia.', icon: Palette },
              ]}
            />
            <Text style={styles.groupLabel}>Cor primária</Text>
            <ColorPicker value={color} onChange={setColor} />
          </View>
          <View style={styles.previews}>
            <Text style={styles.groupLabel}>Cores secundárias (definidas automaticamente)</Text>
            <Text style={styles.hint}>{`Tons gerados a partir da primária no tema ${scheme === 'dark' ? 'escuro' : 'claro'}, sempre com contraste de leitura. Toque em "Trocar" para escolher outra.`}</Text>
            {tokens.map((t) => (
              <View key={t.key} style={styles.tokenRow}>
                <View style={[styles.tokenDot, { backgroundColor: preview[t.key] }]} />
                <View style={styles.flex}>
                  <Text style={styles.tokenName}>{`${t.label}  ${preview[t.key].toUpperCase()}`}</Text>
                  <Text style={styles.hint}>{t.usage}</Text>
                </View>
                {overrides[t.key] ? (
                  <Button title="Automática" icon={RotateCcw} size="sm" variant="ghost" onPress={() => setOverrides(Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== t.key)))} />
                ) : null}
                <Button title="Trocar" size="sm" variant="secondary" onPress={() => setEditing(t.key)} />
              </View>
            ))}
            {editing ? (
              <View style={styles.overrideBox}>
                <Text style={styles.tokenName}>{THEME_TOKENS.find((t) => t.key === editing)?.label}</Text>
                <ColorPicker value={overrides[editing] ?? derived[editing]} onChange={(v) => setOverrides({ ...overrides, [editing]: v })} />
                <Button title="Pronto" icon={Check} size="sm" onPress={() => setEditing(null)} />
              </View>
            ) : null}
          </View>
        </View>
        <View style={[styles.inline, styles.padded]}>
          {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
          <Button title="Salvar cores" icon={Check} size="sm" disabled={!dirty} loading={save.isPending} onPress={() => save.mutate({ accentColor: color, themeMode: mode, themeOverrides: overrides })} />
          {c.accentColor ? (
            <Button
              title="Voltar ao padrão da plataforma"
              icon={RotateCcw}
              size="sm"
              variant="ghost"
              onPress={() => {
                setColor(PALETTES.light.brand);
                setMode('Accent');
                setOverrides({});
                save.mutate({ accentColor: null, themeMode: 'Accent', themeOverrides: {} });
              }}
            />
          ) : null}
          <View style={[styles.miniPreview, { backgroundColor: preview.background, borderColor: preview.border }]}>
            <View style={[styles.miniRail, { backgroundColor: preview.rail }]} />
            <View style={[styles.miniCard, { backgroundColor: preview.surface, borderColor: preview.border }]}>
              <View style={[styles.miniPill, { backgroundColor: preview.brand }]} />
              <View style={[styles.miniPill, { backgroundColor: preview.brandSoft, width: 60 }]} />
            </View>
          </View>
        </View>
      </Section>
      <Section title="Fundo da comunidade" icon={ImagePlus}>
        <View style={styles.padded}>
          <Text style={styles.hint}>Uma imagem atrás de todas as telas da comunidade. Use o desfoque para a leitura ficar confortável.</Text>
          <BackgroundPicker
            value={{ imageKey: c.backgroundKey ?? null, color: null, blur: c.backgroundBlur ?? 0 }}
            onChange={(b) => save.mutate({ backgroundKey: b.imageKey, backgroundBlur: b.blur })}
          />
        </View>
      </Section>
      <Section title="Nomes" icon={Paintbrush}>
        <View style={[styles.padded, styles.inline]}>
          <View style={styles.flex}>
            <Field label="Nome do inventário (ex.: Mochila, Baú)" value={inventoryLabel} onChangeText={setInventoryLabel} placeholder="Inventário" />
          </View>
          <Button title="Salvar" size="sm" disabled={(c.inventoryLabel ?? '') === inventoryLabel.trim()} onPress={() => save.mutate({ inventoryLabel: inventoryLabel.trim() || null })} />
        </View>
      </Section>
      <Section title="Layout da página inicial" icon={PanelRight} plain>
        <OptionCards<HomeLayout> value={layout} onChange={(v) => save.mutate({ homeLayout: v })} options={HOME_LAYOUTS} />
      </Section>
    </>
  );
}

/** Moderation (PinPosts): posts pinned under the community header, in order. */
export function PinsAdmin({ slug }: { slug: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const pins = useQuery({ queryKey: ['pins', slug], queryFn: () => unwrap(api.GET('/communities/{slug}/pins', { params: { path: { slug } } })) });
  const set = (data: Pinned[]) => queryClient.setQueryData(['pins', slug], data);
  return (
    <Section title="Posts fixados" icon={Pin}>
      {pins.data?.length ? (
        <SortableList
          items={pins.data}
          keyOf={(p) => p.chapterId}
          onReorder={(next) => {
            set(next);
            void api.PUT('/communities/{slug}/pins/order', { params: { path: { slug } }, body: { chapterIds: next.map((p) => p.chapterId) } }).then((r) => r.data && set(r.data));
          }}
          renderItem={(p) => (
            <View style={styles.sectionRow}>
              <Pin size={16} color={colors.brand} fill={colors.brand} />
              <Text style={styles.sectionLabel} numberOfLines={1}>{p.title}</Text>
              <Button
                title="Desafixar"
                icon={PinOff}
                size="sm"
                variant="ghost"
                onPress={() => void api.DELETE('/communities/{slug}/pins/{chapterId}', { params: { path: { slug, chapterId: p.chapterId } } }).then((r) => r.data && set(r.data))}
              />
            </View>
          )}
        />
      ) : (
        <Text style={[styles.hint, styles.padded]}>Nenhum post fixado. Use “Fixar no topo da comunidade” no menu “⋯” de um post publicado (até 5).</Text>
      )}
      {pins.data?.length ? <Text style={[styles.hint, styles.padded]}>Arraste pela alça para mudar a ordem. Os títulos aparecem numa barra logo abaixo do cabeçalho da comunidade.</Text> : null}
    </Section>
  );
}

const useStyles = makeStyles((colors) => ({
  appearance: { flexDirection: 'row', gap: 14, padding: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  iconSlot: { marginTop: -44, borderRadius: 22, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surface },
  buttons: { flex: 1, minWidth: 220, gap: 8 },
  inline: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hint: { fontSize: 13, color: colors.textSubtle },
  padded: { padding: 16 },
  themeBody: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, padding: 16 },
  previews: { flex: 1, minWidth: 240, gap: 10 },
  preview: { borderRadius: radius.md, borderWidth: 1, padding: 12, gap: 8 },
  previewLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  previewPill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  previewPillText: { fontSize: 13, fontWeight: '600' },
  previewLink: { fontSize: 13, fontWeight: '700' },
  flex: { flex: 1 },
  themeLeft: { flex: 1, minWidth: 280, maxWidth: 380, gap: 12 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  tokenDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.borderStrong },
  tokenName: { fontSize: 14, fontWeight: '600', color: colors.text },
  overrideBox: { gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  miniPreview: { flexDirection: 'row', width: 150, height: 70, borderRadius: radius.sm, borderWidth: 1, overflow: 'hidden', marginLeft: 'auto' },
  miniRail: { width: 22 },
  miniCard: { flex: 1, margin: 10, borderRadius: 6, borderWidth: 1, padding: 6, gap: 4 },
  miniPill: { height: 8, width: 40, borderRadius: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  position: { width: 18, fontSize: 13, fontWeight: '700', color: colors.textSubtle, textAlign: 'center' },
  sectionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
}));
