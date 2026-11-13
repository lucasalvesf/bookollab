import { Image } from 'expo-image';
import { ImagePlus, Music, Trash2, Wallpaper } from 'lucide-react-native';
import { useDeferredValue, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputKeyPressEvent } from 'react-native';

import { fileUrl, pickAndUploadImage } from '@/lib/files';
import { mentionMarkup } from '@/lib/links';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { FormSection } from './form';
import { BackgroundPicker } from './page-background';
import { LinkableList, useLinkables, type Linkable } from './link-picker';
import { imageMarkup } from './rich-text';
import { Button, Field, Notice } from './ui';

export type PostDraft = { title: string; content: string; coverKey: string | null; backgroundKey: string | null; musicUrl: string; backgroundColor?: string | null; backgroundBlur?: number };

/**
 * Blog-format editor (chapters and blogs): cover on top, title and text in book type with
 * images inserted where the cursor is, then the reading extras (background image, music).
 */
export function PostEditor({ value, onChange, titleError, contentError, musicError, placeholder = 'Era uma vez…', slug, onMention }: {
  value: PostDraft;
  /** Community of the post: enables "@" suggestions (anything in the community can be linked). */
  slug?: string;
  /** Called when something is mentioned (e.g. to notify a character's player). */
  onMention?: (item: Linkable) => void;
  onChange: (v: PostDraft) => void;
  titleError?: string;
  contentError?: string;
  musicError?: string;
  placeholder?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const selection = useRef({ start: value.content.length, end: value.content.length });
  const [busy, setBusy] = useState<'cover' | 'inline' | 'background'>();
  const [error, setError] = useState<string>();
  const set = (patch: Partial<PostDraft>) => onChange({ ...value, ...patch });
  const latest = useRef(value.content);
  const [mention, setMention] = useState<{ start: number; end: number; term: string }>();
  const [active, setActive] = useState(0);
  const term = useDeferredValue(mention?.term ?? '');
  const suggestions = useLinkables(mention && term ? slug : undefined, term, 4);
  const options = mention && term ? (suggestions.data ?? []) : [];
  // "@" followed by at least one letter right before the cursor opens the suggestions.
  const detect = (content: string, at: number) => {
    const m = /(^|\s)@([^\s@[\]()]{0,30})$/.exec(content.slice(0, at));
    setMention(slug && m ? { start: at - m[2].length - 1, end: at, term: m[2] } : undefined);
    setActive(0);
  };
  const pick = (item: Linkable) => {
    if (!mention) return;
    const before = value.content.slice(0, mention.start);
    const after = value.content.slice(mention.end);
    const inserted = `${mentionMarkup(item.label, item.target)} `;
    latest.current = before + inserted + after;
    set({ content: latest.current });
    selection.current = { start: before.length + inserted.length, end: before.length + inserted.length };
    setMention(undefined);
    onMention?.(item);
  };
  function onKeyPress(e: TextInputKeyPressEvent) {
    if (!options.length) return;
    const key = e.nativeEvent.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (key === 'Enter' || key === 'Tab') {
      e.preventDefault();
      pick(options[Math.min(active, options.length - 1)]);
    } else if (key === 'Escape') {
      setMention(undefined);
    }
  }

  async function upload(kind: 'cover' | 'inline' | 'background') {
    setError(undefined);
    setBusy(kind);
    try {
      const key = await pickAndUploadImage(kind === 'cover' ? { aspect: 2.4, title: 'Ajustar capa' } : kind === 'background' ? { aspect: 16 / 9, title: 'Ajustar fundo' } : { aspect: 16 / 9, title: 'Ajustar imagem' });
      if (!key) return;
      if (kind === 'cover') set({ coverKey: key });
      else if (kind === 'background') set({ backgroundKey: key });
      else {
        const at = selection.current.end;
        const before = value.content.slice(0, at).replace(/\s*$/, '');
        const after = value.content.slice(at).replace(/^\s*/, '');
        set({ content: `${before}${before ? '\n\n' : ''}${imageMarkup(key)}\n\n${after}` });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  const cover = fileUrl(value.coverKey);
  const words = value.content.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').trim();

  return (
    <View style={styles.stack}>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={styles.editor}>
        {cover ? (
          <View style={styles.cover}>
            <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" />
            <View style={styles.coverActions}>
              <Button title="Trocar capa" icon={ImagePlus} size="sm" variant="secondary" onPress={() => upload('cover')} loading={busy === 'cover'} />
              <Button title="Tirar" icon={Trash2} size="sm" variant="secondary" onPress={() => set({ coverKey: null })} />
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => upload('cover')} style={({ hovered }) => [styles.coverEmpty, hovered && styles.coverEmptyHover]}>
            <ImagePlus size={18} color={colors.textSubtle} />
            <Text style={styles.coverEmptyText}>{busy === 'cover' ? 'Enviando…' : 'Adicionar imagem de capa'}</Text>
          </Pressable>
        )}
        <View style={styles.paper}>
          <TextInput value={value.title} onChangeText={(title) => set({ title })} placeholder="Título" placeholderTextColor={colors.textSubtle} style={styles.titleInput} accessibilityLabel="Título" />
          {titleError ? <Text style={styles.error}>{titleError}</Text> : null}
          <View style={styles.toolbar}>
            <Button title="Imagem no texto" icon={ImagePlus} size="sm" variant="ghost" onPress={() => upload('inline')} loading={busy === 'inline'} />
            <Text style={styles.toolbarHint}>{slug ? 'A imagem entra onde está o cursor. Digite @ para marcar personagens, fichas, chats, posts ou membros.' : 'A imagem entra onde está o cursor.'}</Text>
          </View>
          <View style={styles.textWrap}>
          <TextInput
            value={value.content}
            onChangeText={(content) => {
              // Cursor = end of what changed (common suffix), so it works even before the selection event arrives.
              const old = latest.current;
              let tail = 0;
              while (tail < old.length && tail < content.length && old[old.length - 1 - tail] === content[content.length - 1 - tail]) tail++;
              latest.current = content;
              set({ content });
              detect(content, content.length - tail);
            }}
            onSelectionChange={(e) => {
              selection.current = e.nativeEvent.selection;
              // The selection event can arrive before the new text renders: read the latest text, not the prop.
              detect(latest.current, e.nativeEvent.selection.end);
            }}
            onKeyPress={onKeyPress}
            placeholder={placeholder}
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.contentInput}
            accessibilityLabel="Texto"
          />
          {options.length && mention ? (
            // Floats under the line being typed (lines of 29 px; wrapped lines make it a bit higher, still close).
            <View style={[styles.mentions, { top: Math.min(260, value.content.slice(0, mention.end).split('\n').length * 29 + 8) }]} accessibilityRole="menu">
              <Text style={styles.mentionsTitle}>{`Marcar "${term}"`}</Text>
              <LinkableList items={options} onPick={pick} activeIndex={active} />
            </View>
          ) : null}
          </View>
          {contentError ? <Text style={styles.error}>{contentError}</Text> : null}
          <Text style={styles.counter}>{`${words ? words.split(/\s+/).length : 0} palavras`}</Text>
        </View>
      </View>

      <FormSection title="Leitura" icon={Wallpaper} description="Deixe a leitura com a sua cara: uma cor ou imagem de fundo (com desfoque) e uma música para ouvir junto.">
        <BackgroundPicker
          value={{ imageKey: value.backgroundKey, color: value.backgroundColor ?? null, blur: value.backgroundBlur ?? 0 }}
          onChange={(b) => set({ backgroundKey: b.imageKey, backgroundColor: b.color, backgroundBlur: b.blur })}
        />
        <Field
          label="Música (link do YouTube, Spotify ou SoundCloud)"
          value={value.musicUrl}
          onChangeText={(musicUrl) => set({ musicUrl })}
          placeholder="https://www.youtube.com/watch?v=…"
          autoCapitalize="none"
          inputMode="url"
          error={musicError}
        />
        {value.musicUrl ? (
          <View style={styles.inline}>
            <Music size={14} color={colors.textSubtle} />
            <Text style={styles.toolbarHint}>Na web toca embutida no post; no celular abre o app da música.</Text>
          </View>
        ) : null}
      </FormSection>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  stack: { gap: 16 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  editor: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cover: { height: 220, backgroundColor: colors.surfaceAlt },
  coverActions: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  coverEmpty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 64, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceAlt },
  coverEmptyHover: { backgroundColor: colors.brandSoft },
  coverEmptyText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  paper: { paddingHorizontal: 24, paddingVertical: 20, gap: 8 },
  titleInput: { fontSize: 26, color: colors.text, fontFamily: 'Literata_600SemiBold', paddingVertical: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexWrap: 'wrap' },
  toolbarHint: { fontSize: 12, color: colors.textSubtle, flexShrink: 1 },
  contentInput: { minHeight: 320, fontSize: 17, lineHeight: 29, color: colors.text, fontFamily: 'Literata_400Regular', textAlignVertical: 'top', paddingVertical: 4 },
  counter: { fontSize: 12, color: colors.textSubtle, textAlign: 'right' },
  textWrap: { position: 'relative', zIndex: 5 },
  mentions: { position: 'absolute', left: 12, width: 380, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 6, ...shadow(colors, 3) },
  mentionsTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 8, paddingTop: 4 },
  error: { fontSize: 13, color: colors.danger },
  backgroundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  backgroundThumb: { width: 96, height: 64, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
}));
