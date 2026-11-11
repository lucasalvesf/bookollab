import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight,
  BookMarked,
  ChevronLeft,
  Clapperboard,
  Clock,
  LayoutGrid,
  LayoutTemplate,
  PenSquare,
  Link2,
  NotebookPen,
  Plus,
  Radio,
  Reply,
  Search,
  Settings,
  UserMinus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, type ViewInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Avatar } from '@/components/avatar';
import { CommunityCover } from '@/components/community';
import { FEED_LAYOUTS } from '@/components/community-admin';
import { FeaturedShowcase, ManageFeaturedModal, PostAuthorChip, PostFeed, type FeedLayout } from '@/components/community-feed';
import { useCommunityMenu } from '@/components/community-menu';
import { useFeatureMenu } from '@/components/links';
import { Carousel, EntryTile, FeedSection, SceneCard } from '@/components/feed';
import { Empty, Loadable, Page, Row, Tag } from '@/components/layout';
import { ContextMenu, MoreButton, useCopyLink, useMenu, type MenuItem } from '@/components/menu';
import { Button, IconButton, Notice } from '@/components/ui';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

type SectionKey = 'overview' | 'scenes' | 'chapters' | 'encyclopedia' | 'characters' | 'members';
type Community = components['schemas']['CommunityDetail'];
type Post = components['schemas']['ChapterSummary'];

const SECTIONS: Record<SectionKey, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Visão geral', icon: LayoutGrid },
  scenes: { label: 'Cenas', icon: Clapperboard },
  chapters: { label: 'Posts', icon: NotebookPen },
  encyclopedia: { label: 'Enciclopédia', icon: BookMarked },
  characters: { label: 'Personagens', icon: UserRound },
  members: { label: 'Membros', icon: Users },
};
const STAFF = ['ManageMembers', 'CreateInvites', 'ManageCommunity', 'ModerateContent', 'ArrangeSections'];

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Community home (Amino-like): cover and identity, then the sections in the order chosen by the owner. */
export default function CommunityScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const communityMenu = useCommunityMenu();
  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } }), 'Comunidade não encontrada.'),
  });
  const [tab, setTab] = useState<SectionKey>();
  const [scrolled, setScrolled] = useState(false);
  const join = useMutation({
    mutationFn: () => unwrap(api.POST('/communities/{slug}/join', { params: { path: { slug } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community', slug] });
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });

  return (
    <Loadable query={community}>
      {(c) => {
        const perms = new Set(c.me?.permissions ?? []);
        const isStaff = STAFF.some((p) => perms.has(p));
        const order = (c.sections ?? Object.keys(SECTIONS)).filter((s): s is SectionKey => s in SECTIONS);
        const current = tab && order.includes(tab) ? tab : order[0];
        const menu = communityMenu({ slug: c.slug, name: c.name, myPermissions: c.me?.permissions }, !!c.me);
        const hero = (
          <View style={styles.heroWrap}>
            <CommunityCover name={c.name} coverKey={c.coverKey} height={190}>
              <View style={styles.heroTop}>
                <IconButton icon={ChevronLeft} label="Voltar" tone="onImage" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
                <View style={styles.flex} />
                {isStaff ? <IconButton icon={Settings} label="Moderação e configurações" tone="onImage" onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug } })} /> : null}
                <MoreButton items={menu} title={c.name} size={40} tone="onImage" />
              </View>
            </CommunityCover>
            <ContextMenu items={menu} title={c.name} style={styles.identity}>
              <View style={styles.icon}>
                <Avatar name={c.name} imageKey={c.iconKey} size={84} shape="rounded" />
              </View>
              <View style={styles.identityText}>
                <Text style={styles.name}>{c.name}</Text>
                <View style={styles.metaRow}>
                  <Users size={14} color={colors.textSubtle} />
                  <Text style={styles.meta}>{`${c.memberCount} ${c.memberCount === 1 ? 'membro' : 'membros'}`}</Text>
                  <Tag label={labels.joinPolicy[c.joinPolicy]} tone="neutral" />
                  {c.me ? <Tag label={c.me.roleName} /> : null}
                </View>
              </View>
            </ContextMenu>
          </View>
        );

        return (
          <Page
            title={c.name}
            hero={hero}
            onScroll={(y) => setScrolled(y > 250)}
            overlay={
              scrolled ? (
                <StickyHeader community={c} order={c.me ? order : []} current={current} onTab={setTab} isStaff={isStaff} />
              ) : null
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
                  {order.map((key) => {
                    const s = SECTIONS[key];
                    const active = key === current;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => setTab(key)}
                        style={({ hovered }) => [styles.tab, active && styles.tabActive, hovered && !active && styles.tabHover]}>
                        <s.icon size={16} color={active ? colors.brandText : colors.textMuted} strokeWidth={2.2} />
                        <Text style={[styles.tabText, active && styles.tabTextActive]}>{s.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {current === 'overview' ? (
                  <Overview community={c} onSeeAll={setTab} />
                ) : (
                  <SectionList key={current} section={current} community={c} perms={perms} />
                )}
              </>
            )}
          </Page>
        );
      }}
    </Loadable>
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

/** Compact header that sticks to the top once the cover scrolls away: identity + tabs. */
function StickyHeader({ community: c, order, current, onTab, isStaff }: { community: Community; order: SectionKey[]; current: SectionKey; onTab: (k: SectionKey) => void; isStaff: boolean }) {
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
                <Text style={[styles.stickyTabText, active && styles.stickyTabTextActive]}>{SECTIONS[key].label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {isStaff ? <IconButton icon={Settings} label="Moderação e configurações" size={34} onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug: c.slug } })} /> : null}
      </View>
    </Animated.View>
  );
}

