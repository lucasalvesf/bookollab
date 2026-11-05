import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Loadable, Page } from '@/components/layout';
import { ChipPicker } from '@/components/pickers';
import { Button, Field, Notice } from '@/components/ui';

export default function NewChapterScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const myCharacters = useQuery({
    queryKey: ['characters', slug, 'mine'],
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug }, query: { mine: true } } })),
  });
  const [characterId, setCharacterId] = useState<string>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState<'draft' | 'publish'>();
  const [problem, setProblem] = useState<unknown>();

  async function submit(publish: boolean) {
    const selected = characterId ?? myCharacters.data?.[0]?.id;
    if (!selected) return;
    setSaving(publish ? 'publish' : 'draft');
    setProblem(undefined);
    try {
      const { data, error } = await api.POST('/communities/{slug}/chapters', {
        params: { path: { slug } },
        body: { characterId: selected, title, content, publish },
      });
      if (data) {
        await queryClient.invalidateQueries({ queryKey: ['chapters', slug] });
        router.replace({ pathname: '/capitulos/[id]', params: { id: data.id } });
        return;
      }
      setProblem(error);
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setSaving(undefined);
    }
  }

  return (
    <Page title="Escrever capítulo" subtitle="Um texto narrativo do ponto de vista de um dos seus personagens." back>
      <Loadable query={myCharacters}>
        {(chars) =>
          chars.length === 0 ? (
            <Notice kind="info">Crie um personagem nesta comunidade antes de escrever um capítulo.</Notice>
          ) : (
            <>
              {problem && !problemMessage(problem, 'title') && !problemMessage(problem, 'content') ? (
                <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível salvar.'}</Notice>
              ) : null}
              <ChipPicker label="Personagem" options={chars.map((c) => ({ value: c.id, label: c.name }))} value={characterId ?? chars[0].id} onChange={setCharacterId} />
              <Field label="Título" value={title} onChangeText={setTitle} error={problemMessage(problem, 'title')} />
              <Field label="Texto" value={content} onChangeText={setContent} error={problemMessage(problem, 'content')} multiline numberOfLines={14} placeholder="Escreva a história…" />
              <View style={{ gap: 10 }}>
                <Button title="Publicar" onPress={() => submit(true)} loading={saving === 'publish'} />
                <Button title="Salvar rascunho" variant="secondary" onPress={() => submit(false)} loading={saving === 'draft'} />
              </View>
            </>
          )
        }
      </Loadable>
    </Page>
  );
}
