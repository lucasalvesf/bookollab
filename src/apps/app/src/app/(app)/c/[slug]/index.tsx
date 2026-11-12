import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight,
  BookMarked,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  LayoutTemplate,
  Link2,
  MessagesSquare,
  NotebookPen,
  PenSquare,
  Pin,
  PinOff,
  Plus,
  Reply,
  Search,
  Settings,
  UserMinus,
  UserRound,
  Users,
  X,
} from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, type ViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Avatar } from '@/components/avatar';
import { CommunityCover } from '@/components/community';
import { FEED_LAYOUTS, SECTION_INFO, sectionTitle } from '@/components/community-admin';
import { FeaturedShowcase, ManageFeaturedModal, PostAuthorChip, PostFeed, type FeedLayout } from '@/components/community-feed';
import { useCommunityMenu } from '@/components/community-menu';
import { useFeatureMenu } from '@/components/links';
import { Carousel, ChatCard, EntryTile, FeedSection } from '@/components/feed';
import { Empty, Loadable, Page, Row, Tag } from '@/components/layout';
import { ContextMenu, MoreButton, useCopyLink, useMenu, type MenuItem } from '@/components/menu';
import { PillScroller } from '@/components/pill-scroller';
import { Button, IconButton, Notice } from '@/components/ui';
import { presenceLabel } from '@/lib/date';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

type SectionKey = 'overview' | 'scenes' | 'chapters' | 'encyclopedia' | 'characters' | 'members';
type Community = components['schemas']['CommunityDetail'];
type Post = components['schemas']['ChapterSummary'];
type Pinned = components['schemas']['PinnedPostDto'];

const STAFF = ['ManageMembers', 'CreateInvites', 'ManageCommunity', 'ModerateContent', 'ArrangeSections', 'PinPosts'];
/** From this window width the home splits in two when a section is opened. */
const SPLIT = 1100;

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "Fixar no topo" / "Desafixar" for posts (moderation with PinPosts). */
function usePinMenu(slug: string, pins: Pinned[], canPin: boolean) {
  const queryClient = useQueryClient();
  const { toast } = useMenu();
  return (postId: string): MenuItem[] => {
    if (!canPin) return [];
    const pinned = pins.some((p) => p.chapterId === postId);
    return [
      {
        label: pinned ? 'Desafixar do topo' : 'Fixar no topo da comunidade',
        icon: pinned ? PinOff : Pin,
        onPress: async () => {
          const res = pinned
            ? await api.DELETE('/communities/{slug}/pins/{chapterId}', { params: { path: { slug, chapterId: postId } } })
            : await api.POST('/communities/{slug}/pins', { params: { path: { slug } }, body: { chapterId: postId } });
          if (res.data) queryClient.setQueryData(['pins', slug], res.data);
          toast(res.response.ok ? (pinned ? 'Post desafixado' : 'Post fixado no topo') : ((res.error as { detail?: string } | undefined)?.detail ?? 'Não foi possível.'));
        },
      },
    ];
  };
}

