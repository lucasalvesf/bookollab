import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Loadable, Page, Section, Tag } from '@/components/layout';
import { ConfirmButton } from '@/components/pickers';
import { Button, colors, Field, Notice } from '@/components/ui';

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function ChapterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = ['chapter', id];
  const chapter = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/chapters/{id}', { params: { path: { id } } }), 'Capítulo não encontrado.') });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [problem, setProblem] = useState<unknown>();
  const [showHistory, setShowHistory] = useState(false);

  const history = useQuery({
    queryKey: ['chapter-revisions', id, chapter.data?.editedAt],
    enabled: showHistory,
    queryFn: () => unwrap(api.GET('/chapters/{id}/revisions', { params: { path: { id } } })),
  });
  const refreshLists = (slug: string) => queryClient.invalidateQueries({ queryKey: ['chapters', slug] });

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.PUT('/chapters/{id}', { params: { path: { id } }, body: { title, content } });
      if (!data) throw Object.assign(new Error(problemMessage(error) ?? 'Não foi possível salvar.'), { problem: error });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      void refreshLists(data.communitySlug);
      setEditing(false);
    },
    onError: (e) => setProblem((e as Error & { problem?: unknown }).problem ?? { detail: e.message }),
  });
  const publish = useMutation({
    mutationFn: () => unwrap(api.POST('/chapters/{id}/publish', { params: { path: { id } } })),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      void refreshLists(data.communitySlug);
    },
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/chapters/{id}', { params: { path: { id } } })),
    onSuccess: async () => {
      await refreshLists(chapter.data!.communitySlug);
      router.replace({ pathname: '/c/[slug]', params: { slug: chapter.data!.communitySlug } });
    },
  });

  return (
    <Loadable query={chapter}>
      {(c) => (
        <Page
          title={editing ? 'Editar capítulo' : c.title}
          subtitle={`${c.characterName} · por @${c.authorUserName} · ${c.communityName}`}
          back
          actions={c.status === 'Draft' ? <Tag label="Rascunho" /> : c.editedAt ? <Tag label="Editado" /> : undefined}>
          {editing ? (
            <>
              {problem && !problemMessage(problem, 'title') && !problemMessage(problem, 'content') ? <Notice kind="error">{problemMessage(problem)}</Notice> : null}
              <Field label="Título" value={title} onChangeText={setTitle} error={problemMessage(problem, 'title')} />
              <Field label="Texto" value={content} onChangeText={setContent} error={problemMessage(problem, 'content')} multiline numberOfLines={14} />
              <Button title="Salvar" onPress={() => save.mutate()} loading={save.isPending} />
              <Button title="Cancelar" variant="secondary" onPress={() => setEditing(false)} />
            </>
          ) : (
            <>
              <Text style={styles.meta}>
                {c.publishedAt ? `Publicado em ${dateFmt.format(new Date(c.publishedAt))}` : 'Ainda não publicado'}
                {c.editedAt ? ` · editado em ${dateFmt.format(new Date(c.editedAt))}` : ''}
              </Text>
              <View style={styles.paper}>
                <Text style={styles.body}>{c.content}</Text>
              </View>
              {publish.isError ? <Notice kind="error">{publish.error.message}</Notice> : null}
              {remove.isError ? <Notice kind="error">{remove.error.message}</Notice> : null}
              <View style={styles.actions}>
                {c.status === 'Draft' ? <Button title="Publicar" onPress={() => publish.mutate()} loading={publish.isPending} /> : null}
                {c.canEdit ? (
                  <Button
                    title="Editar"
                    variant="secondary"
                    onPress={() => {
                      setTitle(c.title);
                      setContent(c.content);
                      setProblem(undefined);
                      setEditing(true);
                    }}
                  />
                ) : null}
                <View style={styles.inline}>
                  {c.canDelete ? <ConfirmButton label="Apagar capítulo" confirmLabel="Confirmar exclusão" onConfirm={() => remove.mutate()} /> : null}
                  {c.canViewRevisions && c.editedAt ? (
                    <Pressable accessibilityRole="button" onPress={() => setShowHistory((v) => !v)}>
                      <Text style={styles.link}>{showHistory ? 'Ocultar histórico' : 'Ver histórico de edições'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {showHistory && history.data ? (
                <Section title="Histórico de edições">
                  {history.data.map((r, i) => (
                    <View key={i} style={styles.revision}>
                      <Text style={styles.meta}>{`${i === history.data.length - 1 ? 'Atual' : `Versão ${i + 1}`} · ${dateFmt.format(new Date(r.createdAt))}`}</Text>
                      <Text style={styles.revisionTitle}>{r.title}</Text>
                      <Text style={styles.revisionBody}>{r.content}</Text>
                    </View>
                  ))}
                </Section>
              ) : null}
            </>
          )}
        </Page>
      )}
    </Loadable>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, color: colors.textMuted },
  paper: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 20 },
  body: { fontSize: 16, lineHeight: 26, color: colors.text },
  actions: { gap: 10 },
  inline: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  revision: { padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.background },
  revisionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  revisionBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
