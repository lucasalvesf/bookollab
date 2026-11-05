import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { fileUrl } from '@/lib/files';

const PALETTE = ['#02534E', '#2F6FDE', '#8A5A00', '#6D28D9', '#B42318', '#067647', '#C2410C', '#0E7490'];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Round avatar: the uploaded image, or the initials on a color derived from the name. */
export function Avatar({ name, imageKey, size = 36, online }: { name: string; imageKey?: string | null; size?: number; online?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const url = fileUrl(imageKey);
  return (
    <View style={{ width: size, height: size }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityLabel={name} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(name) }]}>
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials || '?'}</Text>
        </View>
      )}
      {online !== undefined ? (
        <View
          style={[
            styles.dot,
            { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, backgroundColor: online ? '#12B76A' : '#98A2B3' },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '700' },
  dot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2, borderColor: '#FFFFFF' },
});