/** Community home (Amino-like): cover and identity, pinned posts, the sections, and a split view on wide screens. */
export default function CommunityScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { slug, tab: tabParam } = useLocalSearchParams<{ slug: string; tab?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const communityMenu = useCommunityMenu();
  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } }), 'Comunidade não encontrada.'),
  });
  const pins = useQuery({ queryKey: ['pins', slug], enabled: !!community.data?.me, queryFn: () => unwrap(api.GET('/communities/{slug}/pins', { params: { path: { slug } } })) });
  const validTab = (t?: string) => (t && t in SECTION_INFO && t !== 'encyclopedia' ? (t as SectionKey) : undefined);
  const [tab, setTab] = useState<SectionKey | undefined>(() => validTab(tabParam));
  const [scrolled, setScrolled] = useState(false);
  // A link to a section (?tab=members, e.g. from the side menu) opens it, also when already on this screen.
  const [seenParam, setSeenParam] = useState(tabParam);
  if (tabParam !== seenParam) {
    setSeenParam(tabParam);
    if (validTab(tabParam)) setTab(validTab(tabParam));
  }
  const join = useMutation({
    mutationFn: () => unwrap(api.POST('/communities/{slug}/join', { params: { path: { slug } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community', slug] });
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });
  const split = width >= SPLIT;

  return (
    <Loadable query={community}>
      {(c) => {
        const perms = new Set(c.me?.permissions ?? []);
        const isStaff = STAFF.some((p) => perms.has(p));
        const order = (c.sections ?? Object.keys(SECTION_INFO)).filter((s): s is SectionKey => s in SECTION_INFO);
        const current: SectionKey = tab && order.includes(tab) ? tab : 'overview';
        const menu = communityMenu({ slug: c.slug, name: c.name, myPermissions: c.me?.permissions }, !!c.me);
        const pinned = pins.data ?? [];
        // The encyclopedia has its own screen; the other sections open as a panel (wide) or replace the overview (narrow).
        const choose = (key: SectionKey) => {
          if (key === 'encyclopedia') router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug } });
          else setTab(key === current && split ? 'overview' : key);
        };
        const featuredSide = c.homeLayout === 'FeaturedSide';
        const panelOpen = split && current !== 'overview';

        const hero = (
          <View style={styles.heroWrap}>
            <CommunityCover name={c.name} coverKey={c.coverKey} height={split ? 240 : 190}>
              <View style={styles.heroTop}>
                <IconButton icon={ChevronLeft} label="Voltar" tone="onImage" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
                <View style={styles.flex} />
                {isStaff ? <IconButton icon={Settings} label="Moderação e configurações" tone="onImage" onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug } })} /> : null}
                <MoreButton items={menu} title={c.name} size={40} tone="onImage" />
              </View>
            </CommunityCover>
            <ContextMenu items={menu} title={c.name} style={[styles.identity, split && styles.identityWide]}>
              <View style={styles.icon}>
                <Avatar name={c.name} imageKey={c.iconKey} size={88} shape="rounded" />
              </View>
              <View style={styles.identityText}>
                <Text style={styles.name}>{c.name}</Text>
                <View style={styles.metaRow}>
                  <Users size={14} color={colors.textSubtle} />
                  <Pressable accessibilityRole="link" onPress={() => c.me && choose('members')}>
                    <Text style={styles.meta}>{`${c.memberCount} ${c.memberCount === 1 ? 'membro' : 'membros'}`}</Text>
                  </Pressable>
                  <Tag label={labels.joinPolicy[c.joinPolicy]} tone="neutral" />
                  {c.me ? <Tag label={c.me.roleName} /> : null}
                </View>
              </View>
            </ContextMenu>
            {pinned.length ? <PinnedBar pins={pinned} wide={split} /> : null}
          </View>
        );

        return (
          <Page
            title={c.name}
            hero={hero}
            maxWidth={split ? 1320 : 760}
            onScroll={(y) => setScrolled(y > 300)}
            overlay={
              scrolled ? <StickyHeader community={c} order={c.me ? order : []} current={current} onTab={choose} isStaff={isStaff} pins={pinned} /> : null
            }>
            {c.description ? <Text style={styles.description}>{c.description}</Text> : null}

            {!c.me ? (
              <View style={styles.joinBox}>
                {join.isError ? <Notice kind="error">{join.error.message}</Notice> : null}
                {c.hasPendingRequest || join.data?.status === 'pending' ? (
                  <Notice kind="info">Seu pedido de entrada foi enviado. Aguarde a aprovação da moderação.</Notice>
                ) : c.joinPolicy === 'InviteOnly' ? (
                  <Notice kind="info">Esta comunidade só aceita membros por convite.</Notice>
                ) : (
                  <View style={styles.joinButton}>
                    <Button title={c.joinPolicy === 'Open' ? 'Entrar na comunidade' : 'Pedir para entrar'} icon={Plus} onPress={() => join.mutate()} loading={join.isPending} />
                  </View>
                )}
              </View>
            ) : (
              <>
                <PillScroller>
                  {order.map((key) => {
                    const s = SECTION_INFO[key];
                    const active = key === current;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => choose(key)}
                        style={({ hovered }) => [styles.tab, active && styles.tabActive, hovered && !active && styles.tabHover]}>
                        <s.icon size={18} color={active ? colors.brandText : colors.textMuted} strokeWidth={2.2} />
                        <Text style={[styles.tabText, active && styles.tabTextActive]}>{sectionTitle(c, key)}</Text>
                        {key === 'encyclopedia' ? <ChevronRight size={15} color={colors.textSubtle} /> : null}
                      </Pressable>
                    );
                  })}
                </PillScroller>

                {split ? (
                  <View style={styles.split}>
                    <View style={styles.main}>
                      <Overview community={c} onSeeAll={choose} pins={pinned} hideFeatured={featuredSide && !panelOpen} />
                    </View>
                    {panelOpen ? (
                      <Animated.View key={current} entering={FadeInRight.duration(220)} style={styles.side}>
                        <View style={styles.sideHeader}>
                          {(() => {
                            const Icon = SECTION_INFO[current].icon;
                            return <Icon size={18} color={colors.brand} strokeWidth={2.2} />;
                          })()}
                          <Text style={styles.sideTitle}>{sectionTitle(c, current)}</Text>
                          <IconButton icon={X} label="Fechar painel" size={32} onPress={() => setTab('overview')} />
                        </View>
                        <SectionList section={current as Exclude<SectionKey, 'overview' | 'encyclopedia'>} community={c} perms={perms} pins={pinned} narrow />
                      </Animated.View>
                    ) : featuredSide ? (
                      <Animated.View entering={FadeIn.duration(200)} style={styles.side}>
                        <SideFeatured community={c} />
                      </Animated.View>
                    ) : null}
                  </View>
                ) : current === 'overview' ? (
                  <Overview community={c} onSeeAll={choose} pins={pinned} />
                ) : (
                  <SectionList key={current} section={current as Exclude<SectionKey, 'overview' | 'encyclopedia'>} community={c} perms={perms} pins={pinned} />
                )}
              </>
            )}
          </Page>
        );
      }}
    </Loadable>
  );
}

