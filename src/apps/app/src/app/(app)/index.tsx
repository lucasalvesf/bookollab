import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import { useSession } from '@/auth/session';
import { Empty, Loadable, Page, Row, Section } from '@/components/layout';
import { Button } from '@/components/ui';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const mine = useQuery({ queryKey: ['my-communities'], queryFn: () => unwrap(api.GET('/me/communities')) });

  return (
    <Page
      title={me.data ? `Olá, ${me.data.displayName}!` : 'Bookollab'}
      subtitle={me.data ? `@${me.data.userName}` : undefined}
      actions={
        <View style={styles.signOut}>
          <Button title="Sair" variant="secondary" onPress={signOut} />
        </View>
      }>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Criar comunidade" onPress={() => router.push('/comunidades/nova')} />
        </View>
        <View style={styles.action}>
          <Button title="Descobrir comunidades" variant="secondary" onPress={() => router.push('/descobrir')} />
        </View>
      </View>
      <Section title="Minhas comunidades">
        <Loadable query={mine}>
          {(list) =>
            list.length === 0 ? (
              <Empty>Você ainda não participa de nenhuma comunidade. Crie a sua ou descubra uma aberta.</Empty>
            ) : (
              list.map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  subtitle={`${c.memberCount} ${c.memberCount === 1 ? 'membro' : 'membros'} · ${labels.joinPolicy[c.joinPolicy]}`}
                  onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } })}
                />
              ))
            )
          }
        </Loadable>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  signOut: { width: 100 },
  actions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  action: { flexGrow: 1, minWidth: 200 },
});
