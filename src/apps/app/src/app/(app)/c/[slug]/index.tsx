import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookMarked, ChevronLeft, Clapperboard, Clock, NotebookPen, Plus, Shield, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { CommunityCover } from '@/components/community';
import { Empty, Loadable, Page, Row, Tag } from '@/components/layout';
import { Button, IconButton, Notice } from '@/components/ui';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

type SectionKey = 'scenes' | 'chapters' | 'encyclopedia' | 'characters' | 'members';

const SECTIONS: Record<SectionKey, { label: string; icon: LucideIcon }> = {
  scenes: { label: 'Cenas', icon: Clapperboard },
  chapters: { label: 'Capítulos', icon: NotebookPen },
  encyclopedia: { label: 'Enciclopédia', icon: BookMarked },
  characters: { label: 'Personagens', icon: UserRound },
  members: { label: 'Membros', icon: Users },
};

/** Community home (Amino-like): cover, icon, then the sections in the order chosen by the owner. */
export default function CommunityScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } }), 'Comunidade não encontrada.'),
  });
  const [tab, setTab] = useState<SectionKey>();
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
        const isStaff = ['ManageMembers', 'CreateInvites', 'ManageCommunity', 'ModerateContent', 'ArrangeSections'].some((p) => perms.has(p));
        const order = (c.sections ?? Object.keys(SECTIONS)).filter((s): s is SectionKey => s in SECTIONS);
        const current = tab && order.includes(tab) ? tab : order[0];
        const hero = (
          <View style={styles.heroWrap}>
            <CommunityCover name={c.name} coverKey={c.coverKey} height={200}>
              <View style={styles.heroTop}>
                <IconButton icon={ChevronLeft} label="Voltar" tone="onImage" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
              </View>
            </CommunityCover>
            <View style={styles.identity}>
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
            </View>
          </View>
        );

        return (
          <Page title={c.name} hero={hero}>
            {c.description ? <Text style={styles.description}>{c.description}</Text> : null}

            {!c.me ? (
              <View style={styles.joinBox}>
                {join.isError ? <Notice kind="error">{join.error.message}</Notice> : null}
                {c.hasPendingRequest || join.data?.status === 'pending' ? (
                  <Notice kind="info">Seu pedido de entrada foi enviado. Aguarde a aprovação da staff.</Notice>
                ) : c.joinPolicy === 'InviteOnly' ? (
                  <Notice kind="info">Esta comunidade só aceita membros por convite.</Notice>
                ) : (
                  <Button title={c.joinPolicy === 'Open' ? 'Entrar na comunidade' : 'Pedir para entrar'} icon={Plus} onPress={() => join.mutate()} loading={join.isPending} />
                )}
              </View>
            ) : (
              <>
                <View style={styles.quick}>
                  {me.data ? (
                    <Button
                      title="Meu perfil aqui"
                      icon={UserRound}
                      size="sm"
                      variant="secondary"
                      onPress={() => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: me.data!.userName } })}
                    />
                  ) : null}
                  {isStaff ? <Button title="Área da staff" icon={Shield} size="sm" variant="secondary" onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug } })} /> : null}
                </View>

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

                <View style={styles.panel}>
                  <SectionContent section={current} slug={slug} perms={perms} />
                </View>
              </>
            )}
          </Page>
        );
      }}
    </Loadable>
  );
}