/** Bar of pinned posts under the community header: just the titles, a pin icon in the community color. */
function PinnedBar({ pins, wide, compact }: { pins: Pinned[]; wide?: boolean; compact?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.pinned, wide && styles.pinnedWide, compact && styles.pinnedCompact]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedRow}>
        {pins.map((p) => (
          <Pressable
            key={p.chapterId}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: p.chapterId } })}
            style={({ hovered }) => [styles.pin, hovered && styles.pinHover]}>
            <Text style={styles.pinText} numberOfLines={1}>{p.title}</Text>
            <Pin size={14} color={colors.brand} fill={colors.brand} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** "FeaturedSide" layout: the highlights live in the right-hand panel. */
function SideFeatured({ community: c }: { community: Community }) {
  const [managing, setManaging] = useState(false);
  const canFeature = (c.me?.permissions ?? []).includes('ModerateContent');
  const featured = useQuery({ queryKey: ['featured', c.slug], queryFn: () => unwrap(api.GET('/communities/{slug}/featured', { params: { path: { slug: c.slug } } })) });
  return (
    <>
      <FeaturedShowcase items={featured.data ?? []} compact onManage={canFeature ? () => setManaging(true) : undefined} />
      {managing ? <ManageFeaturedModal slug={c.slug} items={featured.data ?? []} onClose={() => setManaging(false)} /> : null}
    </>
  );
}

/** "Escrever": choose between a chapter (as a character) and a blog (OFF, as the player). */
function WriteButton({ slug }: { slug: string }) {
  const router = useRouter();
  const ref = useRef<ViewInstance>(null);
  const { openMenu } = useMenu();
  return (
    <View ref={ref} collapsable={false}>
      <Button
        title="Escrever"
        icon={Plus}
        size="sm"
        onPress={() =>
          ref.current?.measureInWindow((x, y, w, h) =>
            openMenu(
              [
                { label: 'Capítulo (como personagem)', icon: NotebookPen, onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug } }) },
                { label: 'Blog (post OFF)', icon: PenSquare, onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug, kind: 'blog' } }) },
              ],
              { x: x + w - 248, y: y + h + 4 },
              'Escrever',
            ),
          )
        }
      />
    </View>
  );
}

/** Compact header that sticks to the top once the cover scrolls away: identity, tabs and the pinned posts. */
function StickyHeader({ community: c, order, current, onTab, isStaff, pins }: { community: Community; order: SectionKey[]; current: SectionKey; onTab: (k: SectionKey) => void; isStaff: boolean; pins: Pinned[] }) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <Animated.View entering={FadeInDown.duration(160)} style={styles.sticky}>
      <View style={styles.stickyInner}>
        <Avatar name={c.name} imageKey={c.iconKey} size={30} shape="rounded" />
        <Text style={styles.stickyName} numberOfLines={1}>{c.name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickyTabs} style={styles.flex}>
          {order.map((key) => {
            const active = key === current;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onTab(key)} style={[styles.stickyTab, active && styles.stickyTabActive]}>
                <Text style={[styles.stickyTabText, active && styles.stickyTabTextActive]}>{sectionTitle(c, key)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {isStaff ? <IconButton icon={Settings} label="Moderação e configurações" size={34} onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug: c.slug } })} /> : null}
      </View>
      {pins.length ? <PinnedBar pins={pins} compact /> : null}
    </Animated.View>
  );
}

