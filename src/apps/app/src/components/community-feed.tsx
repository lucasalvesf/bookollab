import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { NotebookPen, PenSquare, Star, Trash2, X } from 'lucide-react-native';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { fileUrl } from '@/lib/files';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { colorFor } from './avatar';
import { Carousel } from './feed';
import { NameChip } from './links';
import { ContextMenu, type MenuItem } from './menu';
import { SortableList } from './sortable';
import { IconButton, PressableScale } from './ui';

type Featured = components['schemas']['FeaturedDto'];
type Post = components['schemas']['ChapterSummary'];
export type FeedLayout = components['schemas']['FeedLayout'];

const dateShort = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '');

export function useOpenFeatured() {
  const router = useRouter();
  return (f: Featured) =>
    f.itemType === 'Post'
      ? router.push({ pathname: '/capitulos/[id]', params: { id: f.itemId } })
      : f.itemType === 'Sheet'
        ? router.push({ pathname: '/fichas/[id]', params: { id: f.itemId } })
        : router.push({ pathname: '/personagens/[id]', params: { id: f.itemId } });
}

function kindLabel(f: Featured) {
  return f.itemType === 'Post' ? (f.postKind === 'Blog' ? 'Blog' : 'Capítulo') : f.itemType === 'Sheet' ? 'Ficha' : 'Personagem';
}

/** Cover image, or the title's initial on a solid color when there is none. */
function Cover({ name, imageKey, style, initial = true }: { name: string; imageKey?: string | null; style: object; initial?: boolean }) {
  const styles = useStyles();
  const url = fileUrl(imageKey);
  return url ? (
    <Image source={{ uri: url }} style={style} contentFit="cover" transition={200} />
  ) : (
    <View style={[style, styles.coverFallback, { backgroundColor: colorFor(name) }]}>
      {initial ? <Text style={styles.coverInitial}>{name.trim()[0]?.toUpperCase() ?? '?'}</Text> : null}
    </View>
  );
}

/**
 * Amino-like highlights on top of the community: the first one big, the next ones as medium cards.
 * Moderators get a "manage" button (order by dragging, remove).
 */
export function FeaturedShowcase({ items, onManage }: { items: Featured[]; onManage?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const open = useOpenFeatured();
  const { width } = useWindowDimensions();
  if (items.length === 0 && !onManage) return null;
  const [first, ...rest] = items;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Star size={18} color={colors.accent} fill={colors.accent} />
        <Text style={styles.sectionTitle}>Destaques</Text>
        {onManage ? <IconButton icon={PenSquare} label="Organizar destaques" size={34} onPress={onManage} /> : null}
      </View>
      {!first ? (
        <Text style={styles.hint}>Nada em destaque ainda. Use “Destacar na comunidade” no menu “⋯” de um capítulo, blog ou ficha.</Text>
      ) : (
        <>
          <PressableScale onPress={() => open(first)} accessibilityLabel={first.title} style={[styles.hero, !first.imageKey && styles.heroPlain]}>
            <Cover name={first.title} imageKey={first.imageKey} style={styles.fill} initial={false} />
            {first.imageKey ? <View style={styles.heroShade} /> : null}
            <View style={styles.heroText}>
              <View style={styles.badge}>
                <Star size={11} color={colors.accentText} fill={colors.accentText} />
                <Text style={styles.badgeText}>{kindLabel(first)}</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>{first.title}</Text>
              {first.excerpt ? <Text style={styles.heroExcerpt} numberOfLines={width < 600 ? 2 : 3}>{first.excerpt}</Text> : null}
              {first.subtitle ? <Text style={styles.heroBy}>{first.subtitle}</Text> : null}
            </View>
          </PressableScale>
          {rest.length > 0 ? (
            <Carousel itemWidth={220}>
              {rest.map((f) => (
                <PressableScale key={f.id} onPress={() => open(f)} accessibilityLabel={f.title} style={styles.mini}>
                  <Cover name={f.title} imageKey={f.imageKey} style={styles.miniCover} />
                  <View style={styles.miniBody}>
                    <Text style={styles.miniKind}>{kindLabel(f)}</Text>
                    <Text style={styles.miniTitle} numberOfLines={2}>{f.title}</Text>
                  </View>
                </PressableScale>
              ))}
            </Carousel>
          ) : null}
        </>
      )}
    </View>
  );
}