function SectionContent({ section, slug, perms }: { section: SectionKey; slug: string; perms: Set<string> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
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

  const action = (title: string, onPress: () => void) => (
    <View style={styles.panelAction}>
      <Button title={title} icon={Plus} size="sm" onPress={onPress} />
    </View>
  );

  switch (section) {
    case 'scenes':
      return (
        <>
          {perms.has('OpenScenes') ? action('Abrir cena', () => router.push({ pathname: '/c/[slug]/cenas/nova', params: { slug } })) : null}
          <Loadable query={scenes}>
            {(list) =>
              list.length === 0 ? (
                <Empty icon={Clapperboard}>Nenhuma cena ainda. Que tal abrir a primeira?</Empty>
              ) : (
                list.map((s) => (
                  <Row
                    key={s.id}
                    icon={Clapperboard}
                    title={s.title}
                    subtitle={`${s.participantCount} ${s.participantCount === 1 ? 'personagem' : 'personagens'} · por @${s.openedByUserName}`}
                    right={s.status === 'Open' ? <Tag label="Ao vivo" tone="live" /> : <Tag label="Encerrada" tone="neutral" />}
                    onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })}
                  />
                ))
              )
            }
          </Loadable>
        </>
      );
    case 'chapters':
      return (
        <>
          {perms.has('WriteChapters') ? action('Escrever capítulo', () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug } })) : null}
          <Loadable query={chapters}>
            {(list) =>
              list.length === 0 ? (
                <Empty icon={NotebookPen}>Nenhum capítulo ainda.</Empty>
              ) : (
                list.map((ch) => (
                  <Pressable
                    key={ch.id}
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
                    </View>
                    <Text style={styles.chapterExcerpt} numberOfLines={3}>{ch.excerpt}</Text>
                    <View style={styles.chapterMeta}>
                      <Text style={styles.chapterAuthor}>{ch.characterName}</Text>
                      <Clock size={12} color={colors.textSubtle} />
                      <Text style={styles.chapterTime}>{new Date(ch.publishedAt ?? ch.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                    </View>
                  </Pressable>
                ))
              )
            }
          </Loadable>
        </>
      );
    case 'encyclopedia':
      return (
        <View style={styles.encyclopedia}>
          <Empty icon={BookMarked}>Personagens, lugares, facções e tudo do mundo da comunidade, organizado em pastas pela staff.</Empty>
          <Button title="Abrir a enciclopédia" icon={BookMarked} onPress={() => router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug } })} />
        </View>
      );
    case 'characters':
      return (
        <>
          {perms.has('CreateCharacters') ? action('Novo personagem', () => router.push({ pathname: '/c/[slug]/personagens/novo', params: { slug } })) : null}
          <Loadable query={characters}>
            {(list) =>
              list.length === 0 ? (
                <Empty icon={UserRound}>Nenhum personagem ainda.</Empty>
              ) : (
                list.map((ch) => (
                  <Row
                    key={ch.id}
                    title={ch.name}
                    subtitle={`de @${ch.ownerUserName}`}
                    left={<Avatar name={ch.name} imageKey={ch.avatarKey} size={42} />}
                    onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: ch.id } })}
                  />
                ))
              )
            }
          </Loadable>
        </>
      );
    case 'members':
      return (
        <Loadable query={members}>
          {(list) =>
            list.map((m) => (
              <Row
                key={m.userId}
                title={m.displayName}
                subtitle={`@${m.userName}`}
                left={<Avatar name={m.displayName} imageKey={m.avatarKey} size={42} />}
                right={<Tag label={m.roleName} tone={m.baseKind === 'Player' ? 'neutral' : 'brand'} />}
                onPress={() => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: m.userName } })}
              />
            ))
          }
        </Loadable>
      );
  }
}

const useStyles = makeStyles((colors) => ({
  heroWrap: { width: '100%' },
  heroTop: { position: 'absolute', top: 16, left: 16 },
  identity: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, marginTop: -42, marginBottom: 12, flexWrap: 'wrap' },
  icon: { borderRadius: 28, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.background, ...shadow(colors, 2) },
  identityText: { flex: 1, minWidth: 180, gap: 6, marginTop: 52 },
  name: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '500', marginRight: 4 },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  joinBox: { gap: 12 },
  quick: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabHover: { borderColor: colors.borderStrong },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brandText },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: -8, ...shadow(colors, 1) },
  panelAction: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'flex-start' },
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
