import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Check, GalleryHorizontal, LayoutGrid, Palette, PanelRight, PanelTop, Pin, PinOff, RotateCcw, MessagesSquare, ImagePlus, LayoutList, NotebookPen, Paintbrush, Trash2, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { communityPalette, isHex } from '@/lib/color';
import { pickAndUploadImage } from '@/lib/files';
import { makeStyles, PALETTES, radius, useTheme } from '@/theme';

import { ColorPicker } from './color-picker';

import { Avatar } from './avatar';
import { CommunityCover } from './community';
import { OptionCards } from './form';
import { Section } from './layout';
import { SortableList } from './sortable';
import { Button, Notice } from './ui';

type Community = components['schemas']['CommunityDetail'];
type FeedLayout = components['schemas']['FeedLayout'];
type HomeLayout = components['schemas']['HomeLayout'];
type Pinned = components['schemas']['PinnedPostDto'];

export const SECTION_INFO: Record<string, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Visão geral', icon: LayoutGrid },
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
      const key = await pickAndUploadImage();
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

/** Moderation: the community's main color (both themes derive from it) and the home arrangement. */
export function ThemeAdmin({ community: c }: { community: Community }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [color, setColor] = useState(c.accentColor ?? PALETTES.light.brand);
  const save = useMutation({
    mutationFn: (body: { accentColor: string | null; homeLayout: HomeLayout }) => unwrap(api.PUT('/communities/{slug}/theme', { params: { path: { slug: c.slug } }, body })),
    onSuccess: (data) => {
      queryClient.setQueryData<Community>(['community', c.slug], (old) => (old ? { ...old, accentColor: data.accentColor, homeLayout: data.homeLayout } : old));
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });
  const layout = c.homeLayout ?? 'Stacked';
  const changed = (c.accentColor ?? null) !== (color.toUpperCase() === PALETTES.light.brand && !c.accentColor ? null : color.toUpperCase());
  return (
    <>
      <Section title="Cor da comunidade" icon={Palette}>
        <View style={styles.themeBody}>
          <ColorPicker value={color} onChange={setColor} />
          <View style={styles.previews}>
            <Text style={styles.hint}>Prévia nos dois temas. Os tons claros e escuros saem da cor escolhida, sempre com contraste de leitura.</Text>
            <ColorPreview scheme="light" color={color} />
            <ColorPreview scheme="dark" color={color} />
          </View>
        </View>
        <View style={[styles.inline, styles.padded]}>
          {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
          <Button title="Salvar cor" icon={Check} size="sm" disabled={!changed} loading={save.isPending} onPress={() => save.mutate({ accentColor: color, homeLayout: layout })} />
          {c.accentColor ? (
            <Button
              title="Voltar à cor padrão"
              icon={RotateCcw}
              size="sm"
              variant="ghost"
              onPress={() => {
                setColor(PALETTES.light.brand);
                save.mutate({ accentColor: null, homeLayout: layout });
              }}
            />
          ) : null}
        </View>
      </Section>
      <Section title="Layout da página inicial" icon={PanelRight} plain>
        <OptionCards<HomeLayout> value={layout} onChange={(v) => save.mutate({ accentColor: c.accentColor ?? null, homeLayout: v })} options={HOME_LAYOUTS} />
      </Section>
    </>
  );
}

/** Mini mock of the community UI in one theme, recolored with the chosen color. */
function ColorPreview({ scheme, color }: { scheme: 'light' | 'dark'; color: string }) {
  const styles = useStyles();
  const p = isHex(color) ? communityPalette(PALETTES[scheme], scheme, color.toUpperCase()) : PALETTES[scheme];
  return (
    <View style={[styles.preview, { backgroundColor: p.background, borderColor: p.border }]}>
      <Text style={[styles.previewLabel, { color: p.textSubtle }]}>{scheme === 'light' ? 'Tema claro' : 'Tema escuro'}</Text>
      <View style={styles.inline}>
        <View style={[styles.previewPill, { backgroundColor: p.brand }]}>
          <Text style={[styles.previewPillText, { color: p.brandText }]}>Visão geral</Text>
        </View>
        <View style={[styles.previewPill, { backgroundColor: p.surface, borderColor: p.border, borderWidth: 1 }]}>
          <Text style={[styles.previewPillText, { color: p.textMuted }]}>Chats</Text>
        </View>
        <View style={[styles.previewPill, { backgroundColor: p.brandSoft }]}>
          <Text style={[styles.previewPillText, { color: p.brandSoftText }]}>Capítulo</Text>
        </View>
      </View>
      <Text style={[styles.previewLink, { color: p.brand }]}>@Ayla Venn · Ver mais</Text>
    </View>
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  position: { width: 18, fontSize: 13, fontWeight: '700', color: colors.textSubtle, textAlign: 'center' },
  sectionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
}));
