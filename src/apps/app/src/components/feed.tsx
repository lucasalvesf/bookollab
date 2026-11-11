import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { ChevronLeft, ChevronRight, Radio, Users, X, type LucideIcon } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';

import { fileUrl } from '@/lib/files';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Avatar, colorFor } from './avatar';
import { NameChip } from './links';
import { ContextMenu, type MenuItem } from './menu';
import { IconButton, PressableScale } from './ui';

/** Section title with an optional icon, extra actions and a "Ver mais" link. */
export function FeedSection({ title, icon: Icon, onSeeAll, actions, children }: { title: string; icon?: LucideIcon; onSeeAll?: () => void; actions?: ReactNode; children: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {Icon ? <Icon size={18} color={colors.brand} strokeWidth={2.2} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {actions}
        {onSeeAll ? (
          <Pressable accessibilityRole="link" onPress={onSeeAll} hitSlop={8} style={({ hovered }) => [styles.seeAll, hovered && styles.seeAllHover]}>
            <Text style={styles.seeAllText}>Ver mais</Text>
            <ChevronRight size={16} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Horizontal carousel with snapping; arrows on the web (a mouse can't swipe). */
export function Carousel({ itemWidth, gap = 12, children }: { itemWidth: number; gap?: number; children: ReactNode[] }) {
  const styles = useStyles();
  const ref = useRef<ScrollViewInstance>(null);
  const [offset, setOffset] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const step = (itemWidth + gap) * Math.max(1, Math.floor(viewport / (itemWidth + gap)));
  const scrollBy = (delta: number) => ref.current?.scrollTo({ x: Math.max(0, offset + delta), animated: true });
  const canPrev = offset > 4;
  const canNext = offset + viewport < contentWidth - 4;
  return (
    <View style={styles.carousel} onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth + gap}
        decelerationRate="fast"
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.x)}
        onContentSizeChange={(w) => setContentWidth(w)}
        scrollEventThrottle={32}
        contentContainerStyle={{ gap, paddingVertical: 4, paddingRight: 4 }}>
        {children.map((child, i) => (
          <View key={i} style={{ width: itemWidth }}>
            {child}
          </View>
        ))}
      </ScrollView>
      {Platform.OS === 'web' && canPrev ? (
        <View style={[styles.arrow, styles.arrowLeft]}>
          <IconButton icon={ChevronLeft} label="Anteriores" size={36} onPress={() => scrollBy(-step)} />
        </View>
      ) : null}
      {Platform.OS === 'web' && canNext ? (
        <View style={[styles.arrow, styles.arrowRight]}>
          <IconButton icon={ChevronRight} label="Próximos" size={36} onPress={() => scrollBy(step)} />
        </View>
      ) : null}
    </View>
  );
}

export function ChapterCard({ chapter: c, community, authorHref, menu, onPress }: {
  chapter: { title: string; excerpt: string; characterName: string; characterAvatarKey?: string | null; publishedAt?: string | null; kind?: string | null; coverKey?: string | null };
  /** With a slug, the community name is a link. */
  community?: { name: string; iconKey?: string | null; slug?: string };
  /** Link of the author (character, or the player for blogs). */
  authorHref?: Href;
  menu?: MenuItem[];
  onPress: () => void;
}) {
  const styles = useStyles();
  const cover = fileUrl(c.coverKey);
  return (
    <ContextMenu items={menu ?? []} style={styles.fill}>
      <PressableScale onPress={onPress} accessibilityLabel={c.title} style={styles.chapterCard}>
        {cover ? <Image source={{ uri: cover }} style={styles.chapterCover} contentFit="cover" transition={150} /> : null}
        <View style={styles.chapterTop}>
          {community?.slug ? (
            <NameChip label={community.name} avatar={{ name: community.name, imageKey: community.iconKey }} shape="rounded" href={{ pathname: '/c/[slug]', params: { slug: community.slug } }} />
          ) : null}
          {c.kind === 'Blog' ? <Text style={styles.blogTag}>BLOG</Text> : null}
        </View>
        <Text style={styles.chapterTitle} numberOfLines={2}>{c.title}</Text>
        <Text style={styles.chapterExcerpt} numberOfLines={cover ? 2 : 4}>{c.excerpt}</Text>
        <View style={styles.flex} />
        <View style={styles.author}>
          {authorHref ? (
            <NameChip label={c.characterName} avatar={{ name: c.characterName, imageKey: c.characterAvatarKey }} href={authorHref} />
          ) : (
            <>
              <Avatar name={c.characterName} imageKey={c.characterAvatarKey} size={22} />
              <Text style={styles.authorName} numberOfLines={1}>{c.characterName}</Text>
            </>
          )}
          <View style={styles.flex} />
          {c.publishedAt ? <Text style={styles.time}>{new Date(c.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text> : null}
        </View>
      </PressableScale>
    </ContextMenu>
  );
}

export function SceneCard({ scene: s, community, menu, onPress }: {
  scene: { title: string; participantCount: number; lastActionAt?: string | null };
  community?: { name: string; iconKey?: string | null; slug?: string };
  menu?: MenuItem[];
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <ContextMenu items={menu ?? []} style={styles.fill}>
      <PressableScale onPress={onPress} accessibilityLabel={s.title} style={styles.sceneCard}>
        <View style={styles.live}>
          <Radio size={13} color={colors.success} />
          <Text style={styles.liveText}>Ao vivo</Text>
        </View>
        <Text style={styles.sceneTitle} numberOfLines={2}>{s.title}</Text>
        <View style={styles.author}>
          <Users size={13} color={colors.textSubtle} />
          <Text style={styles.time}>{`${s.participantCount} ${s.participantCount === 1 ? 'personagem' : 'personagens'}`}</Text>
        </View>
        {community?.slug ? (
          <NameChip label={community.name} avatar={{ name: community.name, imageKey: community.iconKey }} shape="rounded" href={{ pathname: '/c/[slug]', params: { slug: community.slug } }} />
        ) : null}
      </PressableScale>
    </ContextMenu>
  );
}

/** Encyclopedia thumbnail (sheet or character): image, or the initial on a solid color. */
export function EntryTile({ entry: e, menu, onPress }: { entry: { name: string; kind?: string | null; imageKey?: string | null }; menu?: MenuItem[]; onPress: () => void }) {
  const styles = useStyles();
  const url = fileUrl(e.imageKey);
  return (
    <ContextMenu items={menu ?? []} style={styles.fill}>
      <PressableScale onPress={onPress} accessibilityLabel={e.name} style={styles.tile}>
        {url ? (
          <Image source={{ uri: url }} style={styles.tileImage} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.tileImage, styles.tileFallback, { backgroundColor: colorFor(e.name) }]}>
            <Text style={styles.tileInitial}>{e.name.trim()[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <Text style={styles.tileName} numberOfLines={1}>{e.name}</Text>
        {e.kind ? <Text style={styles.tileKind} numberOfLines={1}>{e.kind}</Text> : null}
      </PressableScale>
    </ContextMenu>
  );
}

/** "Ver mais" dialog: every item of a section in a responsive grid. */
export function SeeAllModal({ title, visible, onClose, minItemWidth, children }: { title: string; visible: boolean; onClose: () => void; minItemWidth: number; children: ReactNode[] }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const panel = Math.min(width - 32, 960);
  const columns = Math.max(1, Math.floor((panel - 40) / (minItemWidth + 12)));
  const itemWidth = (panel - 40 - (columns - 1) * 12) / columns;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalLayer}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.modal, { width: panel }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <IconButton icon={X} label="Fechar" size={36} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.modalGrid}>
            {children.map((child, i) => (
              <View key={i} style={{ width: itemWidth }}>
                {child}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  fill: { flex: 1 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  sectionTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  seeAllHover: { backgroundColor: colors.brandSoft },
  seeAllText: { fontSize: 14, fontWeight: '600', color: colors.brand },
  carousel: { position: 'relative' },
  arrow: { position: 'absolute', top: '50%', marginTop: -18, borderRadius: 18, ...shadow(colors, 2) },
  arrowLeft: { left: -12 },
  arrowRight: { right: -12 },
  chapterTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterCover: { height: 96, marginHorizontal: -16, marginTop: -16, marginBottom: 4 },
  blogTag: { fontSize: 10, fontWeight: '800', color: colors.warning, letterSpacing: 0.6 },
  chapterCard: { overflow: 'hidden', height: 260, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8, ...shadow(colors, 1) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingLeft: 4, paddingRight: 10, paddingVertical: 3, maxWidth: '100%' },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted, flexShrink: 1 },
  chapterTitle: { fontSize: 18, lineHeight: 24, color: colors.text, fontFamily: 'Literata_600SemiBold' },
  chapterExcerpt: { fontSize: 14, lineHeight: 21, color: colors.textMuted, fontFamily: 'Literata_400Regular' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  time: { fontSize: 12, color: colors.textSubtle, flexShrink: 1 },
  sceneCard: { height: 150, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8, ...shadow(colors, 1) },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.successBg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  liveText: { fontSize: 11, fontWeight: '700', color: colors.success },
  sceneTitle: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 21 },
  tile: { gap: 6 },
  tileImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  tileFallback: { alignItems: 'center', justifyContent: 'center' },
  tileInitial: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  tileName: { fontSize: 14, fontWeight: '600', color: colors.text },
  tileKind: { fontSize: 12, color: colors.textSubtle, marginTop: -4 },
  modalLayer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  modal: { maxHeight: '88%', backgroundColor: colors.background, borderRadius: radius.xl, overflow: 'hidden', ...shadow(colors, 3) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 20 },
}));
