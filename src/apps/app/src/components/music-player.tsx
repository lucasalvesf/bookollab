import * as Linking from 'expo-linking';
import { Music } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { musicService } from '@/lib/music';
import { makeStyles, radius, useTheme } from '@/theme';

import { Button } from './ui';


/** Native: music opens in the service's app (embeds are web-only). See music-player.web.tsx. */
export function MusicPlayer({ url }: { url: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.card}>
      <Music size={18} color={colors.brand} />
      <Text style={styles.text}>Música para ler junto</Text>
      <Button title={`Ouvir no ${musicService(url)}`} size="sm" variant="secondary" onPress={() => void Linking.openURL(url)} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  text: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
}));
