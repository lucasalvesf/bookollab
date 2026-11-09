import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { Loadable, Page } from '@/components/layout';
import { ChipPicker } from '@/components/pickers';
import { Button, colors, Field, Notice } from '@/components/ui';

/**
 * Write a chapter. Optional params:
 * - sceneId: write from a closed scene (automatic draft or from scratch, with co-authors);
 * - replyTo + mention: answer a letter, tagging the original character.
 */
export default function NewChapterScreen() {
  const { slug, sceneId, replyTo, mention } = useLocalSearchParams<{ slug: string; sceneId?: string; replyTo?: string; mention?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const myCharacters = useQuery({
    queryKey: ['characters', slug, 'mine'],
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug }, query: { mine: true } } })),
  });
  const allCharacters = useQuery({
    queryKey: ['characters', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug }, query: {} } })),
  });
  const draft = useQuery({
    queryKey: ['scene-chapter-draft', sceneId],
    enabled: !!sceneId,
    queryFn: () => unwrap(api.GET('/scenes/{id}/chapter-draft', { params: { path: { id: sceneId! } } })),
  });

  const [characterId, setCharacterId] = useState<string>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coauthors, setCoauthors] = useState<string[] | null>(null);
  const [mentions, setMentions] = useState<string[]>(mention ? [mention] : []);
  const [mentionsOpen, setMentionsOpen] = useState(!!mention);
  const [saving, setSaving] = useState<'draft' | 'publish'>();
  const [problem, setProblem] = useState<unknown>();

  const selectedCoauthors = coauthors ?? (draft.data?.coauthors.map((c) => c.id) ?? []);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function submit(publish: boolean) {
    const selected = characterId ?? myCharacters.data?.[0]?.id;
    if (!selected) return;
    setSaving(publish ? 'publish' : 'draft');
    setProblem(undefined);
    try {
      const { data, error } = await api.POST('/communities/{slug}/chapters', {
        params: { path: { slug } },
        body: {
          characterId: selected,
          title,
          content,
          publish,
          sourceSceneId: sceneId ?? null,
          coauthorCharacterIds: sceneId ? selectedCoauthors.filter((id) => id !== selected) : null,
          mentionedCharacterIds: mentions,
          mentionedUserIds: null,
          replyToChapterId: replyTo ?? null,
        },
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

  const subtitle = sceneId ? `A partir da cena${draft.data ? ` "${draft.data.sceneTitle}"` : ''}` : replyTo ? 'Resposta a um capítulo' : 'Um texto narrativo do ponto de vista de um dos seus personagens.';

  return (
    <Page title="Escrever capítulo" subtitle={subtitle} back>
      <Loadable query={myCharacters}>
        {(chars) =>
          chars.length === 0 ? (
            <Notice kind="info">Crie um personagem nesta comunidade antes de escrever um capítulo.</Notice>
          ) : (
            <>
              {problem && !problemMessage(problem, 'title') && !problemMessage(problem, 'content') ? (
                <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível salvar.'}</Notice>
              ) : null}
              {sceneId && draft.isError ? <Notice kind="error">{draft.error.message}</Notice> : null}

              <ChipPicker label="Personagem" options={chars.map((c) => ({ value: c.id, label: c.name }))} value={characterId ?? chars[0].id} onChange={setCharacterId} />

              {sceneId && draft.data ? (
                <View style={styles.box}>
                  <Text style={styles.label}>Rascunho automático</Text>
                  <Text style={styles.muted}>Junta as ações da cena em ordem. Você pode editar o texto depois.</Text>
                  <View style={styles.inline}>
                    <View style={styles.flex}>
                      <Button title="Usar o rascunho" variant="secondary" onPress={() => { setTitle(draft.data.title); setContent(draft.data.content); }} />
                    </View>
                    <View style={styles.flex}>
                      <Button title="Escrever do zero" variant="secondary" onPress={() => { setTitle(''); setContent(''); }} />
                    </View>
                  </View>
                  <Text style={styles.label}>Coautores</Text>
                  <View style={styles.chips}>
                    {draft.data.coauthors.map((c) => {
                      const on = selectedCoauthors.includes(c.id);
                      return (
                        <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setCoauthors(toggle(selectedCoauthors, c.id))} style={[styles.person, on && styles.personOn]}>
                          <Avatar name={c.name} imageKey={c.avatarKey} size={24} />
                          <Text style={[styles.personText, on && styles.personTextOn]}>{c.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <Field label="Título" value={title} onChangeText={setTitle} error={problemMessage(problem, 'title')} />
              <Field label="Texto" value={content} onChangeText={setContent} error={problemMessage(problem, 'content')} multiline numberOfLines={14} placeholder="Escreva a história…" />

              <View style={styles.box}>
                <Pressable accessibilityRole="button" onPress={() => setMentionsOpen((v) => !v)} style={styles.header}>
                  <Text style={styles.label}>Marcar personagens (@) {mentions.length ? `· ${mentions.length}` : ''}</Text>
                  <Text style={styles.muted}>{mentionsOpen ? '▾' : '▸'}</Text>
                </Pressable>
                <Text style={styles.muted}>{'Quem for marcado recebe um aviso para responder (ex.: uma carta "Para @John").'}</Text>
                {mentionsOpen ? (
                  <View style={styles.chips}>
                    {(allCharacters.data ?? [])
                      .filter((c) => c.id !== (characterId ?? chars[0].id))
                      .map((c) => {
                        const on = mentions.includes(c.id);
                        return (
                          <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setMentions(toggle(mentions, c.id))} style={[styles.person, on && styles.personOn]}>
                            <Avatar name={c.name} imageKey={c.avatarKey} size={24} />
                            <Text style={[styles.personText, on && styles.personTextOn]}>@{c.name}</Text>
                          </Pressable>
                        );
                      })}
                  </View>
                ) : null}
              </View>

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

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  inline: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 150 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 3 },
  personOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  personText: { fontSize: 13, color: colors.text },
  personTextOn: { color: colors.brandText, fontWeight: '600' },
});
