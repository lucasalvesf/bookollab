import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, Clapperboard, Compass, History, Link2, Mail, Pencil, PenLine, Reply, Send, Trash2, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Avatar } from '@/components/avatar';
import { FormFooter } from '@/components/form';
import { Loadable, Page, Section, Tag } from '@/components/layout';
import { NameChip, NameLink, useFeatureMenu } from '@/components/links';
import { ContextMenu, MoreButton, useCopyLink, useMenu, type MenuItem } from '@/components/menu';
import { MusicPlayer } from '@/components/music-player';
import { PostEditor, type PostDraft } from '@/components/post-editor';
import { RichText } from '@/components/rich-text';
import { Button, Field, IconButton, Notice } from '@/components/ui';
import { fileUrl } from '@/lib/files';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

type Chapter = components['schemas']['ChapterDetail'];

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Reading a post (Wattpad/Amino blog format): big cover, optional reading background and music,
 * the text with its images; actions are icons and the "⋯" menu.
 */
export default function ChapterScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const copyLink = useCopyLink();
  const { openMenu } = useMenu();
  const queryClient = useQueryClient();
  const key = ['chapter', id];
  const chapter = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/chapters/{id}', { params: { path: { id } } }), 'Post não encontrado.') });
  const featureMenu = useFeatureMenu(chapter.data?.communitySlug, !!chapter.data?.canFeature);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PostDraft>({ title: '', content: '', coverKey: null, backgroundKey: null, musicUrl: '' });
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
      const { data, error } = await api.PUT('/chapters/{id}', {
        params: { path: { id } },
        body: { title: draft.title, content: draft.content, coverKey: draft.coverKey, backgroundKey: draft.backgroundKey, musicUrl: draft.musicUrl.trim() || null },
      });
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
    setDraft({ title: c.title, content: c.content, coverKey: c.coverKey ?? null, backgroundKey: c.backgroundKey ?? null, musicUrl: c.musicUrl ?? '' });
    setProblem(undefined);
    setEditing(true);
  };
  const noun = (c: Chapter) => (c.kind === 'Blog' ? 'blog' : 'capítulo');
  const replyParams = (c: Chapter) => ({ slug: c.communitySlug, replyTo: c.id, ...(c.characterId ? { mention: c.characterId } : {}) });
  const chapterMenu = (c: Chapter): MenuItem[] => [
    { label: 'Responder com um capítulo', icon: Reply, hidden: c.status !== 'Published', onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: replyParams(c) }) },
    { label: `Editar ${noun(c)}`, icon: Pencil, hidden: !c.canEdit, onPress: () => startEditing(c) },
    ...featureMenu('Post', c.id),
    { label: showHistory ? 'Ocultar histórico de edições' : 'Histórico de edições', icon: History, hidden: !(c.canViewRevisions && c.editedAt), onPress: () => setShowHistory((v) => !v) },
    { label: 'Abrir a comunidade', icon: Compass, onPress: () => router.push({ pathname: '/c/[slug]', params: { slug: c.communitySlug } }) },
    'separator',
    { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/capitulos/${c.id}`) },
    ...(c.canDelete
      ? (['separator', {
          label: `Apagar ${noun(c)}`,
          icon: Trash2,
          danger: true,
          onPress: () => openMenu([{ label: 'Apagar de vez', icon: Trash2, danger: true, onPress: () => remove.mutate() }, { label: 'Cancelar', icon: X, onPress: () => undefined }], undefined, `Apagar este ${noun(c)}?`),
        }] as MenuItem[])
      : []),
  ];

  return (
    <Loadable query={chapter}>
      {(c) => {
        if (editing) {
          return (
            <View style={styles.flex}>
              <Page title={`Editar ${noun(c)}`} back>
                {problem && !problemMessage(problem, 'title') && !problemMessage(problem, 'content') ? <Notice kind="error">{problemMessage(problem)}</Notice> : null}
                <PostEditor
                  value={draft}
                  onChange={setDraft}
                  titleError={problemMessage(problem, 'title')}
                  contentError={problemMessage(problem, 'content')}
                  musicError={problemMessage(problem, 'musicUrl')}
                />
              </Page>
              <FormFooter submitLabel="Salvar alterações" onSubmit={() => save.mutate()} loading={save.isPending} onCancel={() => setEditing(false)} />
            </View>
          );
        }

        const cover = fileUrl(c.coverKey);
        const background = fileUrl(c.backgroundKey);
        const menu = chapterMenu(c);
        const author = c.kind === 'Blog'
          ? { label: c.characterName, href: { pathname: '/c/[slug]/membros/[userName]' as const, params: { slug: c.communitySlug, userName: c.authorUserName } } }
          : { label: c.characterName, href: { pathname: '/personagens/[id]' as const, params: { id: c.characterId! } } };

        const hero = cover ? (
          <View style={styles.coverWrap}>
            <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" transition={200} />
            <View style={styles.coverShade} />
            <View style={styles.coverBar}>
              <IconButton icon={ChevronLeft} label="Voltar" tone="onImage" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
              <View style={styles.flex} />
              <MoreButton items={menu} title={c.title} size={40} tone="onImage" />
            </View>
            <View style={styles.coverTitleBox}>
              <Text style={styles.kindOnImage}>{c.kind === 'Blog' ? 'Blog' : 'Capítulo'}</Text>
              <Text style={styles.coverTitle} numberOfLines={3}>{c.title}</Text>
            </View>
          </View>
        ) : undefined;

        const page = (
          <Page
            title={c.title}
            back
            transparent={!!background}
            hero={hero}
            actions={
              <View style={styles.inline}>
                {STATUS_LABELS[c.status] ? <Tag label={STATUS_LABELS[c.status]!} tone={c.status === 'Rejected' ? 'danger' : c.status === 'Pending' ? 'warning' : 'neutral'} /> : null}
                <MoreButton items={menu} title={c.title} size={38} />
              </View>
            }>
            {c.status === 'Pending' ? (
              <Notice kind="info">{c.canModerate ? 'Este capítulo aguarda a sua aprovação.' : 'Aguardando aprovação da moderação. Só você vê este capítulo por enquanto.'}</Notice>
            ) : null}
            {c.status === 'Rejected' ? <Notice kind="error">{`Recusado pela moderação${c.rejectionReason ? `: ${c.rejectionReason}` : '.'} Edite e reenvie.`}</Notice> : null}
            {c.mentionsMe && c.status === 'Published' ? <Notice kind="success">Você foi marcado neste post. Responda para a história avançar!</Notice> : null}
            {c.status === 'Draft' || c.status === 'Rejected' ? (
              <View style={styles.draftBar}>
                <Text style={styles.draftText}>{c.status === 'Draft' ? 'Rascunho: só você vê.' : 'Faça os ajustes e reenvie para a moderação.'}</Text>
                {c.canEdit ? <Button title="Editar" icon={Pencil} size="sm" variant="ghost" onPress={() => startEditing(c)} /> : null}
                <Button title={c.status === 'Rejected' ? 'Reenviar' : 'Publicar'} icon={Send} size="sm" onPress={() => publish.mutate()} loading={publish.isPending} />
              </View>
            ) : null}
            {c.status === 'Pending' && c.canModerate ? <ModerationBox chapterId={c.id} /> : null}

            <ContextMenu items={menu} title={c.title}>
              <View style={styles.byline}>
                <Avatar name={c.characterName} imageKey={c.characterAvatarKey} size={42} />
                <View style={styles.flex}>
                  <Text style={styles.bylineName}>
                    <NameLink label={author.label} href={author.href} style={styles.bylineNameLink} />
                    {c.kind === 'Blog' ? <Text style={styles.offTag}>  OFF</Text> : null}
                  </Text>
                  <Text style={styles.meta}>
                    {c.kind === 'Chapter' ? (
                      <>
                        {'por '}
                        <NameLink label={`@${c.authorUserName}`} href={{ pathname: '/c/[slug]/membros/[userName]', params: { slug: c.communitySlug, userName: c.authorUserName } }} />
                        {' · '}
                      </>
                    ) : null}
                    {c.publishedAt ? dateFmt.format(new Date(c.publishedAt)) : 'não publicado'}
                    {c.editedAt ? ' · editado' : ''}
                  </Text>
                </View>
                <NameChip label={c.communityName} href={{ pathname: '/c/[slug]', params: { slug: c.communitySlug } }} />
              </View>
              <ChapterContext chapter={c} />
              {c.musicUrl ? <MusicPlayer url={c.musicUrl} /> : null}
              <View style={[styles.paper, background && styles.paperOnBackground]}>
                <RichText content={c.content} textStyle={styles.body} />
              </View>
            </ContextMenu>
            {publish.isError ? <Notice kind="error">{publish.error.message}</Notice> : null}
            {remove.isError ? <Notice kind="error">{remove.error.message}</Notice> : null}

            {c.status === 'Published' ? (
              <View style={styles.actionBar}>
                <ActionChip icon={Reply} label="Responder" onPress={() => router.push({ pathname: '/c/[slug]/capitulos/novo', params: replyParams(c) })} />
                <ActionChip icon={Link2} label="Compartilhar" onPress={() => void copyLink(`/capitulos/${c.id}`)} />
                <View style={styles.flex} />
                <MoreButton items={menu} title={c.title} />
              </View>
            ) : null}

            {showHistory && history.data ? (
              <Section title="Histórico de edições" icon={History}>
                {history.data.map((r, i) => (
                  <View key={i} style={styles.revision}>
                    <Text style={styles.meta}>{`${i === history.data.length - 1 ? 'Atual' : `Versão ${i + 1}`} · ${dateFmt.format(new Date(r.createdAt))}`}</Text>
                    <Text style={styles.revisionTitle}>{r.title}</Text>
                    <Text style={styles.revisionBody}>{r.content}</Text>
                  </View>
                ))}
              </Section>
            ) : null}
          </Page>
        );

        return background ? (
          <View style={styles.flex}>
            <Image source={{ uri: background }} style={styles.fill} contentFit="cover" />
            <View style={styles.backgroundShade} />
            {page}
          </View>
        ) : (
          page
        );
      }}
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

/** Where the post comes from and who it involves; every name is a link. */
function ChapterContext({ chapter: c }: { chapter: Chapter }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const people = c.mentionedCharacters;
  if (!c.sourceSceneId && !c.replyToChapterId && c.coauthors.length === 0 && people.length === 0 && c.mentionedUsers.length === 0) return null;
  const characterLinks = (list: { id: string; name: string }[], prefix = '') =>
    list.map((p, i) => (
      <Text key={p.id}>
        {i > 0 ? ', ' : ''}
        <NameLink label={`${prefix}${p.name}`} href={{ pathname: '/personagens/[id]', params: { id: p.id } }} />
      </Text>
    ));
  return (
    <View style={styles.context}>
      {c.sourceSceneId ? (
        <View style={styles.contextRow}>
          <Clapperboard size={16} color={colors.brand} />
          <Text style={styles.contextText}>
            {'Da cena '}
            <NameLink label={c.sourceSceneTitle ?? 'de origem'} href={{ pathname: '/cenas/[id]', params: { id: c.sourceSceneId } }} />
          </Text>
        </View>
      ) : null}
      {c.replyToChapterId ? (
        <View style={styles.contextRow}>
          <Reply size={16} color={colors.brand} />
          <Text style={styles.contextText}>
            {'Em resposta a '}
            <NameLink label={c.replyToChapterTitle ?? 'um post'} href={{ pathname: '/capitulos/[id]', params: { id: c.replyToChapterId } }} />
          </Text>
        </View>
      ) : null}
      {c.coauthors.length > 0 ? (
        <View style={styles.contextRow}>
          <PenLine size={16} color={colors.brand} />
          <Text style={styles.contextText}>
            {'Com '}
            {characterLinks(c.coauthors)}
          </Text>
        </View>
      ) : null}
      {people.length > 0 || c.mentionedUsers.length > 0 ? (
        <View style={styles.contextRow}>
          <Mail size={16} color={colors.brand} />
          <Text style={styles.contextText}>
            {'Para '}
            {characterLinks(people, '@')}
            {c.mentionedUsers.map((u) => `, @${u.name}`).join('')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Moderation: approve or reject (with a reason) a pending chapter. */
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
      <Text style={styles.moderationTitle}>Aprovação da moderação</Text>
      {approve.isError || reject.isError ? <Notice kind="error">{(approve.error ?? reject.error)?.message}</Notice> : null}
      {rejecting ? (
        <>
          <Field label="Motivo da recusa" value={reason} onChangeText={setReason} multiline numberOfLines={3} placeholder="O autor verá esta mensagem" />
          <View style={styles.inlineEnd}>
            <Button title="Cancelar" variant="ghost" size="sm" onPress={() => setRejecting(false)} />
            <Button title="Recusar com este motivo" icon={X} size="sm" variant="danger" onPress={() => reject.mutate()} loading={reject.isPending} />
          </View>
        </>
      ) : (
        <View style={styles.inlineEnd}>
          <Button title="Recusar" icon={X} size="sm" variant="ghost" onPress={() => setRejecting(true)} />
          <Button title="Aprovar e publicar" icon={Check} size="sm" onPress={() => approve.mutate()} loading={approve.isPending} />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inlineEnd: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  backgroundShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, opacity: 0.35 },
  coverWrap: { width: '100%', height: 320, backgroundColor: colors.surfaceAlt },
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.45)' },
  coverBar: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
  coverTitleBox: { position: 'absolute', left: 0, right: 0, bottom: 24, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, gap: 4 },
  kindOnImage: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.9 },
  coverTitle: { fontSize: 32, lineHeight: 40, color: '#FFFFFF', fontFamily: 'Literata_600SemiBold' },
  meta: { fontSize: 13, color: colors.textMuted },
  draftBar: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 12, borderRadius: radius.md, backgroundColor: colors.warningBg },
  draftText: { flex: 1, minWidth: 160, fontSize: 14, color: colors.warning, fontWeight: '600' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, marginTop: 8 },
  bylineName: { fontSize: 15, fontWeight: '700', color: colors.text },
  bylineNameLink: { color: colors.text },
  offTag: { fontSize: 11, fontWeight: '800', color: colors.warning },
  paper: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 32, paddingHorizontal: 28, marginTop: 12 },
  paperOnBackground: { opacity: 0.97, ...shadow(colors, 3) },
  body: { fontSize: 18, lineHeight: 31, color: colors.text, fontFamily: 'Literata_400Regular' },
  context: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contextText: { fontSize: 14, color: colors.text, flexShrink: 1 },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionChipActive: { backgroundColor: colors.surfaceAlt },
  actionChipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  moderation: { gap: 10, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.surface },
  moderationTitle: { fontSize: 15, fontWeight: '700', color: colors.brand },
  revision: { padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  revisionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  revisionBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
}));
