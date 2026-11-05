import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { pickAndUploadImage } from '@/lib/files';

import { Avatar } from './avatar';
import { colors } from './ui';

/** Avatar with "change / remove" actions; uploads the chosen image immediately. */
export function AvatarPicker({ name, imageKey, onChange }: { name: string; imageKey: string | null; onChange: (key: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  async function choose() {
    setError(undefined);
    setUploading(true);
    try {
      const key = await pickAndUploadImage();
      if (key) onChange(key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.row}>
      <Avatar name={name} imageKey={imageKey} size={72} />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={choose} disabled={uploading}>
          <Text style={styles.link}>{imageKey ? 'Trocar imagem' : 'Escolher imagem'}</Text>
        </Pressable>
        {imageKey ? (
          <Pressable accessibilityRole="button" onPress={() => onChange(null)}>
            <Text style={styles.muted}>Remover</Text>
          </Pressable>
        ) : null}
        {uploading ? <ActivityIndicator size="small" color={colors.brand} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.hint}>JPG, PNG, WEBP ou GIF, até 5 MB.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actions: { gap: 6, flex: 1 },
  link: { fontSize: 14, color: colors.brand, fontWeight: '600' },
  muted: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.danger },
});
