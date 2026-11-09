import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { fileUrl } from '@/lib/files';
import { makeStyles } from '@/theme';

/** Gradient pairs for avatars without an image (white initials pass AA on all of them). */
const GRADIENTS: [string, string][] = [
  ['#5B3DF5', '#9B3DF5'],
  ['#E0458F', '#B0307A'],
  ['#0E7490', '#155E75'],
  ['#C2410C', '#9A3412'],
  ['#047857', '#065F46'],
  ['#4338CA', '#3730A3'],
  ['#BE123C', '#9F1239'],
  ['#7E22CE', '#6B21A8'],
];

const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'of', 'the', 'a', 'o']);

export function gradientFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * Avatar: the uploaded image, or initials on a gradient derived from the name.
 * `shape="rounded"` is used for community icons (squircle, like Discord/Amino).
 */
export function Avatar({ name, imageKey, size = 36, online, shape = 'circle' }: {
  name: string;
  imageKey?: string | null;
  size?: number;
  online?: boolean;
  shape?: 'circle' | 'rounded';
}) {
  const styles = useStyles();
  const words = name.split(/\s+/).filter(Boolean);
  // "Reino de Aster" → "RA": skip short connectors when there are other words.
  const significant = words.filter((w) => !CONNECTORS.has(w.toLowerCase()));
  const initials = (significant.length ? significant : words)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const url = fileUrl(imageKey);
  const borderRadius = shape === 'circle' ? size / 2 : size * 0.3;
  return (
    <View style={{ width: size, height: size }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius }} contentFit="cover" accessibilityLabel={name} transition={150} />
      ) : (
        <LinearGradient colors={gradientFor(name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fallback, { width: size, height: size, borderRadius }]}>
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
        </LinearGradient>
      )}
      {online !== undefined ? (
        <View style={[styles.dot, online ? styles.online : styles.offline, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '700' },
  dot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2, borderColor: colors.surface },
  online: { backgroundColor: '#22C55E' },
  offline: { backgroundColor: colors.borderStrong },
}));
