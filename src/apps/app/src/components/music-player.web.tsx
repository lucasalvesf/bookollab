import { Music } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { makeStyles, radius, useTheme } from '@/theme';

/** Embed URL for YouTube, Spotify or SoundCloud links (the only services the API accepts). */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('spotify.com')) return `https://open.spotify.com/embed${u.pathname.replace(/^\/intl-[a-z]+/, '')}`;
    if (u.hostname.includes('soundcloud.com')) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%235b3df5&visual=false`;
  } catch {
    return null;
  }
  return null;
}

/** Web: the music plays embedded on the page while reading. */
export function MusicPlayer({ url }: { url: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const src = embedUrl(url);
  const youtube = src?.includes('youtube.com');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Music size={16} color={colors.brand} />
        <Text style={styles.text}>Música para ler junto</Text>
      </View>
      {src ? (
        <iframe
          src={src}
          title="Música para ler junto"
          style={{ width: '100%', height: youtube ? 200 : 152, border: 0, borderRadius: 10 }}
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <Text style={styles.text}>{url}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
}));
