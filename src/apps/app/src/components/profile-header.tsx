import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { fileUrl } from '@/lib/files';

import { Avatar } from './avatar';
import { makeStyles } from '@/theme';

/** Cover banner + overlapping avatar + name block, used by global and community profiles. */
export function ProfileHeader({
  name,
  handle,
  avatarKey,
  coverKey,
  badges,
  actions,
}: {
  name: string;
  handle: string;
  avatarKey?: string | null;
  coverKey?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  const styles = useStyles();
  const cover = fileUrl(coverKey);
  return (
    <View style={styles.card}>
      {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" /> : <View style={[styles.cover, styles.coverFallback]} />}
      <View style={styles.body}>
        <View style={styles.avatarRing}>
          <Avatar name={name} imageKey={avatarKey} size={96} />
        </View>
        <View style={styles.nameRow}>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.handle}>@{handle}</Text>
          </View>
          {actions}
        </View>
        {badges ? <View style={styles.badges}>{badges}</View> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cover: { width: '100%', height: 160 },
  coverFallback: { backgroundColor: colors.brand },
  body: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  avatarRing: { marginTop: -48, alignSelf: 'flex-start', borderRadius: 52, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surface },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  nameBlock: { flex: 1, minWidth: 180 },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  handle: { fontSize: 15, color: colors.textMuted },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
}));
