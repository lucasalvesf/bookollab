import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Loadable, Page, Section, Tag } from '@/components/layout';
import { ConfirmButton } from '@/components/pickers';
import { Button, colors, Field, Notice } from '@/components/ui';

type Chapter = components['schemas']['ChapterDetail'];

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
          actions={<Tag label={STATUS_LABELS[c.status] ?? (c.editedAt ? 'Editado' : 'Publicado')} />}>
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
              {c.status === 'Pending' ? (
                <Notice kind="info">{c.canModerate ? 'Este capítulo aguarda a sua aprovação.' : 'Aguardando aprovação da staff. Só você vê este capítulo por enquanto.'}</Notice>
              ) : null}
              {c.status === 'Rejected' ? <Notice kind="error">{`Recusado pela staff${c.rejectionReason ? `: ${c.rejectionReason}` : '.'} Edite e reenvie.`}</Notice> : null}
              {c.mentionsMe && c.status === 'Published' ? <Notice kind="success">Você foi marcado neste capítulo. Responda para a história avançar!</Notice> : null}
              <Text style={styles.meta}>
                {c.publishedAt ? `Publicado em ${dateFmt.format(new Date(c.publishedAt))}` : 'Ainda não publicado'}
                {c.editedAt ? ` · editado em ${dateFmt.format(new Date(c.editedAt))}` : ''}
              </Text>
              <ChapterContext chapter={c} />
              <View style={styles.paper}>
                <Text style={styles.body}>{c.content}</Text>
              </View>
              {publish.isError ? <Notice kind="error">{publish.error.message}</Notice> : null}
              {remove.isError ? <Notice kind="error">{remove.error.message}</Notice> : null}
              <View style={styles.actions}>
                {c.status === 'Pending' && c.canModerate ? <ModerationBox chapterId={c.id} /> : null}
                {c.status === 'Draft' || c.status === 'Rejected' ? (
                  <Button title={c.status === 'Rejected' ? 'Reenviar para aprovação' : 'Publicar'} onPress={() => publish.mutate()} loading={publish.isPending} />
                ) : null}
                {c.status === 'Published' ? (
                  <Button
                    title="Responder com um capítulo"
                    variant="secondary"
                    onPress={() => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug: c.communitySlug, replyTo: c.id, mention: c.characterId } })}
                  />
                ) : null}
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

const STATUS_LABELS: Partial<Record<Chapter['status'], string>> = { Draft: 'Rascunho', Pending: 'Aguardando aprovação', Rejected: 'Recusado' };

/** Where the chapter comes from and who it involves: source scene, reply, co-authors, "@" mentions. */
function ChapterContext({ chapter: c }: { chapter: Chapter }) {
  const router = useRouter();
  const people = [...c.mentionedCharacters, ...c.mentionedUsers];
  if (!c.sourceSceneId && !c.replyToChapterId && c.coauthors.length === 0 && people.length === 0) return null;
  return (
    <View style={styles.context}>
      {c.sourceSceneId ? (
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: c.sourceSceneId! } })}>
          <Text style={styles.contextText}>🎭 Da cena <Text style={styles.link}>{c.sourceSceneTitle ?? 'de origem'}</Text></Text>
        </Pressable>
      ) : null}
      {c.replyToChapterId ? (
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: c.replyToChapterId! } })}>
          <Text style={styles.contextText}>↩️ Em resposta a <Text style={styles.link}>{c.replyToChapterTitle ?? 'um capítulo'}</Text></Text>
        </Pressable>
      ) : null}
      {c.coauthors.length > 0 ? <Text style={styles.contextText}>✍️ Com {c.coauthors.map((p) => p.name).join(', ')}</Text> : null}
      {people.length > 0 ? <Text style={styles.contextText}>✉️ Para {people.map((p) => `@${p.name}`).join(', ')}</Text> : null}
    </View>
  );
}

/** Staff: approve or reject (with a reason) a pending chapter. */
function ModerationBox({ chapterId }: { chapterId: string }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const onDone = (data: Chapter) => {
    queryClient.setQueryData(['chapter', chapterId], data);
    void queryClient.invalidateQueries({ queryKey: ['chapters', data.communitySlug] });
    void queryClient.invalidateQueries({ queryKey: ['chapter-approvals', data.communitySlug] });
  };
  const approve = useMutation({ mutationFn: () => unwrap(api.POST('/chapters/{id}/approve', { params: { path: { id: chapterId } } })), onSuccess: onDone });
  const reject = useMutation({ mutationFn: () => unwrap(api.POST('/chapters/{id}/reject', { params: { path: { id: chapterId } }, body: { reason } })), onSuccess: onDone });
  return (
    <View style={styles.moderation}>
      <Text style={styles.moderationTitle}>Aprovação da staff</Text>
      {approve.isError || reject.isError ? <Notice kind="error">{(approve.error ?? reject.error)?.message}</Notice> : null}
      {rejecting ? (
        <>
          <Field label="Motivo da recusa" value={reason} onChangeText={setReason} multiline numberOfLines={3} placeholder="O autor verá esta mensagem" />
          <Button title="Recusar com este motivo" onPress={() => reject.mutate()} loading={reject.isPending} />
          <Button title="Cancelar" variant="secondary" onPress={() => setRejecting(false)} />
        </>
      ) : (
        <>
          <Button title="Aprovar e publicar" onPress={() => approve.mutate()} loading={approve.isPending} />
          <Button title="Recusar" variant="secondary" onPress={() => setRejecting(true)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  context: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  contextText: { fontSize: 14, color: colors.text },
  moderation: { gap: 10, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.surface },
  moderationTitle: { fontSize: 15, fontWeight: '700', color: colors.brand },
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
