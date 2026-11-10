import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Compass, Link2, Pencil, Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { EntryTile } from '@/components/feed';
import { Empty, Loadable, Page, Section } from '@/components/layout';
import { MoreButton, useCopyLink, type MenuItem } from '@/components/menu';
import { ProfileHero, StatRow } from '@/components/profile-header';
import { IconButton } from '@/components/ui';
import { makeStyles, radius } from '@/theme';

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

/** Global profile: the player across the platform, with the characters they chose to showcase. */
export default function GlobalProfileScreen() {
  const styles = useStyles();
  const { userName } = useLocalSearchParams<{ userName: string }>();
  const router = useRouter();
  const copyLink = useCopyLink();
  const profile = useQuery({
    queryKey: ['global-profile', userName],
    queryFn: () => unwrap(api.GET('/users/{userName}', { params: { path: { userName } } }), 'Usuário não encontrado.'),
  });

  return (
    <Loadable query={profile}>
      {(p) => {
        const menu: MenuItem[] = [
          { label: 'Editar meu perfil', icon: Pencil, hidden: !p.isMe, onPress: () => router.push('/perfil') },
          { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/u/${p.userName}`) },
        ];
        const communities = new Set(p.showcase.map((c) => c.communitySlug).filter(Boolean)).size;
        return (
          <Page
            title={p.displayName}
            hero={
              <ProfileHero
                name={p.displayName}
                handle={p.userName}
                avatarKey={p.avatarKey}
                actions={
                  <>
                    {p.isMe ? <IconButton icon={Pencil} label="Editar meu perfil" tone="onImage" onPress={() => router.push('/perfil')} /> : null}
                    <MoreButton items={menu} title={`@${p.userName}`} size={40} tone="onImage" />
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
            <Text style={styles.muted}>{`No Bookollab desde ${monthYear.format(new Date(p.createdAt))}`}</Text>
            <StatRow
              stats={[
                { label: 'Na vitrine', value: p.showcase.length },
                { label: 'Comunidades na vitrine', value: communities },
              ]}
            />
            <Section title="Vitrine" icon={Sparkles} plain>
              {p.showcase.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Empty icon={Sparkles}>{p.isMe ? 'Nenhum personagem na vitrine. Ative "Exibir no meu perfil global" num personagem.' : 'Nenhum personagem na vitrine.'}</Empty>
                </View>
              ) : (
                <View style={styles.grid}>
                  {p.showcase.map((c) => (
                    <View key={c.id} style={styles.tile}>
                      <EntryTile
                        entry={{ name: c.name, kind: c.communityName ?? 'Personagem', imageKey: c.avatarKey }}
                        menu={[
                          { label: 'Abrir ficha', icon: ArrowRight, onPress: () => router.push({ pathname: '/personagens/[id]', params: { id: c.id } }) },
                          { label: 'Abrir a comunidade', icon: Compass, hidden: !c.communitySlug, onPress: () => router.push({ pathname: '/c/[slug]', params: { slug: c.communitySlug! } }) },
                          { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/personagens/${c.id}`) },
                        ]}
                        onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: c.id } })}
                      />
                    </View>
                  ))}
                </View>
              )}
            </Section>
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
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
}));
