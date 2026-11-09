import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { Empty, Loadable, Page, Row, Section, Tag } from '@/components/layout';
import { ConfirmButton } from '@/components/pickers';
import { ProfileHeader } from '@/components/profile-header';
import { Button, colors, Notice } from '@/components/ui';

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

/** A player's profile inside one community: own nickname/avatar/bio/cover, sheets, activity, role. */
export default function CommunityProfileScreen() {
  const { slug, userName } = useLocalSearchParams<{ slug: string; userName: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [removeError, setRemoveError] = useState<string>();
  const community = useQuery({ queryKey: ['community', slug], queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } })) });
  const canRemove = community.data?.me?.permissions.includes('ManageMembers') ?? false;
  const profile = useQuery({
    queryKey: ['community-profile', slug, userName],
    queryFn: () => unwrap(api.GET('/communities/{slug}/members/{userName}', { params: { path: { slug, userName } } }), 'Perfil não encontrado.'),
  });

  return (
    <Loadable query={profile}>
      {(p) => (
        <Page title={p.communityName} back>
          <ProfileHeader
            name={p.nickname}
            handle={p.userName}
            avatarKey={p.avatarKey}
            coverKey={p.coverKey}
            badges={
              <>
                <Tag label={p.roleName} />
                <Tag label={p.level ? `Nível ${p.level}${p.title ? ` · ${p.title}` : ''}` : 'Nível: em breve'} />
              </>
            }
            actions={
              p.isMe ? (
                <View style={styles.edit}>
                  <Button title="Editar perfil aqui" variant="secondary" onPress={() => router.push({ pathname: '/c/[slug]/perfil', params: { slug } })} />
                </View>
              ) : undefined
            }
          />
          {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
          <View style={styles.metaRow}>
            <Text style={styles.muted}>Membro desde {dateFmt.format(new Date(p.joinedAt))}</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/u/[userName]', params: { userName: p.userName } })}>
              <Text style={styles.link}>Ver perfil global</Text>
            </Pressable>
          </View>
          {!p.isMe && p.baseKind !== 'Owner' && canRemove ? (
            <View style={styles.removeBox}>
              {removeError ? <Notice kind="error">{removeError}</Notice> : null}
              <ConfirmButton
                label="Remover da comunidade"
                confirmLabel={`Confirmar: remover ${p.nickname}`}
                onConfirm={async () => {
                  setRemoveError(undefined);
                  try {
                    await unwrap(api.POST('/communities/{slug}/members/{userId}/remove', { params: { path: { slug, userId: p.userId } } }));
                    await queryClient.invalidateQueries({ queryKey: ['members', slug] });
                    router.replace({ pathname: '/c/[slug]', params: { slug } });
                  } catch (e) {
                    setRemoveError((e as Error).message);
                  }
                }}
              />
            </View>
          ) : null}

          <Section title={`Fichas · ${p.characters.length + p.sheets.length}`}>
            {p.characters.length + p.sheets.length === 0 ? (
              <Empty>Nenhuma ficha nesta comunidade ainda.</Empty>
            ) : (
              <View style={styles.grid}>
                {p.characters.map((c) => (
                  <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: c.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                    <Avatar name={c.name} imageKey={c.avatarKey} size={64} />
                    <Text style={styles.cardName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.cardSub}>Personagem</Text>
                  </Pressable>
                ))}
                {p.sheets.map((s) => (
                  <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/fichas/[id]', params: { id: s.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                    <Avatar name={s.name} imageKey={s.imageKey} size={64} />
                    <Text style={styles.cardName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>{s.kind ?? 'Ficha'}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>

          <Section title="Capítulos publicados">
            {p.chapters.length === 0 ? (
              <Empty>Nenhum capítulo publicado.</Empty>
            ) : (
              p.chapters.map((c) => (
                <Row
                  key={c.id}
                  title={c.title}
                  subtitle={`${c.characterName}${c.publishedAt ? ` · ${dateFmt.format(new Date(c.publishedAt))}` : ''}`}
                  onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: c.id } })}
                />
              ))
            )}
          </Section>

          <Section title="Cenas">
            {p.scenes.length === 0 ? (
              <Empty>Ainda não participou de cenas.</Empty>
            ) : (
              p.scenes.map((s) => (
                <Row
                  key={s.id}
                  title={s.title}
                  subtitle={dateFmt.format(new Date(s.createdAt))}
                  right={<Tag label={s.status === 'Open' ? 'Ao vivo' : 'Encerrada'} />}
                  onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })}
                />
              ))
            )}
          </Section>
        </Page>
      )}
    </Loadable>
  );
}

const styles = StyleSheet.create({
  edit: { minWidth: 170 },
  bio: { fontSize: 15, color: colors.text, lineHeight: 22 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  muted: { fontSize: 13, color: colors.textMuted },
  link: { fontSize: 14, color: colors.brand, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  card: { width: 130, alignItems: 'center', gap: 6, padding: 12, borderRadius: 12, backgroundColor: colors.background },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, maxWidth: '100%' },
  cardSub: { fontSize: 12, color: colors.textMuted },
  pressed: { opacity: 0.6 },
  removeBox: { gap: 8, alignItems: 'flex-start' },
});
