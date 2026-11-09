import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { Empty, Loadable, Page, Section } from '@/components/layout';
import { ProfileHeader } from '@/components/profile-header';
import { Button, colors } from '@/components/ui';

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

/** Global profile: the player across the platform, with the characters they chose to showcase. */
export default function GlobalProfileScreen() {
  const { userName } = useLocalSearchParams<{ userName: string }>();
  const router = useRouter();
  const profile = useQuery({
    queryKey: ['global-profile', userName],
    queryFn: () => unwrap(api.GET('/users/{userName}', { params: { path: { userName } } }), 'Usuário não encontrado.'),
  });

  return (
    <Page title="Perfil" back>
      <Loadable query={profile}>
        {(p) => (
          <>
            <ProfileHeader
              name={p.displayName}
              handle={p.userName}
              avatarKey={p.avatarKey}
              actions={p.isMe ? <View style={styles.edit}><Button title="Editar" variant="secondary" onPress={() => router.push('/perfil')} /></View> : undefined}
            />
            {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
            <Text style={styles.muted}>No Bookollab desde {monthYear.format(new Date(p.createdAt))}</Text>

            <Section title="Vitrine">
              {p.showcase.length === 0 ? (
                <Empty>{p.isMe ? 'Nenhum personagem na vitrine. Ative "Exibir no meu perfil global" num personagem.' : 'Nenhum personagem na vitrine.'}</Empty>
              ) : (
                <View style={styles.grid}>
                  {p.showcase.map((c) => (
                    <View key={c.id} style={styles.card}>
                      <Avatar name={c.name} imageKey={c.avatarKey} size={72} />
                      <Text style={styles.cardName} numberOfLines={1}>{c.name}</Text>
                      {c.communityName ? <Text style={styles.cardSub} numberOfLines={1}>{c.communityName}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
            </Section>
          </>
        )}
      </Loadable>
    </Page>
  );
}

const styles = StyleSheet.create({
  edit: { width: 100 },
  bio: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 13, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  card: { width: 140, alignItems: 'center', gap: 6, padding: 12, borderRadius: 12, backgroundColor: colors.background },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, maxWidth: '100%' },
  cardSub: { fontSize: 12, color: colors.textMuted, maxWidth: '100%' },
});
