import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Compass, Plus, Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import { CardGrid, CommunityCard } from '@/components/community';
import { Empty, Loadable, Page, Section, Tag } from '@/components/layout';
import { Button } from '@/components/ui';
import { makeStyles } from '@/theme';

export default function HomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const mine = useQuery({ queryKey: ['my-communities'], queryFn: () => unwrap(api.GET('/me/communities')) });
  const firstName = me.data?.displayName.split(' ')[0];

  return (
    <Page title={firstName ? `Olá, ${firstName}` : 'Bookollab'} subtitle="Para onde a história vai hoje?">
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Criar comunidade" icon={Plus} onPress={() => router.push('/comunidades/nova')} />
        </View>
        <View style={styles.action}>
          <Button title="Descobrir comunidades" icon={Compass} variant="secondary" onPress={() => router.push('/descobrir')} />
        </View>
      </View>
      <Section title="Minhas comunidades" icon={Sparkles} plain>
        <Loadable query={mine}>
          {(list) =>
            list.length === 0 ? (
              <View style={styles.emptyCard}>
                <Empty icon={Compass}>Você ainda não participa de nenhuma comunidade. Crie a sua ou descubra uma para entrar.</Empty>
              </View>
            ) : (
              <CardGrid>
                {list.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    right={c.joinPolicy !== 'Open' ? <Tag label={labels.joinPolicy[c.joinPolicy]} tone="neutral" /> : undefined}
                    onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } })}
                  />
                ))}
              </CardGrid>
            )
          }
        </Loadable>
      </Section>
      {me.data ? <Text style={styles.handle}>{`Conectado como @${me.data.userName}`}</Text> : null}
    </Page>
  );
}

const useStyles = makeStyles((colors) => ({
  actions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  action: { flexGrow: 1, minWidth: 200 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  handle: { fontSize: 13, color: colors.textSubtle, textAlign: 'center' },
}));
