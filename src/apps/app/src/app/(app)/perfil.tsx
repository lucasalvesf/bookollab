import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { AvatarPicker } from '@/components/avatar-picker';
import { Loadable, Page } from '@/components/layout';
import { Button, Field, Notice } from '@/components/ui';

type Me = components['schemas']['MeResponse'];

export default function ProfileScreen() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  return (
    <Page title="Meu perfil" subtitle="Como você aparece para os outros jogadores." back>
      <Loadable query={me}>{(data) => <ProfileForm me={data} />}</Loadable>
    </Page>
  );
}

function ProfileForm({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio ?? '');
  const [avatarKey, setAvatarKey] = useState<string | null>(me.avatarKey ?? null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();
  const [saved, setSaved] = useState(false);

  async function save() {
    setLoading(true);
    setProblem(undefined);
    setSaved(false);
    try {
      const { data, error } = await api.PUT('/me', { body: { displayName, bio, avatarKey } });
      if (data) {
        queryClient.setQueryData(['me'], data);
        setSaved(true);
      } else setProblem(error);
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {saved ? <Notice kind="success">Perfil salvo.</Notice> : null}
      {problem && !problemMessage(problem, 'displayName') && !problemMessage(problem, 'bio') ? <Notice kind="error">{problemMessage(problem)}</Notice> : null}
      <AvatarPicker name={displayName || me.userName} imageKey={avatarKey} onChange={setAvatarKey} />
      <Field label="Nome de exibição" value={displayName} onChangeText={setDisplayName} error={problemMessage(problem, 'displayName')} />
      <Field label="Bio" value={bio} onChangeText={setBio} error={problemMessage(problem, 'bio')} multiline numberOfLines={4} placeholder="Conte um pouco sobre você" />
      <Field label="Nome de usuário" value={`@${me.userName}`} editable={false} hint="O @ não pode ser alterado." />
      <Button title="Salvar" onPress={save} loading={loading} />
    </>
  );
}
