import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ImagePlus, Paintbrush, Trash2, UserRound } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { colorFor } from '@/components/avatar';
import { AvatarPicker } from '@/components/avatar-picker';
import { FormSection } from '@/components/form';
import { Loadable, Page } from '@/components/layout';
import { Button, Field, Notice } from '@/components/ui';
import { fileUrl, pickAndUploadImage } from '@/lib/files';
import { makeStyles } from '@/theme';

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
  const styles = useStyles();
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

      <FormSection title="Aparência" icon={Paintbrush} description="Capa e avatar só desta comunidade.">
        <View style={[styles.cover, { backgroundColor: colorFor(me.userName) }]}>
          {cover ? <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" /> : null}
        </View>
        <View style={styles.inline}>
          <Button title={cover ? 'Trocar capa' : 'Escolher capa'} icon={ImagePlus} size="sm" variant="secondary" onPress={chooseCover} loading={uploadingCover} />
          {cover ? <Button title="Remover capa" icon={Trash2} size="sm" variant="ghost" onPress={() => setCoverKey(null)} /> : null}
        </View>
        <AvatarPicker name={nickname || me.displayName} imageKey={avatarKey ?? me.avatarKey ?? null} onChange={setAvatarKey} />
        {!avatarKey ? <Text style={styles.hint}>Usando o avatar do perfil global.</Text> : null}
      </FormSection>

      <FormSection title="Sobre você aqui" icon={UserRound} description="Em branco = usa o do perfil global.">
        <Field label="Apelido" value={nickname} onChangeText={setNickname} error={problemMessage(problem, 'nickname')} placeholder={me.displayName} />
        <Field label="Bio" value={bio} onChangeText={setBio} error={problemMessage(problem, 'bio')} multiline numberOfLines={4} placeholder={me.bio ?? 'Conte um pouco sobre você nesta comunidade'} />
      </FormSection>
      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" size="sm" onPress={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/c/[slug]', params: { slug } }))} />
        <Button title="Salvar perfil" size="sm" onPress={save} loading={loading} />
      </View>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cover: { width: '100%', height: 140, borderRadius: 12, overflow: 'hidden' },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  hint: { fontSize: 12, color: colors.textSubtle },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
}));
