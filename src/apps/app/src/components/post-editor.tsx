import { Image } from 'expo-image';
import { ImagePlus, Music, Trash2, Wallpaper } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { fileUrl, pickAndUploadImage } from '@/lib/files';
import { makeStyles, radius, useTheme } from '@/theme';

import { FormSection } from './form';
import { imageMarkup } from './rich-text';
import { Button, Field, Notice } from './ui';

export type PostDraft = { title: string; content: string; coverKey: string | null; backgroundKey: string | null; musicUrl: string };

/**
 * Blog-format editor (chapters and blogs): cover on top, title and text in book type with
 * images inserted where the cursor is, then the reading extras (background image, music).
 */
export function PostEditor({ value, onChange, titleError, contentError, musicError, placeholder = 'Era uma vez…' }: {
  value: PostDraft;
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

  async function upload(kind: 'cover' | 'inline' | 'background') {
    setError(undefined);
    setBusy(kind);
    try {
      const key = await pickAndUploadImage();
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
  const background = fileUrl(value.backgroundKey);
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
            <Text style={styles.toolbarHint}>A imagem entra onde está o cursor.</Text>
          </View>
          <TextInput
            value={value.content}
            onChangeText={(content) => set({ content })}
            onSelectionChange={(e) => (selection.current = e.nativeEvent.selection)}
            placeholder={placeholder}
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.contentInput}
            accessibilityLabel="Texto"
          />
          {contentError ? <Text style={styles.error}>{contentError}</Text> : null}
          <Text style={styles.counter}>{`${words ? words.split(/\s+/).length : 0} palavras`}</Text>
        </View>
      </View>

      <FormSection title="Leitura" icon={Wallpaper} description="Deixe a leitura com a sua cara: uma imagem de fundo e uma música para ouvir junto.">
        <View style={styles.backgroundRow}>
          <View style={[styles.backgroundThumb, { backgroundColor: colors.surfaceAlt }]}>
            {background ? <Image source={{ uri: background }} style={styles.fill} contentFit="cover" /> : <Wallpaper size={20} color={colors.textSubtle} />}
          </View>
          <View style={styles.inline}>
            <Button title={background ? 'Trocar fundo' : 'Escolher fundo'} icon={ImagePlus} size="sm" variant="secondary" onPress={() => upload('background')} loading={busy === 'background'} />
            {background ? <Button title="Tirar" icon={Trash2} size="sm" variant="ghost" onPress={() => set({ backgroundKey: null })} /> : null}
          </View>
        </View>
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
  error: { fontSize: 13, color: colors.danger },
  backgroundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  backgroundThumb: { width: 96, height: 64, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
}));