/** Moderation: order the highlights by dragging, or take them out. */
export function ManageFeaturedModal({ slug, items, onClose }: { slug: string; items: Featured[]; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const set = (data: Featured[]) => queryClient.setQueryData(['featured', slug], data);
  const reorder = useMutation({
    mutationFn: (ids: string[]) => unwrap(api.PUT('/communities/{slug}/featured/order', { params: { path: { slug } }, body: { ids } })),
    onSuccess: set,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/communities/{slug}/featured/{id}', { params: { path: { slug, id } } })),
    onSuccess: set,
  });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalLayer}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Star size={18} color={colors.accent} fill={colors.accent} />
            <Text style={styles.modalTitle}>Organizar destaques</Text>
            <IconButton icon={X} label="Fechar" size={36} onPress={onClose} />
          </View>
          <Text style={styles.hint}>Arraste pela alça para mudar a ordem. O primeiro aparece grande no topo da comunidade.</Text>
          {items.length === 0 ? <Text style={styles.hint}>Nada em destaque ainda.</Text> : null}
          <SortableList
            items={items}
            keyOf={(f) => f.id}
            onReorder={(next) => {
              set(next);
              reorder.mutate(next.map((f) => f.id));
            }}
            renderItem={(f, i) => (
              <View style={styles.manageRow}>
                <Text style={styles.position}>{i + 1}</Text>
                <Cover name={f.title} imageKey={f.imageKey} style={styles.manageThumb} />
                <View style={styles.flex}>
                  <Text style={styles.manageTitle} numberOfLines={1}>{f.title}</Text>
                  <Text style={styles.hint}>{kindLabel(f)}</Text>
                </View>
                <IconButton icon={Trash2} label={`Tirar ${f.title} dos destaques`} size={34} onPress={() => remove.mutate(f.id)} />
              </View>
            )}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Who wrote a post, as a link: the character (chapter) or the player (blog, OFF). */
export function PostAuthorChip({ post, slug }: { post: Post; slug: string }) {
  return post.characterId ? (
    <NameChip label={post.characterName} avatar={{ name: post.characterName, imageKey: post.characterAvatarKey }} href={{ pathname: '/personagens/[id]', params: { id: post.characterId } }} />
  ) : (
    <NameChip label={post.characterName} avatar={{ name: post.characterName, imageKey: post.characterAvatarKey }} href={{ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: post.authorUserName } }} />
  );
}

