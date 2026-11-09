import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { Empty, Loadable, Page, Row, Section, Tag } from '@/components/layout';
import { Button, colors, Notice } from '@/components/ui';

export default function CommunityScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } }), 'Comunidade não encontrada.'),
  });
  const isMember = !!community.data?.me;
  const characters = useQuery({
    queryKey: ['characters', slug],
    enabled: isMember,
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug }, query: {} } })),
  });
  const members = useQuery({
    queryKey: ['members', slug],
    enabled: isMember,
    queryFn: () => unwrap(api.GET('/communities/{slug}/members', { params: { path: { slug } } })),
  });
  const scenes = useQuery({
    queryKey: ['scenes', slug],
    enabled: isMember,
    queryFn: () => unwrap(api.GET('/communities/{slug}/scenes', { params: { path: { slug } } })),
  });
  const chapters = useQuery({
    queryKey: ['chapters', slug],
    enabled: isMember,
    queryFn: () => unwrap(api.GET('/communities/{slug}/chapters', { params: { path: { slug }, query: {} } })),
  });
  const join = useMutation({
    mutationFn: () => unwrap(api.POST('/communities/{slug}/join', { params: { path: { slug } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
      queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });

  return (
    <Loadable query={community}>
      {(c) => {
        const perms = new Set(c.me?.permissions ?? []);
        const isStaff = perms.has('ManageMembers') || perms.has('CreateInvites') || perms.has('ManageCommunity');
        return (
          <Page
            title={c.name}
            subtitle={`${c.memberCount} ${c.memberCount === 1 ? 'membro' : 'membros'} · ${labels.joinPolicy[c.joinPolicy]}`}
            back
            actions={c.me ? <Tag label={c.me.roleName} /> : undefined}>
            {c.description ? <Text style={styles.description}>{c.description}</Text> : null}

            {!c.me ? (
              <View style={styles.joinBox}>
                {join.isError ? <Notice kind="error">{join.error.message}</Notice> : null}
                {c.hasPendingRequest || join.data?.status === 'pending' ? (
                  <Notice kind="info">Seu pedido de entrada foi enviado. Aguarde a aprovação da staff.</Notice>
                ) : c.joinPolicy === 'InviteOnly' ? (
                  <Notice kind="info">Esta comunidade só aceita membros por convite.</Notice>
                ) : (
                  <Button title={c.joinPolicy === 'Open' ? 'Entrar na comunidade' : 'Pedir para entrar'} onPress={() => join.mutate()} loading={join.isPending} />
                )}
              </View>
            ) : (
              <>
                <View style={styles.topActions}>
                  <View style={styles.topAction}>
                    <Button title="📚 Enciclopédia" onPress={() => router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug } })} />
                  </View>
                  {me.data ? (
                    <View style={styles.topAction}>
                      <Button
                        title="Meu perfil aqui"
                        variant="secondary"
                        onPress={() => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: me.data!.userName } })}
                      />
                    </View>
                  ) : null}
                  {isStaff ? (
                    <View style={styles.topAction}>
                      <Button title="Área da staff" variant="secondary" onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug } })} />
                    </View>
                  ) : null}
                </View>

                <Section
                  title="Personagens"
                  right={
                    perms.has('CreateCharacters') ? (
                      <View style={styles.smallButton}>
                        <Button title="+ Novo" onPress={() => router.push({ pathname: '/c/[slug]/personagens/novo', params: { slug } })} />
                      </View>
                    ) : undefined
                  }>
                  <Loadable query={characters}>
                    {(list) =>
                      list.length === 0 ? (
                        <Empty>Nenhum personagem ainda.</Empty>
                      ) : (
                        list.map((ch) => (
                          <Row
                            key={ch.id}
                            title={ch.name}
                            subtitle={`de @${ch.ownerUserName}`}
                            left={<Avatar name={ch.name} imageKey={ch.avatarKey} size={40} />}
                            onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: ch.id } })}
                          />
                        ))
                      )
                    }
                  </Loadable>
                </Section>

                <Section title="Membros">
                  <Loadable query={members}>
                    {(list) =>
                      list.map((m) => (
                        <Row
                          key={m.userId}
                          title={m.displayName}
                          subtitle={`@${m.userName}`}
                          left={<Avatar name={m.displayName} imageKey={m.avatarKey} size={40} />}
                          right={<Tag label={m.roleName} />}
                          onPress={() => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: m.userName } })}
                        />
                      ))
                    }
                  </Loadable>
                </Section>

                <Section
                  title="Cenas"
                  right={
                    perms.has('OpenScenes') ? (
                      <View style={styles.smallButton}>
                        <Button title="+ Abrir" onPress={() => router.push({ pathname: '/c/[slug]/cenas/nova', params: { slug } })} />
                      </View>
                    ) : undefined
                  }>
                  <Loadable query={scenes}>
                    {(list) =>
                      list.length === 0 ? (
                        <Empty>Nenhuma cena ainda.</Empty>
                      ) : (
                        list.map((s) => (
                          <Row
                            key={s.id}
                            title={s.title}
                            subtitle={`${s.participantCount} ${s.participantCount === 1 ? 'personagem' : 'personagens'} · aberta por @${s.openedByUserName}`}
                            right={<Tag label={s.status === 'Open' ? 'Ao vivo' : 'Encerrada'} />}
                            onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })}
                          />
                        ))
                      )
                    }
                  </Loadable>
                </Section>

                <Section
                  title="Capítulos"
                  right={
                    perms.has('WriteChapters') ? (
                      <View style={styles.smallButton}>
                        <Button title="+ Escrever" onPress={() => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug } })} />
                      </View>
                    ) : undefined
                  }>
                  <Loadable query={chapters}>
                    {(list) =>
                      list.length === 0 ? (
                        <Empty>Nenhum capítulo ainda.</Empty>
                      ) : (
                        list.map((ch) => (
                          <Row
                            key={ch.id}
                            title={ch.title}
                            subtitle={`${ch.characterName} · ${ch.excerpt}`}
                            right={ch.status === 'Draft' ? <Tag label="Rascunho" /> : undefined}
                            onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: ch.id } })}
                          />
                        ))
                      )
                    }
                  </Loadable>
                </Section>
              </>
            )}
          </Page>
        );
      }}
    </Loadable>
  );
}

const styles = StyleSheet.create({
  description: { fontSize: 15, color: colors.text, lineHeight: 22 },
  joinBox: { gap: 12 },
  smallButton: { width: 110 },
  topActions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  topAction: { flexGrow: 1, minWidth: 180 },
});
