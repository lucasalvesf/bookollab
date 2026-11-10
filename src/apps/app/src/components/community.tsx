import { Image } from 'expo-image';
import { Users } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { fileUrl } from '@/lib/files';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Avatar, colorFor } from './avatar';
import { ContextMenu, type MenuItem } from './menu';
import { PressableScale } from './ui';

/** Community cover: the uploaded image, or a solid color derived from the name. */
export function CommunityCover({ name, coverKey, height, children }: { name: string; coverKey?: string | null; height: number; children?: ReactNode }) {
  const styles = useStyles();
  const url = fileUrl(coverKey);
  return (
    <View style={[styles.cover, { height }]}>
      {url ? (
        <Image source={{ uri: url }} style={styles.fill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.fill, { backgroundColor: colorFor(name) }]} />
      )}
      {children}
    </View>
  );
}

/** Card for community lists (home, discover): cover, icon, name, members. */
export function CommunityCard({ community: c, right, menu, onPress }: {
  community: { name: string; description?: string | null; memberCount: number; iconKey?: string | null; coverKey?: string | null };
  right?: ReactNode;
  /** Right-click actions (see useCommunityMenu). */
  menu?: MenuItem[];
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <ContextMenu items={menu ?? []} title={c.name} style={styles.cardWrap}>
    <PressableScale onPress={onPress} accessibilityLabel={c.name} style={styles.card}>
      <CommunityCover name={c.name} coverKey={c.coverKey} height={84} />
      <View style={styles.iconWrap}>
        <Avatar name={c.name} imageKey={c.iconKey} size={52} shape="rounded" />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
        {c.description ? <Text style={styles.description} numberOfLines={2}>{c.description}</Text> : null}
        <View style={styles.footer}>
          <Users size={14} color={colors.textSubtle} />
          <Text style={styles.meta}>{`${c.memberCount} ${c.memberCount === 1 ? 'membro' : 'membros'}`}</Text>
          <View style={styles.flex} />
          {right}
        </View>
      </View>
    </PressableScale>
    </ContextMenu>
  );
}

/** Responsive grid: 1 column on phones, 2–3 on wider screens. */
export function CardGrid({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.grid}>{children}</View>;
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cover: { width: '100%', overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, width: '100%' },
  cardWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, maxWidth: '100%' },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(colors, 1) },
  iconWrap: { marginTop: -28, marginLeft: 14, borderRadius: 18, borderWidth: 3, borderColor: colors.surface, alignSelf: 'flex-start', backgroundColor: colors.surface },
  body: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 14, gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  meta: { fontSize: 12, color: colors.textSubtle, fontWeight: '500' },
}));
