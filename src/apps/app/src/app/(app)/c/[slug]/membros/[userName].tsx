import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Clapperboard, Globe, IdCard, Link2, NotebookPen, Pencil, UserMinus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { EntryTile } from '@/components/feed';
import { Empty, Loadable, Page, Row, Tag } from '@/components/layout';
import { NameChip } from '@/components/links';
import { MoreButton, useCopyLink, useMenu, type MenuItem } from '@/components/menu';
import { ProfileHero, StatRow, TabBar } from '@/components/profile-header';
import { presenceLabel } from '@/lib/date';
import { IconButton } from '@/components/ui';
import { makeStyles, radius, shadow } from '@/theme';

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

type Tab = 'sheets' | 'chapters' | 'scenes';

/**
 * A player's profile inside one community (Amino-like): cover, avatar, role and level, counters,
 * then tabs with their sheets, chapters and scenes.
 */
export default function CommunityProfileScreen() {
  const styles = useStyles();
  const { slug, userName } = useLocalSearchParams<{ slug: string; userName: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const copyLink = useCopyLink();
  const { openMenu, toast } = useMenu();
  const [tab, setTab] = useState<Tab>('sheets');
  const community = useQuery({ queryKey: ['community', slug], queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } })) });
  const canRemove = community.data?.me?.permissions.includes('ManageMembers') ?? false;
  const profile = useQuery({
    queryKey: ['community-profile', slug, userName],
    queryFn: () => unwrap(api.GET('/communities/{slug}/members/{userName}', { params: { path: { slug, userName } } }), 'Perfil não encontrado.'),
  });

  return (
    <Loadable query={profile}>
      {(p) => {
        const remove = async () => {
          const { response, error } = await api.POST('/communities/{slug}/members/{userId}/remove', { params: { path: { slug, userId: p.userId } } });
          if (!response.ok) {
            toast((error as { detail?: string } | undefined)?.detail ?? 'Não foi possível remover.');
            return;
          }
          toast(`${p.nickname} foi removido da comunidade`);
          await queryClient.invalidateQueries({ queryKey: ['members', slug] });
          router.replace({ pathname: '/c/[slug]', params: { slug } });
        };
        const menu: MenuItem[] = [
          { label: 'Editar meu perfil aqui', icon: Pencil, hidden: !p.isMe, onPress: () => router.push({ pathname: '/c/[slug]/perfil', params: { slug } }) },
          { label: 'Ver perfil global', icon: Globe, onPress: () => router.push({ pathname: '/u/[userName]', params: { userName: p.userName } }) },
          { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/c/${slug}/membros/${p.userName}`) },
          ...(!p.isMe && p.baseKind !== 'Owner' && canRemove
            ? (['separator', {
                label: 'Remover da comunidade',
                icon: UserMinus,
                danger: true,
                onPress: () => openMenu([{ label: `Remover ${p.nickname}`, icon: UserMinus, danger: true, onPress: () => void remove() }, { label: 'Cancelar', icon: X, onPress: () => undefined }], undefined, 'Tem certeza?'),
              }] as MenuItem[])
            : []),
        ];
        const sheetCount = p.characters.length + p.sheets.length;

        return (
          <Page
            title={p.nickname}
            hero={
              <ProfileHero
                name={p.nickname}
                handle={p.userName}
                avatarKey={p.avatarKey}
                coverKey={p.coverKey}
                badges={
                  <>
                    {presenceLabel(p.presence) ? <Tag label={presenceLabel(p.presence)!} tone={p.presence?.online ? 'live' : 'neutral'} /> : null}
                    <Tag label={p.roleName} tone={p.baseKind === 'Player' ? 'neutral' : 'brand'} />
                    <Tag label={p.level ? `Nível ${p.level}${p.title ? ` · ${p.title}` : ''}` : 'Nível em breve'} tone="neutral" />
                    <NameChip label={p.communityName} href={{ pathname: '/c/[slug]', params: { slug } }} />
                  </>
                }
                actions={
                  <>
                    {p.isMe ? <IconButton icon={Pencil} label="Editar meu perfil aqui" tone="onImage" onPress={() => router.push({ pathname: '/c/[slug]/perfil', params: { slug } })} /> : null}
                    <MoreButton items={menu} title={p.nickname} size={40} tone="onImage" />
                  </>
                }
              />
            }>
            {p.bio ? (
              <View style={styles.about}>
                <Text style={styles.aboutTitle}>Sobre</Text>
                <Text style={styles.bio}>{p.bio}</Text>
              </View>
            ) : null}
            <Text style={styles.muted}>{`Membro desde ${dateFmt.format(new Date(p.joinedAt))}`}</Text>

            <StatRow
              stats={[
                { label: 'Fichas', value: sheetCount, onPress: () => setTab('sheets') },
                { label: 'Capítulos', value: p.chapters.length, onPress: () => setTab('chapters') },
                { label: 'Cenas', value: p.scenes.length, onPress: () => setTab('scenes') },
              ]}
            />

            <TabBar<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'sheets', label: 'Fichas', icon: IdCard, count: sheetCount },
                { key: 'chapters', label: 'Capítulos', icon: NotebookPen, count: p.chapters.length },
                { key: 'scenes', label: 'Cenas', icon: Clapperboard, count: p.scenes.length },
              ]}
            />

            {tab === 'sheets' ? (
              sheetCount === 0 ? (
                <Empty icon={IdCard}>Nenhuma ficha nesta comunidade ainda.</Empty>
              ) : (
                <View style={styles.grid}>
                  {p.characters.map((c) => (
                    <View key={c.id} style={styles.tile}>
                      <EntryTile
                        entry={{ name: c.name, kind: 'Personagem', imageKey: c.avatarKey }}
                        menu={[
                          { label: 'Abrir ficha', icon: ArrowRight, onPress: () => router.push({ pathname: '/personagens/[id]', params: { id: c.id } }) },
                          { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/personagens/${c.id}`) },
                        ]}
                        onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: c.id } })}
                      />
                    </View>
                  ))}
                  {p.sheets.map((s) => (
                    <View key={s.id} style={styles.tile}>
                      <EntryTile
                        entry={{ name: s.name, kind: s.kind ?? 'Ficha', imageKey: s.imageKey }}
                        menu={[
                          { label: 'Abrir ficha', icon: ArrowRight, onPress: () => router.push({ pathname: '/fichas/[id]', params: { id: s.id } }) },
                          { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/fichas/${s.id}`) },
                        ]}
                        onPress={() => router.push({ pathname: '/fichas/[id]', params: { id: s.id } })}
                      />
                    </View>
                  ))}
                </View>
              )
            ) : null}

            {tab === 'chapters' ? (
              <View style={styles.panel}>
                {p.chapters.length === 0 ? (
                  <Empty icon={NotebookPen}>Nenhum capítulo publicado.</Empty>
                ) : (
                  p.chapters.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: c.id } })}
                      style={({ hovered, pressed }) => [styles.chapter, (hovered || pressed) && styles.chapterActive]}>
                      <Text style={styles.chapterTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.muted}>{`${c.characterName}${c.publishedAt ? ` · ${dateFmt.format(new Date(c.publishedAt))}` : ''}`}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {tab === 'scenes' ? (
              <View style={styles.panel}>
                {p.scenes.length === 0 ? (
                  <Empty icon={Clapperboard}>Ainda não participou de cenas.</Empty>
                ) : (
                  p.scenes.map((s) => (
                    <Row
                      key={s.id}
                      icon={Clapperboard}
                      title={s.title}
                      subtitle={dateFmt.format(new Date(s.createdAt))}
                      right={s.status === 'Open' ? <Tag label="Ao vivo" tone="live" /> : <Tag label="Encerrada" tone="neutral" />}
                      onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })}
                    />
                  ))
                )}
              </View>
            ) : null}
          </Page>
        );
      }}
    </Loadable>
  );
}

const useStyles = makeStyles((colors) => ({
  about: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 6 },
  aboutTitle: { fontSize: 12, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.5 },
  bio: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 13, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: { width: 128 },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(colors, 1) },
  chapter: { padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  chapterActive: { backgroundColor: colors.surfaceAlt },
  chapterTitle: { fontSize: 17, color: colors.text, fontFamily: 'Literata_600SemiBold' },
}));