/** First tab: highlights of every section, each with "Ver mais" (Amino's community front page). */
function Overview({ community: c, onSeeAll }: { community: Community; onSeeAll: (s: SectionKey) => void }) {
  const styles = useStyles();
  const router = useRouter();
  const copyLink = useCopyLink();
  const { openMenu } = useMenu();
  const slug = c.slug;
  const perms = new Set(c.me?.permissions ?? []);
  const canFeature = perms.has('ModerateContent');
  const featureMenu = useFeatureMenu(slug, canFeature);
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
  const live = (scenes.data ?? []).filter((s) => s.status === 'Open').slice(0, 10);
  const entries = (encyclopedia.data?.items ?? []).slice(0, 14);

  return (
    <View style={styles.overview}>
      <FeaturedShowcase items={featured.data ?? []} onManage={canFeature ? () => setManaging(true) : undefined} />
      {managing ? <ManageFeaturedModal slug={slug} items={featured.data ?? []} onClose={() => setManaging(false)} /> : null}
      <FeedSection
        title="Últimos posts"
        icon={NotebookPen}
        onSeeAll={() => onSeeAll('chapters')}
        actions={
          <View style={styles.rowRight}>
            {perms.has('ManageCommunity') ? (
              <IconButton
                icon={LayoutTemplate}
                label="Layout dos posts"
                size={34}
                onPress={() => openMenu(layoutMenu, undefined, 'Layout dos posts')}
              />
            ) : null}
            {perms.has('WriteChapters') ? <WriteButton slug={slug} /> : null}
          </View>
        }>
        <PostFeed
          posts={published}
          slug={slug}
          layout={c.feedLayout ?? 'Highlight'}
          menuFor={postMenu}
          onOpen={(p) => router.push({ pathname: '/capitulos/[id]', params: { id: p.id } })}
        />
      </FeedSection>
      <FeedSection title="Cenas ao vivo" icon={Radio} onSeeAll={() => onSeeAll('scenes')}>
        {live.length ? (
          <Carousel itemWidth={220}>
            {live.map((s) => (
              <SceneCard
                key={s.id}
                scene={s}
                menu={[
                  { label: 'Abrir cena', icon: ArrowRight, onPress: () => router.push({ pathname: '/cenas/[id]', params: { id: s.id } }) },
                  { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/cenas/${s.id}`) },
                ]}
                onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })}
              />
            ))}
          </Carousel>
        ) : (
          <Empty icon={Radio}>Nenhuma cena aberta agora.</Empty>
        )}
      </FeedSection>
      <FeedSection title="Da enciclopédia" icon={BookMarked} onSeeAll={() => router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug } })}>
        {entries.length ? (
          <Carousel itemWidth={124}>
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

/** One list section with its own search, primary action and per-item menus. */
function SectionList({ section, community: c, perms }: { section: Exclude<SectionKey, 'overview'>; community: Community; perms: Set<string> }) {
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
  const q = normalize(term.trim());
  const match = (...parts: (string | null | undefined)[]) => !q || normalize(parts.filter(Boolean).join(' ')).includes(q);

  const characters = useQuery({
    queryKey: ['characters', slug],
    enabled: section === 'characters',
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug }, query: {} } })),
  });
  const members = useQuery({ queryKey: ['members', slug], enabled: section === 'members', queryFn: () => unwrap(api.GET('/communities/{slug}/members', { params: { path: { slug } } })) });
  const scenes = useQuery({ queryKey: ['scenes', slug], enabled: section === 'scenes', queryFn: () => unwrap(api.GET('/communities/{slug}/scenes', { params: { path: { slug } } })) });
  const chapters = useQuery({
    queryKey: ['chapters', slug],
    enabled: section === 'chapters',
    queryFn: () => unwrap(api.GET('/communities/{slug}/chapters', { params: { path: { slug }, query: {} } })),
  });

  const removeMember = async (userId: string, name: string) => {
    const { response, error } = await api.POST('/communities/{slug}/members/{userId}/remove', { params: { path: { slug, userId } } });
    toast(response.ok ? `${name} foi removido da comunidade` : ((error as { detail?: string } | undefined)?.detail ?? 'Não foi possível remover.'));
    if (response.ok) void queryClient.invalidateQueries({ queryKey: ['members', slug] });
  };

  const config = useMemo(() => {
    switch (section) {
      case 'scenes':
        return { placeholder: 'Buscar cenas', action: perms.has('OpenScenes') ? { title: 'Abrir cena', go: () => router.push({ pathname: '/c/[slug]/cenas/nova', params: { slug } }) } : null };
      case 'chapters':
        return { placeholder: 'Buscar posts', action: null };
      case 'characters':
        return { placeholder: 'Buscar personagens', action: perms.has('CreateCharacters') ? { title: 'Novo personagem', go: () => router.push({ pathname: '/c/[slug]/personagens/novo', params: { slug } }) } : null };
      case 'members':
        return { placeholder: 'Buscar membros', action: null };
      case 'encyclopedia':
        return { placeholder: '', action: null };
    }
  }, [section, perms, router, slug]);

  if (section === 'encyclopedia') {
    return (
      <View style={styles.panel}>
        <View style={styles.encyclopedia}>
          <Empty icon={BookMarked}>Personagens, lugares, facções e tudo do mundo da comunidade, organizado em pastas pela moderação.</Empty>
          <View style={styles.center}>
            <Button title="Abrir a enciclopédia" icon={BookMarked} onPress={() => router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug } })} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Search size={16} color={colors.textSubtle} />
          <TextInput value={term} onChangeText={setTerm} placeholder={config.placeholder} placeholderTextColor={colors.textSubtle} style={styles.searchInput} accessibilityLabel={config.placeholder} />
          {term ? (
            <Pressable onPress={() => setTerm('')} accessibilityLabel="Limpar busca" hitSlop={8}>
              <X size={14} color={colors.textSubtle} />
            </Pressable>
          ) : null}
        </View>
        {config.action ? <Button title={config.action.title} icon={Plus} size="sm" onPress={config.action.go} /> : null}
        {section === 'chapters' && perms.has('WriteChapters') ? <WriteButton slug={slug} /> : null}
      </View>

      {section === 'scenes' ? (
        <Loadable query={scenes}>
          {(list) => {
            const items = list.filter((s) => match(s.title, s.description, s.openedByUserName));
            return items.length === 0 ? (
              <Empty icon={Clapperboard}>{q ? 'Nenhuma cena encontrada.' : 'Nenhuma cena ainda. Que tal abrir a primeira?'}</Empty>
            ) : (
              items.map((s) => {
                const menu: MenuItem[] = [
                  { label: 'Abrir cena', icon: ArrowRight, onPress: () => router.push({ pathname: '/cenas/[id]', params: { id: s.id } }) },
                  { label: 'Escrever o capítulo da cena', icon: NotebookPen, hidden: s.status === 'Open', onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug, sceneId: s.id } }) },
                  'separator',
                  { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/cenas/${s.id}`) },
                ];
                return (
                  <ContextMenu key={s.id} items={menu} title={s.title}>
                    <Row
                      icon={Clapperboard}
                      title={s.title}
                      subtitle={`${s.participantCount} ${s.participantCount === 1 ? 'personagem' : 'personagens'} · por @${s.openedByUserName}`}
                      right={
                        <View style={styles.rowRight}>
                          {s.status === 'Open' ? <Tag label="Ao vivo" tone="live" /> : <Tag label="Encerrada" tone="neutral" />}
                          <MoreButton items={menu} title={s.title} />
                        </View>
                      }
                      onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })}
                    />
                  </ContextMenu>
                );
              })
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
            return items.length === 0 ? (
              <>
                {filters}
                <Empty icon={NotebookPen}>{q || kind !== 'all' ? 'Nenhum post encontrado.' : 'Nenhum post ainda.'}</Empty>
              </>
            ) : (
              <>
              {filters}
              {items.map((ch) => {
                const menu: MenuItem[] = [
                  { label: ch.kind === 'Blog' ? 'Ler blog' : 'Ler capítulo', icon: ArrowRight, onPress: () => router.push({ pathname: '/capitulos/[id]', params: { id: ch.id } }) },
                  {
                    label: 'Responder com um capítulo',
                    icon: Reply,
                    hidden: ch.status !== 'Published',
                    onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug, replyTo: ch.id, ...(ch.characterId ? { mention: ch.characterId } : {}) } }),
                  },
                  ...(ch.status === 'Published' ? featureMenu('Post', ch.id) : []),
                  'separator',
                  { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/capitulos/${ch.id}`) },
                ];
                return (
                  <ContextMenu key={ch.id} items={menu} title={ch.title}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: ch.id } })}
                      style={({ hovered, pressed }) => [styles.chapter, (hovered || pressed) && styles.chapterActive]}>
                      <View style={styles.chapterHead}>
                        <Text style={styles.chapterTitle} numberOfLines={1}>{ch.title}</Text>
                        {ch.status === 'Draft' ? (
                          <Tag label="Rascunho" tone="neutral" />
                        ) : ch.status === 'Pending' ? (
                          <Tag label="Aguardando aprovação" tone="warning" />
                        ) : ch.status === 'Rejected' ? (
                          <Tag label="Recusado" tone="danger" />
                        ) : null}
                        <MoreButton items={menu} title={ch.title} />
                      </View>
                      <Text style={styles.chapterExcerpt} numberOfLines={3}>{ch.excerpt}</Text>
                      <View style={styles.chapterMeta}>
                        <PostAuthorChip post={ch} slug={slug} />
                        {ch.kind === 'Blog' ? <Tag label="Blog" tone="warning" /> : null}
                        <Clock size={12} color={colors.textSubtle} />
                        <Text style={styles.chapterTime}>{new Date(ch.publishedAt ?? ch.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                      </View>
                    </Pressable>
                  </ContextMenu>
                );
              })}
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
                    <Row
                      title={ch.name}
                      subtitle={`de @${ch.ownerUserName}`}
                      left={<Avatar name={ch.name} imageKey={ch.avatarKey} size={42} />}
                      right={<MoreButton items={menu} title={ch.name} />}
                      onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: ch.id } })}
                    />
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
            // Grouped by role, highest first, like Discord's member list ("Staff — 2").
            const rank: Record<string, number> = { Owner: 0, Staff: 1, Narrator: 2, Custom: 3, Player: 4 };
            const groups = new Map<string, typeof items>();
            for (const m of [...items].sort((a, b) => (rank[a.baseKind] ?? 9) - (rank[b.baseKind] ?? 9) || a.displayName.localeCompare(b.displayName, 'pt-BR')))
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
                  ...(perms.has('ManageMembers') && m.baseKind !== 'Owner'
                    ? (['separator', { label: 'Remover da comunidade', icon: UserMinus, danger: true, onPress: () => void removeMember(m.userId, m.displayName) }] as MenuItem[])
                    : []),
                ];
                return (
                  <ContextMenu key={m.userId} items={menu} title={m.displayName}>
                    <Row
                      title={m.displayName}
                      subtitle={`@${m.userName}`}
                      left={<Avatar name={m.displayName} imageKey={m.avatarKey} size={42} />}
                      right={
                        <View style={styles.rowRight}>
                          <Tag label={m.roleName} tone={m.baseKind === 'Player' ? 'neutral' : 'brand'} />
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
  center: { alignItems: 'center' },
  heroWrap: { width: '100%' },
  heroTop: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, marginTop: -42, marginBottom: 12, flexWrap: 'wrap' },
  icon: { borderRadius: 28, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.background, ...shadow(colors, 2) },
  identityText: { flex: 1, minWidth: 180, gap: 6, marginTop: 52 },
  name: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '500', marginRight: 4 },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  joinBox: { gap: 12 },
  joinButton: { alignSelf: 'flex-start' },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabHover: { borderColor: colors.borderStrong },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandText },
  overview: { gap: 28, marginTop: -4 },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: -8, ...shadow(colors, 1) },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  filter: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  filterOn: { backgroundColor: colors.brandSoft },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextOn: { color: colors.brandSoftText },
  sticky: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, ...shadow(colors, 2), zIndex: 20 },
  stickyInner: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  stickyName: { fontSize: 15, fontWeight: '700', color: colors.text, maxWidth: 180 },
  stickyTabs: { gap: 2, alignItems: 'center' },
  stickyTab: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  stickyTabActive: { borderBottomColor: colors.brand },
  stickyTabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  stickyTabTextActive: { color: colors.brand },
  groupHeader: { fontSize: 11, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, backgroundColor: colors.surfaceAlt },
  encyclopedia: { padding: 16, gap: 8 },
  chapter: { padding: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  chapterActive: { backgroundColor: colors.surfaceAlt },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, fontFamily: 'Literata_600SemiBold' },
  chapterExcerpt: { fontSize: 14, color: colors.textMuted, lineHeight: 21, fontFamily: 'Literata_400Regular' },
  chapterMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapterAuthor: { fontSize: 12, fontWeight: '600', color: colors.brand, marginRight: 4 },
  chapterTime: { fontSize: 12, color: colors.textSubtle },
}));