/** Overview: highlights, latest posts, live chats and the encyclopedia, each with "Ver mais". */
function Overview({ community: c, onSeeAll, pins, hideFeatured }: { community: Community; onSeeAll: (s: SectionKey) => void; pins: Pinned[]; hideFeatured?: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const copyLink = useCopyLink();
  const { openMenu } = useMenu();
  const slug = c.slug;
  const perms = new Set(c.me?.permissions ?? []);
  const canFeature = perms.has('ModerateContent');
  const featureMenu = useFeatureMenu(slug, canFeature);
  const pinMenu = usePinMenu(slug, pins, perms.has('PinPosts'));
  const [managing, setManaging] = useState(false);
  const featured = useQuery({ queryKey: ['featured', slug], queryFn: () => unwrap(api.GET('/communities/{slug}/featured', { params: { path: { slug } } })) });
  const layoutMenu: MenuItem[] = FEED_LAYOUTS.map((l) => ({ label: l.label + (l.value === (c.feedLayout ?? 'Highlight') ? '  ✓' : ''), icon: l.icon, onPress: () => void setLayout(l.value) }));
  const queryClient = useQueryClient();
  const setLayout = async (layout: FeedLayout) => {
    queryClient.setQueryData<Community>(['community', slug], (old) => (old ? { ...old, feedLayout: layout } : old));
    await api.PUT('/communities/{slug}/feed-layout', { params: { path: { slug } }, body: { layout } });
  };
  const postMenu = (p: Post): MenuItem[] => [
    { label: p.kind === 'Blog' ? 'Ler blog' : 'Ler capítulo', icon: ArrowRight, onPress: () => router.push({ pathname: '/capitulos/[id]', params: { id: p.id } }) },
    { label: 'Responder com um capítulo', icon: Reply, onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug, replyTo: p.id, ...(p.characterId ? { mention: p.characterId } : {}) } }) },
    ...featureMenu('Post', p.id),
    ...pinMenu(p.id),
    'separator',
    { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/capitulos/${p.id}`) },
  ];
  const chapters = useQuery({ queryKey: ['chapters', slug], queryFn: () => unwrap(api.GET('/communities/{slug}/chapters', { params: { path: { slug }, query: {} } })) });
  const scenes = useQuery({ queryKey: ['scenes', slug], queryFn: () => unwrap(api.GET('/communities/{slug}/scenes', { params: { path: { slug } } })) });
  const encyclopedia = useQuery({
    queryKey: ['encyclopedia', slug, 'all', ''],
    queryFn: () => unwrap(api.GET('/communities/{slug}/encyclopedia', { params: { path: { slug }, query: {} } })),
  });
  const published = (chapters.data ?? []).filter((ch) => ch.status === 'Published').slice(0, 10);
  const live = (scenes.data ?? []).filter((s) => s.status === 'Open').slice(0, 12);
  const entries = (encyclopedia.data?.items ?? []).slice(0, 16);

  return (
    <View style={styles.overview}>
      {hideFeatured ? null : <FeaturedShowcase items={featured.data ?? []} onManage={canFeature ? () => setManaging(true) : undefined} />}
      {managing ? <ManageFeaturedModal slug={slug} items={featured.data ?? []} onClose={() => setManaging(false)} /> : null}
      <FeedSection
        title="Últimos posts"
        icon={NotebookPen}
        onSeeAll={() => onSeeAll('chapters')}
        actions={
          <View style={styles.rowRight}>
            {perms.has('ManageCommunity') ? <IconButton icon={LayoutTemplate} label="Layout dos posts" size={34} onPress={() => openMenu(layoutMenu, undefined, 'Layout dos posts')} /> : null}
            {perms.has('WriteChapters') ? <WriteButton slug={slug} /> : null}
          </View>
        }>
        <PostFeed posts={published} slug={slug} layout={c.feedLayout ?? 'Highlight'} menuFor={postMenu} onOpen={(p) => router.push({ pathname: '/capitulos/[id]', params: { id: p.id } })} />
      </FeedSection>
      <FeedSection title="Chats ao vivo" icon={MessagesSquare} onSeeAll={() => onSeeAll('scenes')}>
        {live.length ? (
          <Carousel itemWidth={240}>
            {live.map((s) => (
              <ChatCard
                key={s.id}
                chat={s}
                menu={[
                  { label: 'Abrir chat', icon: ArrowRight, onPress: () => router.push({ pathname: '/cenas/[id]', params: { id: s.id } }) },
                  { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/cenas/${s.id}`) },
                ]}
                onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })}
              />
            ))}
          </Carousel>
        ) : (
          <Empty icon={MessagesSquare}>Nenhum chat aberto agora.</Empty>
        )}
      </FeedSection>
      <FeedSection title={`Da ${sectionTitle(c, 'encyclopedia').toLowerCase()}`} icon={BookMarked} onSeeAll={() => router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug } })}>
        {entries.length ? (
          <Carousel itemWidth={132}>
            {entries.map((e) => {
              const open = () =>
                e.itemType === 'Character' ? router.push({ pathname: '/personagens/[id]', params: { id: e.id } }) : router.push({ pathname: '/fichas/[id]', params: { id: e.id } });
              return (
                <EntryTile
                  key={e.id}
                  entry={e}
                  menu={[
                    { label: 'Abrir ficha', icon: ArrowRight, onPress: open },
                    ...featureMenu(e.itemType === 'Character' ? 'Character' : 'Sheet', e.id),
                    { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(e.itemType === 'Character' ? `/personagens/${e.id}` : `/fichas/${e.id}`) },
                  ]}
                  onPress={open}
                />
              );
            })}
          </Carousel>
        ) : (
          <Empty icon={BookMarked}>A enciclopédia ainda está vazia.</Empty>
        )}
      </FeedSection>
    </View>
  );
}

