import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clapperboard, Compass, History, Link2, Mail, Pencil, PenLine, Reply, Send, Trash2, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Avatar } from '@/components/avatar';
import { Loadable, Page, Section, Tag } from '@/components/layout';
import { ContextMenu, MoreButton, useCopyLink, useMenu, type MenuItem } from '@/components/menu';
import { Button, Field, Notice } from '@/components/ui';
import { makeStyles, radius, useTheme } from '@/theme';

type Chapter = components['schemas']['ChapterDetail'];

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function ChapterScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const copyLink = useCopyLink();
  const { openMenu } = useMenu();
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

  const startEditing = (c: Chapter) => {
    setTitle(c.title);
    setContent(c.content);
    setProblem(undefined);
    setEditing(true);
  };
  const chapterMenu = (c: Chapter): MenuItem[] => [
    { label: 'Responder com um capítulo', icon: Reply, hidden: c.status !== 'Published', onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug: c.communitySlug, replyTo: c.id, mention: c.characterId } }) },
    { label: 'Editar', icon: Pencil, hidden: !c.canEdit, onPress: () => startEditing(c) },
    { label: showHistory ? 'Ocultar histórico de edições' : 'Histórico de edições', icon: History, hidden: !(c.canViewRevisions && c.editedAt), onPress: () => setShowHistory((v) => !v) },
    { label: 'Abrir a comunidade', icon: Compass, onPress: () => router.push({ pathname: '/c/[slug]', params: { slug: c.communitySlug } }) },
    'separator',
    { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/capitulos/${c.id}`) },
    ...(c.canDelete
      ? (['separator', {
          label: 'Apagar capítulo',
          icon: Trash2,
          danger: true,
          onPress: () => openMenu([{ label: 'Apagar de vez', icon: Trash2, danger: true, onPress: () => remove.mutate() }, { label: 'Cancelar', icon: X, onPress: () => undefined }], undefined, 'Apagar este capítulo?'),
        }] as MenuItem[])
      : []),
  ];

  return (
    <Loadable query={chapter}>
      {(c) => (
        <Page
          title={editing ? 'Editar capítulo' : c.title}
          back
          actions={
            editing ? undefined : (
              <View style={styles.inline}>
                {STATUS_LABELS[c.status] ? <Tag label={STATUS_LABELS[c.status]!} tone={c.status === 'Rejected' ? 'danger' : c.status === 'Pending' ? 'warning' : 'neutral'} /> : null}
                <MoreButton items={chapterMenu(c)} title={c.title} size={38} />
              </View>
            )
          }>
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
              {c.status === 'Draft' || c.status === 'Rejected' ? (
                <View style={styles.draftBar}>
                  <Text style={styles.draftText}>{c.status === 'Draft' ? 'Rascunho: só você vê.' : 'Faça os ajustes e reenvie para a staff.'}</Text>
                  {c.canEdit ? <Button title="Editar" icon={Pencil} size="sm" variant="ghost" onPress={() => startEditing(c)} /> : null}
                  <Button title={c.status === 'Rejected' ? 'Reenviar' : 'Publicar'} icon={Send} size="sm" onPress={() => publish.mutate()} loading={publish.isPending} />
                </View>
              ) : null}
              {c.status === 'Pending' && c.canModerate ? <ModerationBox chapterId={c.id} /> : null}

              <ContextMenu items={chapterMenu(c)} title={c.title}>
                <View style={styles.byline}>
                  <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/personagens/[id]', params: { id: c.characterId } })}>
                    <Avatar name={c.characterName} size={42} />
                  </Pressable>
                  <View style={styles.flex}>
                    <Text style={styles.bylineName}>{c.characterName}</Text>
                    <Text style={styles.meta}>
                      {`por @${c.authorUserName} · `}
                      {c.publishedAt ? dateFmt.format(new Date(c.publishedAt)) : 'não publicado'}
                      {c.editedAt ? ' · editado' : ''}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.communitySlug } })} style={styles.communityChip}>
                    <Text style={styles.communityChipText} numberOfLines={1}>{c.communityName}</Text>
                  </Pressable>
                </View>
                <ChapterContext chapter={c} />
                <View style={styles.paper}>
                  <Text style={styles.body}>{c.content}</Text>
                </View>
              </ContextMenu>
              {publish.isError ? <Notice kind="error">{publish.error.message}</Notice> : null}
              {remove.isError ? <Notice kind="error">{remove.error.message}</Notice> : null}

              {c.status === 'Published' ? (
                <View style={styles.actionBar}>
                  <ActionChip
                    icon={Reply}
                    label="Responder"
                    onPress={() => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug: c.communitySlug, replyTo: c.id, mention: c.characterId } })}
                  />
                  <ActionChip icon={Link2} label="Compartilhar" onPress={() => void copyLink(`/capitulos/${c.id}`)} />
                  <View style={styles.flex} />
                  <MoreButton items={chapterMenu(c)} title={c.title} />
                </View>
              ) : null}
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

/** Small pill action (icon + short label), like the action row under a post. */
function ActionChip({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ hovered, pressed }) => [styles.actionChip, (hovered || pressed) && styles.actionChipActive]}>
      <Icon size={17} color={colors.textMuted} />
      <Text style={styles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

const STATUS_LABELS: Partial<Record<Chapter['status'], string>> = { Draft: 'Rascunho', Pending: 'Aguardando aprovação', Rejected: 'Recusado' };

/** Where the chapter comes from and who it involves: source scene, reply, co-authors, "@" mentions. */
function ChapterContext({ chapter: c }: { chapter: Chapter }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const people = [...c.mentionedCharacters, ...c.mentionedUsers];
  if (!c.sourceSceneId && !c.replyToChapterId && c.coauthors.length === 0 && people.length === 0) return null;
  return (
    <View style={styles.context}>
      {c.sourceSceneId ? (
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: c.sourceSceneId! } })} style={styles.contextRow}>
          <Clapperboard size={16} color={colors.brand} />
          <Text style={styles.contextText}>Da cena <Text style={styles.link}>{c.sourceSceneTitle ?? 'de origem'}</Text></Text>
        </Pressable>
      ) : null}
      {c.replyToChapterId ? (
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: c.replyToChapterId! } })} style={styles.contextRow}>
          <Reply size={16} color={colors.brand} />
          <Text style={styles.contextText}>Em resposta a <Text style={styles.link}>{c.replyToChapterTitle ?? 'um capítulo'}</Text></Text>
        </Pressable>
      ) : null}
      {c.coauthors.length > 0 ? (
        <View style={styles.contextRow}>
          <PenLine size={16} color={colors.brand} />
          <Text style={styles.contextText}>Com {c.coauthors.map((p) => p.name).join(', ')}</Text>
        </View>
      ) : null}
      {people.length > 0 ? (
        <View style={styles.contextRow}>
          <Mail size={16} color={colors.brand} />
          <Text style={styles.contextText}>Para {people.map((p) => `@${p.name}`).join(', ')}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Staff: approve or reject (with a reason) a pending chapter. */
function ModerationBox({ chapterId }: { chapterId: string }) {
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
  context: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  contextText: { fontSize: 14, color: colors.text },
  moderation: { gap: 10, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.surface },
  moderationTitle: { fontSize: 15, fontWeight: '700', color: colors.brand },
  meta: { fontSize: 13, color: colors.textMuted },
  paper: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 32, paddingHorizontal: 28 },
  body: { fontSize: 18, lineHeight: 31, color: colors.text, fontFamily: 'Literata_400Regular' },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  draftBar: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 12, borderRadius: radius.md, backgroundColor: colors.warningBg },
  draftText: { flex: 1, minWidth: 160, fontSize: 14, color: colors.warning, fontWeight: '600' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  bylineName: { fontSize: 15, fontWeight: '700', color: colors.text },
  communityChip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, maxWidth: 200 },
  communityChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionChipActive: { backgroundColor: colors.surfaceAlt },
  actionChipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  revision: { padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.background },
  revisionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  revisionBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
}));
