import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AtSign, Clapperboard, FilePlus2, PenLine, Reply, Search, UserRound, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { FormScreen, FormSection } from '@/components/form';
import { Loadable, Page } from '@/components/layout';
import { PostEditor, type PostDraft } from '@/components/post-editor';
import { Button, Notice } from '@/components/ui';
import { makeStyles, radius, useTheme } from '@/theme';

/**
 * Write a chapter (Wattpad-like editor): the text first, then who writes it, where it comes from
 * and who is tagged. Optional params:
 * - sceneId: write from a closed scene (automatic draft or from scratch, with co-authors);
 * - replyTo + mention: answer a letter, tagging the original character.
 */
export default function NewChapterScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { slug, sceneId, replyTo, mention, kind } = useLocalSearchParams<{ slug: string; sceneId?: string; replyTo?: string; mention?: string; kind?: string }>();
  const blog = kind === 'blog';
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
  const [post, setPost] = useState<PostDraft>({ title: '', content: '', coverKey: null, backgroundKey: null, musicUrl: '' });
  const [coauthors, setCoauthors] = useState<string[] | null>(null);
  const [mentions, setMentions] = useState<string[]>(mention ? [mention] : []);
  const [mentionTerm, setMentionTerm] = useState('');
  const [saving, setSaving] = useState<'draft' | 'publish'>();
  const [problem, setProblem] = useState<unknown>();

  const selectedCoauthors = coauthors ?? (draft.data?.coauthors.map((c) => c.id) ?? []);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const writer = characterId ?? myCharacters.data?.[0]?.id;

  async function submit(publish: boolean) {
    if (!blog && !writer) return;
    setSaving(publish ? 'publish' : 'draft');
    setProblem(undefined);
    try {
      const { data, error } = await api.POST('/communities/{slug}/chapters', {
        params: { path: { slug } },
        body: {
          kind: blog ? 'Blog' : 'Chapter',
          characterId: blog ? null : writer!,
          title: post.title,
          content: post.content,
          coverKey: post.coverKey,
          backgroundKey: post.backgroundKey,
          musicUrl: post.musicUrl.trim() || null,
          publish,
          sourceSceneId: sceneId ?? null,
          coauthorCharacterIds: sceneId ? selectedCoauthors.filter((id) => id !== writer) : null,
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

  const subtitle = blog ? 'Um post OFF, seu como jogador: avisos, bastidores, artes, o que quiser.' : sceneId ? `A partir da cena${draft.data ? ` "${draft.data.sceneTitle}"` : ''}` : replyTo ? 'Resposta a um capítulo' : 'Um texto narrativo do ponto de vista de um dos seus personagens.';

  if (!blog && myCharacters.data && myCharacters.data.length === 0) {
    return (
      <Page title="Escrever capítulo" subtitle={subtitle} back>
        <Notice kind="info">Crie um personagem nesta comunidade antes de escrever um capítulo.</Notice>
        <View style={styles.start}>
          <Button title="Criar personagem" icon={UserRound} onPress={() => router.replace({ pathname: '/c/[slug]/personagens/novo', params: { slug } })} />
        </View>
      </Page>
    );
  }

  const q = mentionTerm.trim().toLowerCase();
  const mentionable = (allCharacters.data ?? []).filter((c) => c.id !== writer && (!q || c.name.toLowerCase().includes(q)));

  return (
    <FormScreen
      title={blog ? 'Escrever blog' : 'Escrever capítulo'}
      subtitle={subtitle}
      submitLabel="Publicar"
      onSubmit={() => submit(true)}
      loading={saving === 'publish'}
      disabled={(!blog && !writer) || !post.title.trim() || !post.content.trim()}
      secondary={{ label: 'Salvar rascunho', onPress: () => submit(false), loading: saving === 'draft' }}>
      <Loadable query={myCharacters}>
        {(chars) => (
          <>
            {problem && !problemMessage(problem, 'title') && !problemMessage(problem, 'content') ? <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível salvar.'}</Notice> : null}
            {replyTo ? (
              <View style={styles.replyBanner}>
                <Reply size={16} color={colors.brandSoftText} />
                <Text style={styles.replyText}>Você está respondendo a um capítulo. O autor original já está marcado.</Text>
              </View>
            ) : null}

            {!blog ? (
            <FormSection title="Quem escreve" icon={UserRound} description="O capítulo é narrado do ponto de vista deste personagem.">
              <View style={styles.people}>
                {chars.map((c) => {
                  const on = c.id === writer;
                  return (
                    <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setCharacterId(c.id)} style={[styles.person, on && styles.personOn]}>
                      <Avatar name={c.name} imageKey={c.avatarKey} size={28} />
                      <Text style={[styles.personText, on && styles.personTextOn]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </FormSection>
            ) : null}

            {sceneId && draft.data ? (
              <FormSection
                title="Da cena"
                icon={Clapperboard}
                description="O rascunho automático junta as ações da cena em ordem; você edita à vontade."
                right={
                  <View style={styles.inline}>
                    <Button title="Usar rascunho" icon={FilePlus2} size="sm" variant="secondary" onPress={() => setPost({ ...post, title: draft.data.title, content: draft.data.content })} />
                    <Button title="Do zero" icon={PenLine} size="sm" variant="ghost" onPress={() => setPost({ ...post, title: '', content: '' })} />
                  </View>
                }>
                <Text style={styles.label}>Coautores</Text>
                <View style={styles.people}>
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
              </FormSection>
            ) : null}
            {sceneId && draft.isError ? <Notice kind="error">{draft.error.message}</Notice> : null}

            <PostEditor
              value={post}
              onChange={setPost}
              slug={slug}
              onMention={(item) => item.kind === 'character' && setMentions((list) => [...new Set([...list, item.target.slice('character:'.length)])])}
              titleError={problemMessage(problem, 'title')}
              contentError={problemMessage(problem, 'content')}
              musicError={problemMessage(problem, 'musicUrl')}
              placeholder={blog ? 'Escreva o seu post…' : 'Era uma vez…'}
            />

            <FormSection title="Marcar personagens" icon={AtSign} description={'Quem for marcado recebe um aviso para responder (ex.: uma carta "Para @John").'}>
              {mentions.length > 0 ? (
                <View style={styles.people}>
                  {(allCharacters.data ?? [])
                    .filter((c) => mentions.includes(c.id))
                    .map((c) => (
                      <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Desmarcar ${c.name}`} onPress={() => setMentions(toggle(mentions, c.id))} style={[styles.person, styles.personOn]}>
                        <Avatar name={c.name} imageKey={c.avatarKey} size={24} />
                        <Text style={[styles.personText, styles.personTextOn]}>@{c.name}</Text>
                        <X size={13} color={colors.brandText} />
                      </Pressable>
                    ))}
                </View>
              ) : null}
              <View style={styles.search}>
                <Search size={16} color={colors.textSubtle} />
                <TextInput value={mentionTerm} onChangeText={setMentionTerm} placeholder="Buscar personagem para marcar" placeholderTextColor={colors.textSubtle} style={styles.searchInput} accessibilityLabel="Buscar personagem para marcar" />
              </View>
              <View style={styles.people}>
                {mentionable
                  .filter((c) => !mentions.includes(c.id))
                  .slice(0, 12)
                  .map((c) => (
                    <Pressable key={c.id} accessibilityRole="button" onPress={() => setMentions(toggle(mentions, c.id))} style={({ hovered }) => [styles.person, hovered && styles.personHover]}>
                      <Avatar name={c.name} imageKey={c.avatarKey} size={24} />
                      <Text style={styles.personText}>@{c.name}</Text>
                    </Pressable>
                  ))}
              </View>
            </FormSection>
          </>
        )}
      </Loadable>
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  start: { alignItems: 'flex-start' },
  inline: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 12 },
  replyText: { flex: 1, fontSize: 14, color: colors.brandSoftText },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingLeft: 4, paddingRight: 12, paddingVertical: 3, backgroundColor: colors.surface },
  personHover: { borderColor: colors.borderStrong },
  personOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  personText: { fontSize: 13, fontWeight: '500', color: colors.text },
  personTextOn: { color: colors.brandText, fontWeight: '600' },
  editor: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 24, paddingVertical: 20, gap: 8 },
  titleInput: { fontSize: 24, color: colors.text, fontFamily: 'Literata_600SemiBold', paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.border },
  contentInput: { minHeight: 320, fontSize: 17, lineHeight: 29, color: colors.text, fontFamily: 'Literata_400Regular', textAlignVertical: 'top', paddingVertical: 4 },
  counter: { fontSize: 12, color: colors.textSubtle, textAlign: 'right' },
  error: { fontSize: 13, color: colors.danger },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 },
}));