/** The community's latest posts in the layout chosen by the owner (Amino front page). */
export function PostFeed({ posts, slug, layout, menuFor, onOpen }: {
  posts: Post[];
  slug: string;
  layout: FeedLayout;
  menuFor: (p: Post) => MenuItem[];
  onOpen: (p: Post) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (posts.length === 0) return <Text style={styles.hint}>Nenhum post publicado ainda.</Text>;

  const kindTag = (p: Post) => (
    <View style={[styles.kindTag, p.kind === 'Blog' && styles.kindTagBlog]}>
      {p.kind === 'Blog' ? <PenSquare size={11} color={colors.warning} /> : <NotebookPen size={11} color={colors.brandSoftText} />}
      <Text style={[styles.kindTagText, p.kind === 'Blog' && styles.kindTagTextBlog]}>{p.kind === 'Blog' ? 'Blog' : 'Capítulo'}</Text>
    </View>
  );

  const card = (p: Post) => (
    <ContextMenu key={p.id} items={menuFor(p)} title={p.title} style={styles.fill}>
      <PressableScale onPress={() => onOpen(p)} accessibilityLabel={p.title} style={styles.card}>
        <Cover name={p.title} imageKey={p.coverKey} style={styles.cardCover} />
        <View style={styles.cardBody}>
          {kindTag(p)}
          <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
          <Text style={styles.excerpt} numberOfLines={3}>{p.excerpt}</Text>
          <View style={styles.flex} />
          <View style={styles.metaRow}>
            <PostAuthorChip post={p} slug={slug} />
            <Text style={styles.time}>{dateShort(p.publishedAt ?? p.createdAt)}</Text>
          </View>
        </View>
      </PressableScale>
    </ContextMenu>
  );

  if (layout === 'Carousel') return <Carousel itemWidth={280}>{posts.map(card)}</Carousel>;

  if (layout === 'Gallery') {
    return (
      <View style={styles.gallery}>
        {posts.map((p) => (
          <ContextMenu key={p.id} items={menuFor(p)} title={p.title} style={styles.galleryItem}>
            <PressableScale onPress={() => onOpen(p)} accessibilityLabel={p.title} style={styles.galleryCard}>
              <Cover name={p.title} imageKey={p.coverKey} style={styles.fill} />
              <View style={styles.galleryShade} />
              <View style={styles.galleryText}>
                <Text style={styles.galleryKind}>{p.kind === 'Blog' ? 'Blog' : 'Capítulo'}</Text>
                <Text style={styles.galleryTitle} numberOfLines={2}>{p.title}</Text>
                <Text style={styles.galleryBy} numberOfLines={1}>{p.characterName}</Text>
              </View>
            </PressableScale>
          </ContextMenu>
        ))}
      </View>
    );
  }

  // Highlight: newest post big, the others as compact rows.
  const [first, ...rest] = posts;
  return (
    <View style={styles.highlight}>
      <ContextMenu items={menuFor(first)} title={first.title}>
        <PressableScale onPress={() => onOpen(first)} accessibilityLabel={first.title} style={styles.big}>
          <Cover name={first.title} imageKey={first.coverKey} style={styles.bigCover} />
          <View style={styles.bigBody}>
            {kindTag(first)}
            <Text style={styles.bigTitle} numberOfLines={2}>{first.title}</Text>
            <Text style={styles.excerpt} numberOfLines={3}>{first.excerpt}</Text>
            <View style={styles.metaRow}>
              <PostAuthorChip post={first} slug={slug} />
              <Text style={styles.time}>{dateShort(first.publishedAt ?? first.createdAt)}</Text>
            </View>
          </View>
        </PressableScale>
      </ContextMenu>
      {rest.length > 0 ? (
        <View style={styles.rows}>
          {rest.map((p) => (
            <ContextMenu key={p.id} items={menuFor(p)} title={p.title}>
              <Pressable accessibilityRole="button" onPress={() => onOpen(p)} style={({ hovered, pressed }) => [styles.row, (hovered || pressed) && styles.rowActive]}>
                <Cover name={p.title} imageKey={p.coverKey} style={styles.rowThumb} />
                <View style={styles.flex}>
                  {kindTag(p)}
                  <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.excerpt} numberOfLines={1}>{p.excerpt}</Text>
                </View>
                <View style={styles.rowMeta}>
                  <PostAuthorChip post={p} slug={slug} />
                  <Text style={styles.time}>{dateShort(p.publishedAt ?? p.createdAt)}</Text>
                </View>
              </Pressable>
            </ContextMenu>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hint: { fontSize: 13, color: colors.textSubtle, lineHeight: 18 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  sectionTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontSize: 40, fontWeight: '800', color: 'rgba(255,255,255,0.9)' },
  hero: { height: 300, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceAlt, ...shadow(colors, 2) },
  heroPlain: { height: 190 },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%', backgroundColor: 'rgba(0,0,0,0.5)' },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.accentText, textTransform: 'uppercase', letterSpacing: 0.4 },
  heroTitle: { fontSize: 28, lineHeight: 34, color: '#FFFFFF', fontFamily: 'Literata_600SemiBold' },
  heroExcerpt: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.9)' },
  heroBy: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  mini: { height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  miniCover: { width: '100%', height: 120 },
  miniBody: { padding: 10, gap: 2 },
  miniKind: { fontSize: 11, fontWeight: '700', color: colors.brand, textTransform: 'uppercase' },
  miniTitle: { fontSize: 15, color: colors.text, fontFamily: 'Literata_600SemiBold' },
  kindTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  kindTagBlog: { backgroundColor: colors.warningBg },
  kindTagText: { fontSize: 11, fontWeight: '700', color: colors.brandSoftText },
  kindTagTextBlog: { color: colors.warning },
  card: { height: 340, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(colors, 1) },
  cardCover: { width: '100%', height: 140 },
  cardBody: { flex: 1, padding: 14, gap: 6 },
  cardTitle: { fontSize: 18, lineHeight: 24, color: colors.text, fontFamily: 'Literata_600SemiBold' },
  excerpt: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  time: { fontSize: 12, color: colors.textSubtle },
  highlight: { gap: 12 },
  big: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(colors, 1) },
  bigCover: { flexGrow: 1, flexBasis: 280, minHeight: 220 },
  bigBody: { flexGrow: 1, flexBasis: 300, padding: 20, gap: 8 },
  bigTitle: { fontSize: 24, lineHeight: 30, color: colors.text, fontFamily: 'Literata_600SemiBold' },
  rows: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  rowActive: { backgroundColor: colors.surfaceAlt },
  rowThumb: { width: 72, height: 56, borderRadius: radius.sm },
  rowTitle: { fontSize: 16, color: colors.text, fontFamily: 'Literata_600SemiBold', marginTop: 2 },
  rowMeta: { alignItems: 'flex-end', gap: 4 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  galleryItem: { flexGrow: 1, flexBasis: 200, maxWidth: '100%' },
  galleryCard: { aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  galleryShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: 'rgba(0,0,0,0.5)' },
  galleryText: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 2 },
  galleryKind: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  galleryTitle: { fontSize: 17, lineHeight: 22, color: '#FFFFFF', fontFamily: 'Literata_600SemiBold' },
  galleryBy: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  modalLayer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  modal: { width: '100%', maxWidth: 560, maxHeight: '85%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 10, ...shadow(colors, 3) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingRight: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  position: { width: 18, fontSize: 13, fontWeight: '700', color: colors.textSubtle, textAlign: 'center' },
  manageThumb: { width: 56, height: 42, borderRadius: radius.sm },
  manageTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
}));
