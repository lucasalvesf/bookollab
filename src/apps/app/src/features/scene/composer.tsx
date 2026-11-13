import { Image } from 'expo-image';
import { Dices, Paperclip, SendHorizontal, Smile, X } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, type TextInputKeyPressEvent } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { LinkableList, useLinkables, type Linkable } from '@/components/link-picker';
import { fileUrl, pickAndUploadImage } from '@/lib/files';
import { mentionMarkup } from '@/lib/links';

import { EMOJIS, type Character, type SceneAction } from './types';
import { makeStyles, useTheme } from '@/theme';

/** Chat input bar: who you are playing as, attachment, emoji, text and send. */
export function Composer({
  sceneId,
  characters,
  onTyping,
  onSent,
  diceEnabled = false,
  attributesEnabled = false,
  self,
  slug,
  attributeNames = [],
}: {
  sceneId: string;
  /** The user's characters that already joined the scene. */
  characters: Character[];
  onTyping: (characterId?: string) => void;
  /** Community of the chat: enables "@" suggestions. */
  slug?: string;
  /** Numeric sheet fields usable in "/rolar 1d20+campo". */
  attributeNames?: string[];
  /** OffGame chat: the member writes as themselves (no character). */
  self?: { name: string; avatarKey?: string | null };
  onSent: (a: SceneAction) => void;
  diceEnabled?: boolean;
  attributesEnabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [characterId, setCharacterId] = useState<string>();
  const [pickingCharacter, setPickingCharacter] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const current = characters.find((c) => c.id === characterId) ?? characters[0];
  const canSend = (!!self || !!current) && (text.trim().length > 0 || !!attachment) && !sending && !uploading;

  async function attach() {
    setError(undefined);
    setUploading(true);
    try {
      const key = await pickAndUploadImage({ aspect: 4 / 3, title: 'Ajustar imagem' });
      if (key) setAttachment(key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(undefined);
    try {
      const action = await unwrap(
        api.POST('/scenes/{id}/actions', { params: { path: { id: sceneId } }, body: { characterId: self ? null : current.id, content: text, attachmentKey: attachment ?? null } }),

      );
      onSent(action);
      setText('');
      setAttachment(undefined);
      setEmojiOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  // Autocomplete: "@nome" suggests anything linkable in the community; "/" suggests the commands.
  const mentionTerm = /(^|\s)@([^\s@[\]()]{1,30})$/.exec(text)?.[2] ?? '';
  const deferredTerm = useDeferredValue(mentionTerm);
  const linkables = useLinkables(slug && deferredTerm ? slug : undefined, deferredTerm, 4);
  const commands = diceEnabled && /^\/\S*( \S*)?$/.test(text)
    ? [
        { value: '/rolar 1d20', hint: 'Rola um dado de 20 lados' },
        { value: '/rolar 2d6', hint: 'Rola dois dados de 6 lados' },
        { value: '/rolar 1d100', hint: 'Porcentagem' },
        ...(attributesEnabled ? attributeNames.map((a) => ({ value: `/rolar 1d20+${a.toLowerCase()}`, hint: `d20 somando ${a}` })) : []),
      ].filter((c) => c.value.startsWith(text.trim().toLowerCase()) && c.value !== text.trim())
    : [];
  const mentionItems = mentionTerm ? (linkables.data ?? []) : [];
  const suggestions = commands.length ? commands.length : mentionItems.length;
  const [active, setActive] = useState(0);
  const pickCommand = (value: string) => setText(`${value} `);
  const pickMention = (l: Linkable) => setText((t) => t.replace(/@([^\s@[\]()]{1,30})$/, `${mentionMarkup(l.label, l.target)} `));

  // Web: Enter sends, Shift+Enter breaks the line; with suggestions open, arrows move and Enter/Tab pick.
  function onKeyPress(e: TextInputKeyPressEvent) {
    const native = e.nativeEvent as TextInputKeyPressEvent['nativeEvent'] & { shiftKey?: boolean };
    if (suggestions > 0 && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(native.key)) {
      e.preventDefault();
      if (native.key === 'ArrowDown' || native.key === 'ArrowUp') setActive((i) => (i + (native.key === 'ArrowDown' ? 1 : -1) + suggestions) % suggestions);
      else if (native.key === 'Escape') setText((t) => `${t} `);
      else if (commands.length) pickCommand(commands[Math.min(active, commands.length - 1)].value);
      else pickMention(mentionItems[Math.min(active, mentionItems.length - 1)]);
      return;
    }
    if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <View style={styles.wrap}>
      {pickingCharacter && characters.length > 1 ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Jogando como</Text>
          <View style={styles.panelRow}>
            {characters.map((c) => (
              <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ checked: c.id === current?.id }} onPress={() => { setCharacterId(c.id); setPickingCharacter(false); }} style={[styles.charOption, c.id === current?.id && styles.charSelected]}>
                <Avatar name={c.name} imageKey={c.avatarKey} size={28} />
                <Text style={styles.charName}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {emojiOpen ? (
        <View style={styles.panel}>
          <View style={styles.emojiGrid}>
            {EMOJIS.map((e) => (
              <Pressable key={e} accessibilityRole="button" accessibilityLabel={e} onPress={() => setText((t) => t + e)} style={styles.emoji}>
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {attachment ? (
        <View style={styles.preview}>
          <Image source={{ uri: fileUrl(attachment) }} style={styles.previewImage} contentFit="cover" />
          <Text style={styles.previewText}>Imagem anexada</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Remover anexo" onPress={() => setAttachment(undefined)} hitSlop={8}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {commands.length ? (
        <View style={styles.panel} accessibilityRole="menu">
          <Text style={styles.panelTitle}>Comandos</Text>
          {commands.map((c, i) => (
            <Pressable key={c.value} accessibilityRole="button" onPress={() => pickCommand(c.value)} style={({ hovered }) => [styles.suggestion, (hovered || i === active) && styles.suggestionActive]}>
              <Dices size={16} color={colors.brand} />
              <Text style={styles.suggestionValue}>{c.value}</Text>
              <Text style={styles.suggestionHint}>{c.hint}</Text>
            </Pressable>
          ))}
          <Text style={styles.suggestionKeys}>↑ ↓ para escolher · Enter para completar</Text>
        </View>
      ) : mentionItems.length ? (
        <View style={styles.panel} accessibilityRole="menu">
          <Text style={styles.panelTitle}>{`Marcar "${mentionTerm}"`}</Text>
          <LinkableList items={mentionItems} onPick={pickMention} activeIndex={active} />
          <Text style={styles.suggestionKeys}>↑ ↓ para escolher · Enter para completar</Text>
        </View>
      ) : null}

      <View style={styles.bar}>
        {self ? (
          <View accessibilityLabel={`Escrevendo como ${self.name}`} style={styles.iconButton}>
            <Avatar name={self.name} imageKey={self.avatarKey} size={34} />
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`Jogando como ${current?.name}`} onPress={() => setPickingCharacter((v) => !v)} style={styles.iconButton}>
            {current ? <Avatar name={current.name} imageKey={current.avatarKey} size={34} /> : null}
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Anexar imagem" onPress={attach} disabled={uploading} style={styles.iconButton}>
          {uploading ? <ActivityIndicator size="small" color={colors.brand} /> : <Paperclip size={20} color={colors.textMuted} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Emojis" onPress={() => setEmojiOpen((v) => !v)} style={styles.iconButton}>
          <Smile size={20} color={emojiOpen ? colors.brand : colors.textMuted} />
        </Pressable>
        {diceEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={attributesEnabled ? 'Rolar dados (ex.: /rolar 1d20+força)' : 'Rolar dados (ex.: /rolar 1d20+3)'}
            onPress={() => setText((t) => (t.trim().startsWith('/rolar') ? t : '/rolar 1d20'))}
            style={styles.iconButton}>
            <Dices size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setActive(0);
            if (self && v) onTyping();
    else if (current && v) onTyping(current.id);
          }}
          onKeyPress={onKeyPress}
          multiline
          placeholder="Digite sua ação aqui"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          accessibilityLabel="Digite sua ação aqui"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar ação" onPress={send} disabled={!canSend} style={[styles.send, !canSend && styles.sendDisabled]}>
          {sending ? <ActivityIndicator size="small" color={colors.brandText} /> : <SendHorizontal size={20} color={colors.brandText} />}
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { padding: 10, gap: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 140, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  panel: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 8 },
  panelTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  panelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  charOption: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingRight: 12, paddingLeft: 4, paddingVertical: 4 },
  charSelected: { borderColor: colors.brand, borderWidth: 2 },
  charName: { fontSize: 14, color: colors.text, fontWeight: '600' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emoji: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8 },
  suggestionActive: { backgroundColor: colors.surfaceAlt },
  suggestionValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  suggestionHint: { flex: 1, fontSize: 12, color: colors.textMuted },
  suggestionKeys: { fontSize: 11, color: colors.textSubtle, paddingHorizontal: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 6, borderWidth: 1, borderColor: colors.border },
  previewImage: { width: 48, height: 48, borderRadius: 8 },
  previewText: { flex: 1, fontSize: 13, color: colors.textMuted },
  error: { fontSize: 13, color: colors.danger },
}));
