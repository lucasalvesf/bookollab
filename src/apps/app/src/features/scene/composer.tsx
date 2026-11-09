import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputKeyPressEvent } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { colors } from '@/components/ui';
import { fileUrl, pickAndUploadImage } from '@/lib/files';

import { EMOJIS, type Character, type SceneAction } from './types';

/** Chat input bar: who you are playing as, attachment, emoji, text and send. */
export function Composer({
  sceneId,
  characters,
  onTyping,
  onSent,
  diceEnabled = false,
  attributesEnabled = false,
}: {
  sceneId: string;
  /** The user's characters that already joined the scene. */
  characters: Character[];
  onTyping: (characterId: string) => void;
  onSent: (a: SceneAction) => void;
  diceEnabled?: boolean;
  attributesEnabled?: boolean;
}) {
  const [characterId, setCharacterId] = useState<string>();
  const [pickingCharacter, setPickingCharacter] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const current = characters.find((c) => c.id === characterId) ?? characters[0];
  const canSend = !!current && (text.trim().length > 0 || !!attachment) && !sending && !uploading;

  async function attach() {
    setError(undefined);
    setUploading(true);
    try {
      const key = await pickAndUploadImage();
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
        api.POST('/scenes/{id}/actions', { params: { path: { id: sceneId } }, body: { characterId: current.id, content: text, attachmentKey: attachment ?? null } }),
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

  // Web: Enter sends, Shift+Enter breaks the line.
  function onKeyPress(e: TextInputKeyPressEvent) {
    const native = e.nativeEvent as TextInputKeyPressEvent['nativeEvent'] & { shiftKey?: boolean };
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
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Jogando como ${current?.name}`} onPress={() => setPickingCharacter((v) => !v)} style={styles.iconButton}>
          {current ? <Avatar name={current.name} imageKey={current.avatarKey} size={34} /> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Anexar imagem" onPress={attach} disabled={uploading} style={styles.iconButton}>
          {uploading ? <ActivityIndicator size="small" color={colors.brand} /> : <Text style={styles.icon}>📎</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Emojis" onPress={() => setEmojiOpen((v) => !v)} style={styles.iconButton}>
          <Text style={styles.icon}>😊</Text>
        </Pressable>
        {diceEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rolar dados"
            onPress={() => setText((t) => (t.trim().startsWith('/rolar') ? t : '/rolar 1d20'))}
            style={styles.iconButton}>
            <Text style={styles.icon}>🎲</Text>
          </Pressable>
        ) : null}
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (current && v) onTyping(current.id);
          }}
          onKeyPress={onKeyPress}
          multiline
          placeholder={diceEnabled ? `Digite sua ação aqui (ou /rolar 1d20${attributesEnabled ? '+força' : '+3'})` : 'Digite sua ação aqui'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="Digite sua ação aqui"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar ação" onPress={send} disabled={!canSend} style={[styles.send, !canSend && styles.sendDisabled]}>
          {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.sendIcon}>➤</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 10, gap: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderTopWidth: 1, borderTopColor: colors.border },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  input: { flex: 1, minHeight: 40, maxHeight: 140, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendIcon: { color: '#FFFFFF', fontSize: 18, marginLeft: 2 },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 8 },
  panelTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  panelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  charOption: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingRight: 12, paddingLeft: 4, paddingVertical: 4 },
  charSelected: { borderColor: colors.brand, borderWidth: 2 },
  charName: { fontSize: 14, color: colors.text, fontWeight: '600' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emoji: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 6, borderWidth: 1, borderColor: colors.border },
  previewImage: { width: 48, height: 48, borderRadius: 8 },
  previewText: { flex: 1, fontSize: 13, color: colors.textMuted },
  remove: { fontSize: 16, color: colors.textMuted, paddingHorizontal: 6 },
  error: { fontSize: 13, color: colors.danger },
});
