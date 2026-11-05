import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { api, problemMessage } from '@/api/client';
import { Page } from '@/components/layout';
import { Button, Field, Notice } from '@/components/ui';

export default function NewSceneScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();

  async function submit() {
    setLoading(true);
    setProblem(undefined);
    try {
      const { data, error } = await api.POST('/communities/{slug}/scenes', { params: { path: { slug } }, body: { title, description } });
      if (data) {
        await queryClient.invalidateQueries({ queryKey: ['scenes', slug] });
        router.replace({ pathname: '/cenas/[id]', params: { id: data.id } });
        return;
      }
      setProblem(error);
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  const fieldError = problemMessage(problem, 'title') || problemMessage(problem, 'description');
  return (
    <Page title="Abrir cena" subtitle="Uma cena é jogada ao vivo, com os outros jogadores." back>
      {problem && !fieldError ? <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível abrir a cena.'}</Notice> : null}
      <Field label="Título" value={title} onChangeText={setTitle} error={problemMessage(problem, 'title')} placeholder="Ex.: Noite de chuva na taverna" />
      <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} error={problemMessage(problem, 'description')} multiline numberOfLines={4} placeholder="Onde e quando acontece, o clima, o gancho inicial" />
      <Button title="Abrir cena" onPress={submit} loading={loading} />
    </Page>
  );
}
