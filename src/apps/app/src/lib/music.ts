/** Name of the music service of a link (YouTube, Spotify or SoundCloud: the ones the API accepts). */
export function musicService(url: string): string {
  if (/youtu\.?be/.test(url)) return 'YouTube';
  if (/spotify\.com/.test(url)) return 'Spotify';
  if (/soundcloud\.com/.test(url)) return 'SoundCloud';
  return 'link';
}