/** Collapsible group (Chats: public OFF chats / scene chats ON). */
function Collapsible({ title, count, pill, children }: { title: string; count: number; pill: 'On' | 'Off'; children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.group}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={({ hovered }) => [styles.groupHead, hovered && styles.groupHeadHover]}>
        <View style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }}>
          <ChevronDown size={16} color={colors.textMuted} />
        </View>
        <Text style={styles.groupTitle}>{title}</Text>
        <View style={[styles.onOff, pill === 'On' ? styles.onPill : styles.offPill]}>
          <Text style={[styles.onOffText, pill === 'On' ? styles.onPillText : styles.offPillText]}>{pill}</Text>
        </View>
        <Text style={styles.groupCount}>{count}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

/** One section with its own search, primary actions and per-item menus. */
function SectionList({ section, community: c, perms, pins, narrow }: { section: Exclude<SectionKey, 'overview' | 'encyclopedia'>; community: Community; perms: Set<string>; pins: Pinned[]; narrow?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const copyLink = useCopyLink();
  const { toast } = useMenu();
  const queryClient = useQueryClient();
  const slug = c.slug;
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState<'all' | 'Chapter' | 'Blog'>('all');
  const featureMenu = useFeatureMenu(slug, perms.has('ModerateContent'));
  const pinMenu = usePinMenu(slug, pins, perms.has('PinPosts'));
  const q = normalize(term.trim());
  const match = (...parts: (string | null | undefined)[]) => !q || normalize(parts.filter(Boolean).join(' ')).includes(q);

  const characters = useQuery({ queryKey: ['characters', slug], enabled: section === 'characters', queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug }, query: {} } })) });
  const members = useQuery({ queryKey: ['members', slug], enabled: section === 'members', queryFn: () => unwrap(api.GET('/communities/{slug}/members', { params: { path: { slug } } })) });
  const scenes = useQuery({ queryKey: ['scenes', slug], enabled: section === 'scenes', queryFn: () => unwrap(api.GET('/communities/{slug}/scenes', { params: { path: { slug } } })) });
  const chapters = useQuery({ queryKey: ['chapters', slug], enabled: section === 'chapters', queryFn: () => unwrap(api.GET('/communities/{slug}/chapters', { params: { path: { slug }, query: {} } })) });

  const removeMember = async (userId: string, name: string) => {
    const { response, error } = await api.POST('/communities/{slug}/members/{userId}/remove', { params: { path: { slug, userId } } });
    toast(response.ok ? `${name} foi removido da comunidade` : ((error as { detail?: string } | undefined)?.detail ?? 'Não foi possível remover.'));
    if (response.ok) void queryClient.invalidateQueries({ queryKey: ['members', slug] });
  };

  const placeholder = useMemo(
    () => ({ scenes: 'Buscar chats', chapters: 'Buscar posts', characters: 'Buscar personagens', members: 'Buscar membros' })[section],
    [section],
  );

  return (
    <View style={styles.panel}>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Search size={16} color={colors.textSubtle} />
          <TextInput value={term} onChangeText={setTerm} placeholder={placeholder} placeholderTextColor={colors.textSubtle} style={styles.searchInput} accessibilityLabel={placeholder} />
          {term ? (
            <Pressable onPress={() => setTerm('')} accessibilityLabel="Limpar busca" hitSlop={8}>
              <X size={14} color={colors.textSubtle} />
            </Pressable>
          ) : null}
        </View>
        {section === 'characters' && perms.has('CreateCharacters') ? <Button title="Novo personagem" icon={Plus} size="sm" onPress={() => router.push({ pathname: '/c/[slug]/personagens/novo', params: { slug } })} /> : null}
        {section === 'chapters' && perms.has('WriteChapters') ? <WriteButton slug={slug} /> : null}
      </View>

      {section === 'scenes' ? (
        <Loadable query={scenes}>
          {(list) => {
            const items = list.filter((s) => match(s.title, s.description, s.openedByUserName));
            const chatMenu = (s: (typeof list)[number]): MenuItem[] => [
              { label: 'Abrir', icon: ArrowRight, onPress: () => router.push({ pathname: '/cenas/[id]', params: { id: s.id } }) },
              { label: 'Escrever o capítulo da cena', icon: NotebookPen, hidden: s.status === 'Open' || s.kind === 'Chat', onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug, sceneId: s.id } }) },
              'separator',
              { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/cenas/${s.id}`) },
            ];
            const grid = (group: typeof items, empty: string) =>
              group.length ? (
                <View style={styles.chatGrid}>
                  {group.map((s) => (
                    <View key={s.id} style={[styles.chatCell, narrow && styles.chatCellNarrow]}>
                      <ChatCard chat={s} menu={chatMenu(s)} onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })} />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.groupEmpty}>{q ? 'Nada encontrado.' : empty}</Text>
              );
            const publicChats = items.filter((s) => s.kind === 'Chat');
            const sceneChats = items.filter((s) => s.kind !== 'Chat');
            return (
              <View style={styles.chats}>
                <View style={styles.chatActions}>
                  {perms.has('JoinScenes') ? <Button title="Novo chat público" icon={MessagesSquare} size="sm" variant="secondary" onPress={() => router.push({ pathname: '/c/[slug]/cenas/nova', params: { slug, kind: 'chat' } })} /> : null}
                  {perms.has('OpenScenes') ? <Button title="Abrir cena" icon={Clapperboard} size="sm" onPress={() => router.push({ pathname: '/c/[slug]/cenas/nova', params: { slug } })} /> : null}
                </View>
                <Collapsible title="Chats públicos" count={publicChats.length} pill="Off">
                  {grid(publicChats, 'Nenhum chat público ainda. Aqui os membros conversam como eles mesmos.')}
                </Collapsible>
                <Collapsible title="Chats de cena" count={sceneChats.length} pill="On">
                  {grid(sceneChats, 'Nenhuma cena ainda. Nas cenas, cada um joga com seu personagem.')}
                </Collapsible>
              </View>
            );
          }}
        </Loadable>
      ) : null}

      {section === 'chapters' ? (
        <Loadable query={chapters}>
          {(list) => {
            const items = list.filter((ch) => (kind === 'all' || ch.kind === kind) && match(ch.title, ch.excerpt, ch.characterName, ch.authorUserName));
            const filters = (
              <View style={styles.filters}>
                {([['all', 'Todos'], ['Chapter', 'Capítulos'], ['Blog', 'Blogs']] as const).map(([k, label]) => (
                  <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: kind === k }} onPress={() => setKind(k)} style={[styles.filter, kind === k && styles.filterOn]}>
                    <Text style={[styles.filterText, kind === k && styles.filterTextOn]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            );
            return (
              <>
                {filters}
                {items.length === 0 ? (
                  <Empty icon={NotebookPen}>{q || kind !== 'all' ? 'Nenhum post encontrado.' : 'Nenhum post ainda.'}</Empty>
                ) : (
                  items.map((ch) => {
                    const isPinned = pins.some((p) => p.chapterId === ch.id);
                    const menu: MenuItem[] = [
                      { label: ch.kind === 'Blog' ? 'Ler blog' : 'Ler capítulo', icon: ArrowRight, onPress: () => router.push({ pathname: '/capitulos/[id]', params: { id: ch.id } }) },
                      { label: 'Responder com um capítulo', icon: Reply, hidden: ch.status !== 'Published', onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug, replyTo: ch.id, ...(ch.characterId ? { mention: ch.characterId } : {}) } }) },
                      ...(ch.status === 'Published' ? [...featureMenu('Post', ch.id), ...pinMenu(ch.id)] : []),
                      'separator',
                      { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/capitulos/${ch.id}`) },
                    ];
                    return (
                      <ContextMenu key={ch.id} items={menu} title={ch.title}>
                        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: ch.id } })} style={({ hovered, pressed }) => [styles.chapter, (hovered || pressed) && styles.chapterActive]}>
                          <View style={styles.chapterHead}>
                            {isPinned ? <Pin size={14} color={colors.brand} fill={colors.brand} /> : null}
                            <Text style={styles.chapterTitle} numberOfLines={1}>{ch.title}</Text>
                            {ch.status === 'Draft' ? <Tag label="Rascunho" tone="neutral" /> : ch.status === 'Pending' ? <Tag label="Aguardando aprovação" tone="warning" /> : ch.status === 'Rejected' ? <Tag label="Recusado" tone="danger" /> : null}
                            <MoreButton items={menu} title={ch.title} />
                          </View>
                          <Text style={styles.chapterExcerpt} numberOfLines={narrow ? 2 : 3}>{ch.excerpt}</Text>
                          <View style={styles.chapterMeta}>
                            <PostAuthorChip post={ch} slug={slug} />
                            {ch.kind === 'Blog' ? <Tag label="Blog" tone="warning" /> : null}
                            <Clock size={12} color={colors.textSubtle} />
                            <Text style={styles.chapterTime}>{new Date(ch.publishedAt ?? ch.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                          </View>
                        </Pressable>
                      </ContextMenu>
                    );
                  })
                )}
              </>
            );
          }}
        </Loadable>
      ) : null}

      {section === 'characters' ? (
        <Loadable query={characters}>
          {(list) => {
            const items = list.filter((ch) => match(ch.name, ch.ownerUserName));
            return items.length === 0 ? (
              <Empty icon={UserRound}>{q ? 'Nenhum personagem encontrado.' : 'Nenhum personagem ainda.'}</Empty>
            ) : (
              items.map((ch) => {
                const menu: MenuItem[] = [
                  { label: 'Ver ficha', icon: ArrowRight, onPress: () => router.push({ pathname: '/personagens/[id]', params: { id: ch.id } }) },
                  { label: 'Ver o jogador', icon: UserRound, onPress: () => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: ch.ownerUserName } }) },
                  'separator',
                  { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/personagens/${ch.id}`) },
                ];
                return (
                  <ContextMenu key={ch.id} items={menu} title={ch.name}>
                    <Row title={ch.name} subtitle={`de @${ch.ownerUserName}`} left={<Avatar name={ch.name} imageKey={ch.avatarKey} size={42} />} right={<MoreButton items={menu} title={ch.name} />} onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: ch.id } })} />
                  </ContextMenu>
                );
              })
            );
          }}
        </Loadable>
      ) : null}

      {section === 'members' ? (
        <Loadable query={members}>
          {(list) => {
            const items = list.filter((m) => match(m.displayName, m.userName, m.roleName));
            // Grouped by role, highest first, like Discord's member list ("Moderador — 2"); online first inside each role.
            const rank: Record<string, number> = { Owner: 0, Staff: 1, Narrator: 2, Custom: 3, Player: 4 };
            const groups = new Map<string, typeof items>();
            for (const m of [...items].sort((a, b) => (rank[a.baseKind] ?? 9) - (rank[b.baseKind] ?? 9) || Number(!!b.presence?.online) - Number(!!a.presence?.online) || a.displayName.localeCompare(b.displayName, 'pt-BR')))
              groups.set(m.roleName, [...(groups.get(m.roleName) ?? []), m]);
            return items.length === 0 ? (
              <Empty icon={Users}>Nenhum membro encontrado.</Empty>
            ) : (
              [...groups.entries()].map(([role, group]) => (
                <View key={role}>
                  <Text style={styles.groupHeader}>{`${role} — ${group.length}`}</Text>
                  {group.map((m) => {
                    const menu: MenuItem[] = [
                      { label: 'Ver perfil na comunidade', icon: UserRound, onPress: () => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: m.userName } }) },
                      { label: 'Ver perfil global', icon: ArrowRight, onPress: () => router.push({ pathname: '/u/[userName]', params: { userName: m.userName } }) },
                      ...(perms.has('ManageMembers') && m.baseKind !== 'Owner' ? (['separator', { label: 'Remover da comunidade', icon: UserMinus, danger: true, onPress: () => void removeMember(m.userId, m.displayName) }] as MenuItem[]) : []),
                    ];
                    const seen = presenceLabel(m.presence);
                    return (
                      <ContextMenu key={m.userId} items={menu} title={m.displayName}>
                        <Row
                          title={m.displayName}
                          subtitle={seen ? `@${m.userName} · ${seen}` : `@${m.userName}`}
                          left={<Avatar name={m.displayName} imageKey={m.avatarKey} size={42} online={m.presence?.online ?? undefined} />}
                          right={
                            <View style={styles.rowRight}>
                              {narrow ? null : <Tag label={m.roleName} tone={m.baseKind === 'Player' ? 'neutral' : 'brand'} />}
                              <MoreButton items={menu} title={m.displayName} />
                            </View>
                          }
                          onPress={() => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: m.userName } })}
                        />
                      </ContextMenu>
                    );
                  })}
                </View>
              ))
            );
          }}
        </Loadable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  heroWrap: { width: '100%' },
  heroTop: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, marginTop: -44, marginBottom: 12, flexWrap: 'wrap' },
  identityWide: { maxWidth: 1320 },
  icon: { borderRadius: 28, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.background, ...shadow(colors, 2) },
  identityText: { flex: 1, minWidth: 180, gap: 6, marginTop: 52 },
  name: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginRight: 4 },
  pinned: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, marginBottom: 14 },
  pinnedWide: { maxWidth: 1320 },
  pinnedCompact: { maxWidth: '100%', marginBottom: 0, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  pinnedRow: { gap: 8 },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 340, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.brandSoft, borderLeftWidth: 3, borderLeftColor: colors.brand },
  pinHover: { opacity: 0.85 },
  pinText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.brandSoftText },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22, maxWidth: 900 },
  joinBox: { gap: 12 },
  joinButton: { alignSelf: 'flex-start' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabHover: { borderColor: colors.borderStrong },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandText },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  main: { flex: 2, minWidth: 0 },
  side: { flex: 1, minWidth: 360, maxWidth: 480, gap: 12 },
  sideHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  overview: { gap: 32 },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(colors, 1) },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  filter: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  filterOn: { backgroundColor: colors.brandSoft },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextOn: { color: colors.brandSoftText },
  chats: { padding: 12, gap: 8 },
  chatActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  group: { gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.sm },
  groupHeadHover: { backgroundColor: colors.surfaceAlt },
  groupTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  groupCount: { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: colors.textSubtle },
  groupEmpty: { fontSize: 13, color: colors.textSubtle, paddingHorizontal: 4, paddingBottom: 8, lineHeight: 18 },
  onOff: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  onPill: { backgroundColor: colors.brand },
  offPill: { backgroundColor: colors.surfaceAlt },
  onOffText: { fontSize: 11, fontWeight: '800' },
  onPillText: { color: colors.brandText },
  offPillText: { color: colors.textMuted },
  chatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8 },
  chatCell: { flexGrow: 1, flexBasis: 220, maxWidth: 340 },
  chatCellNarrow: { flexBasis: 160 },
  sticky: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, ...shadow(colors, 2), zIndex: 20 },
  stickyInner: { width: '100%', maxWidth: 1320, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  stickyName: { fontSize: 15, fontWeight: '700', color: colors.text, maxWidth: 200 },
  stickyTabs: { gap: 2, alignItems: 'center' },
  stickyTab: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  stickyTabActive: { borderBottomColor: colors.brand },
  stickyTabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  stickyTabTextActive: { color: colors.brand },
  groupHeader: { fontSize: 11, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, backgroundColor: colors.surfaceAlt },
  chapter: { padding: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  chapterActive: { backgroundColor: colors.surfaceAlt },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, fontFamily: 'Literata_600SemiBold' },
  chapterExcerpt: { fontSize: 14, color: colors.textMuted, lineHeight: 21, fontFamily: 'Literata_400Regular' },
  chapterMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chapterTime: { fontSize: 12, color: colors.textSubtle },
}));
