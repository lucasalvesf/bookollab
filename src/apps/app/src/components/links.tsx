import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Star, StarOff } from 'lucide-react-native';
import { Pressable, Text, type GestureResponderEvent } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { makeStyles, radius } from '@/theme';

import { Avatar } from './avatar';
import { useMenu, type MenuItem } from './menu';

/**
 * Every name is a link (product rule): community, scene, character, sheet, post or member.
 * `href` builds the route; the press does not bubble to the card around it.
 */
export function NameChip({ label, href, avatar, shape = 'circle', onImage }: {
  label: string;
  href: Href;
  avatar?: { name: string; imageKey?: string | null } | null;
  shape?: 'circle' | 'rounded';
  onImage?: boolean;
}) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={(e: GestureResponderEvent) => {
        e.stopPropagation?.();
        router.push(href);
      }}
      style={({ hovered }) => [styles.chip, avatar ? styles.chipWithAvatar : null, onImage && styles.chipOnImage, hovered && styles.chipHover]}>
      {avatar ? <Avatar name={avatar.name} imageKey={avatar.imageKey} size={18} shape={shape} /> : null}
      <Text style={[styles.chipText, onImage && styles.chipTextOnImage]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Inline text link for names inside sentences ("por @lia", "Da cena A Taverna"). */
export function NameLink({ label, href, style }: { label: string; href: Href; style?: object }) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <Text
      accessibilityRole="link"
      onPress={(e) => {
        e.stopPropagation?.();
        router.push(href);
      }}
      style={[styles.link, style]}>
      {label}
    </Text>
  );
}

type FeaturedType = components['schemas']['FeaturedItemType'];

/** Moderation: feature / unfeature an item on the community home (menu items for "⋯" and right click). */
export function useFeatureMenu(slug: string | undefined, canFeature: boolean) {
  const queryClient = useQueryClient();
  const { toast } = useMenu();
  const featured = useQuery({
    queryKey: ['featured', slug],
    enabled: !!slug && canFeature,
    queryFn: () => unwrap(api.GET('/communities/{slug}/featured', { params: { path: { slug: slug! } } })),
  });
  const done = (message: string) => {
    toast(message);
    void queryClient.invalidateQueries({ queryKey: ['featured', slug] });
    void queryClient.invalidateQueries({ queryKey: ['chapter'] });
  };
  const add = useMutation({
    mutationFn: (item: { itemType: FeaturedType; itemId: string }) => unwrap(api.POST('/communities/{slug}/featured', { params: { path: { slug: slug! } }, body: item })),
    onSuccess: () => done('Destacado na página da comunidade'),
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/communities/{slug}/featured/{id}', { params: { path: { slug: slug!, id } } })),
    onSuccess: () => done('Destaque removido'),
  });
  return (itemType: FeaturedType, itemId: string): MenuItem[] => {
    if (!canFeature || !slug) return [];
    const existing = featured.data?.find((f) => f.itemType === itemType && f.itemId === itemId);
    return [
      existing
        ? { label: 'Tirar dos destaques', icon: StarOff, onPress: () => remove.mutate(existing.id) }
        : { label: 'Destacar na comunidade', icon: Star, onPress: () => add.mutate({ itemType, itemId }) },
    ];
  };
}

const useStyles = makeStyles((colors) => ({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, maxWidth: '100%' },
  chipWithAvatar: { paddingLeft: 3 },
  chipOnImage: { backgroundColor: 'rgba(0,0,0,0.45)' },
  chipHover: { backgroundColor: colors.brandSoft },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted, flexShrink: 1 },
  chipTextOnImage: { color: '#FFFFFF' },
  link: { color: colors.brand, fontWeight: '600' },
}));
