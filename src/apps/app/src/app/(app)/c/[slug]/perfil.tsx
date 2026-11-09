import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { AvatarPicker } from '@/components/avatar-picker';
import { Loadable, Page } from '@/components/layout';
import { Button, colors, Field, Notice } from '@/components/ui';
import { fileUrl, pickAndUploadImage } from '@/lib/files';

type Profile = components['schemas']['CommunityProfileDto'];
type Me = components['schemas']['MeResponse'];

/** Edit my profile inside this community. Empty fields inherit from the global profile. */
export default function EditCommunityProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const profile = useQuery({
    queryKey: ['community-profile', slug, me.data?.userName],
    enabled: !!me.data,
    queryFn: () => unwrap(api.GET('/communities/{slug}/members/{userName}', { params: { path: { slug, userName: me.data!.userName } } })),
  });

  return (
    <Page title="Meu perfil nesta comunidade" subtitle="O que você deixar em branco usa o seu perfil global." back>
      <Loadable query={profile}>{(p) => <Form slug={slug} profile={p} me={me.data!} />}</Loadable>
    </Page>
  );
}

function Form({ slug, profile, me }: { slug: string; profile: Profile; me: Me }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState(profile.ownNickname ?? '');
  const [bio, setBio] = useState(profile.ownBio ?? '');
  const [avatarKey, setAvatarKey] = useState<string | null>(profile.ownAvatarKey ?? null);
  const [coverKey, setCoverKey] = useState<string | null>(profile.coverKey ?? null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();

  async function chooseCover() {
    setUploadingCover(true);
    try {
      const key = await pickAndUploadImage();
      if (key) setCoverKey(key);
    } catch (e) {
      setProblem({ detail: (e as Error).message });
    } finally {
      setUploadingCover(false);
    }
  }

  async function save() {
    setLoading(true);
    setProblem(undefined);
    try {
      const { data, error } = await api.PUT('/communities/{slug}/me/profile', {
        params: { path: { slug } },
        body: { nickname: nickname || null, bio: bio || null, avatarKey, coverKey },
      });
      if (!data) {
        setProblem(error);
        return;
      }
      queryClient.setQueryData(['community-profile', slug, me.userName], data);
      await queryClient.invalidateQueries({ queryKey: ['members', slug] });
      router.replace({ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: me.userName } });
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  const cover = fileUrl(coverKey);
  return (
    <>
      {problem && !problemMessage(problem, 'nickname') && !problemMessage(problem, 'bio') ? <Notice kind="error">{problemMessage(problem)}</Notice> : null}

      <View style={styles.coverBox}>
        <Text style={styles.label}>Capa</Text>
        {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" /> : <View style={[styles.cover, styles.coverFallback]} />}
        <View style={styles.inline}>
          <Pressable accessibilityRole="button" onPress={chooseCover} disabled={uploadingCover}>
            <Text style={styles.link}>{cover ? 'Trocar capa' : 'Escolher capa'}</Text>
          </Pressable>
          {cover ? (
            <Pressable accessibilityRole="button" onPress={() => setCoverKey(null)}>
              <Text style={styles.muted}>Remover</Text>
            </Pressable>
          ) : null}
          {uploadingCover ? <ActivityIndicator size="small" color={colors.brand} /> : null}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Avatar nesta comunidade</Text>
        <AvatarPicker name={nickname || me.displayName} imageKey={avatarKey ?? me.avatarKey ?? null} onChange={setAvatarKey} />
        {!avatarKey ? <Text style={styles.hint}>Usando o avatar do perfil global.</Text> : null}
      </View>

      <Field label="Apelido" value={nickname} onChangeText={setNickname} error={problemMessage(problem, 'nickname')} placeholder={me.displayName} hint="Vazio = seu nome de exibição global." />
      <Field label="Bio" value={bio} onChangeText={setBio} error={problemMessage(problem, 'bio')} multiline numberOfLines={4} placeholder={me.bio ?? 'Conte um pouco sobre você nesta comunidade'} hint="Vazio = a bio do perfil global." />
      <Button title="Salvar" onPress={save} loading={loading} />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  coverBox: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  cover: { width: '100%', height: 140, borderRadius: 12 },
  coverFallback: { backgroundColor: colors.brand },
  inline: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  link: { fontSize: 14, color: colors.brand, fontWeight: '600' },
  muted: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textMuted },
});
