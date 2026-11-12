import { usePathname, useRouter, type Href } from 'expo-router';
import { BookMarked, MessagesSquare, NotebookPen, PenSquare, Plus, Clapperboard, UserRoundPlus, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Polygon, Text as SvgText } from 'react-native-svg';

import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { useActiveCommunity } from './community-context';

type Option = { label: string; hint: string; icon: LucideIcon; href: Href };

/** Twenty-sided die drawn in SVG: outer hexagon, the facets around the front triangle and the "20". */
export function D20({ size, color, faceColor, textColor }: { size: number; color: string; faceColor: string; textColor: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5" fill={color} />
      <Polygon points="50,24 75,67 25,67" fill={faceColor} />
      <Path
        d="M50 3 L50 24 M91 26.5 L75 67 M9 26.5 L25 67 M50 97 L25 67 M50 97 L75 67 M9 73.5 L25 67 M91 73.5 L75 67 M9 26.5 L50 24 L91 26.5"
        stroke={faceColor}
        strokeOpacity={0.55}
        strokeWidth={2.2}
        strokeLinejoin="round"
        fill="none"
      />
      <SvgText x="50" y="58" fontSize="20" fontWeight="800" fill={textColor} textAnchor="middle">20</SvgText>
    </Svg>
  );
}

/** Routes where the button would cover something important (chat composer, form action bars). */
const HIDDEN = [/^\/cenas\//, /\/(novo|nova)$/, /\/staff$/, /^\/comunidades\/nova$/];

/**
 * Floating "create" button (Amino-like) shaped as a d20. Hover (web) or tap opens what can be created
 * here, grouped so it never becomes a wall of options; only what the member is allowed to create shows.
 */
export function CreateFab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { slug, community } = useActiveCommunity();
  // Open state is tied to the route: navigating anywhere closes the menu.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const spin = useSharedValue(0);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }, { scale: scale.get() }] }));

  if (HIDDEN.some((r) => r.test(pathname))) return null;

  const perms = new Set(community?.me?.permissions ?? []);
  const groups: { title: string; options: Option[] }[] = slug && community
    ? [
        {
          title: 'Escrever',
          options: [
            ...(perms.has('WriteChapters') ? [{ label: 'Capítulo', hint: 'Como um personagem', icon: NotebookPen, href: { pathname: '/c/[slug]/capitulos/novo', params: { slug } } } as Option] : []),
            ...(perms.has('WriteChapters') ? [{ label: 'Blog', hint: 'Post OFF, como você', icon: PenSquare, href: { pathname: '/c/[slug]/capitulos/novo', params: { slug, kind: 'blog' } } } as Option] : []),
          ],
        },
        {
          title: 'Conversar',
          options: [
            ...(perms.has('JoinScenes') ? [{ label: 'Chat público', hint: 'OFF, todos conversam', icon: MessagesSquare, href: { pathname: '/c/[slug]/cenas/nova', params: { slug, kind: 'chat' } } } as Option] : []),
            ...(perms.has('OpenScenes') ? [{ label: 'Cena', hint: 'ON, com personagens', icon: Clapperboard, href: { pathname: '/c/[slug]/cenas/nova', params: { slug } } } as Option] : []),
          ],
        },
        {
          title: 'Mundo',
          options: [
            ...(perms.has('CreateCharacters') ? [{ label: 'Personagem', hint: 'Sua ficha jogável', icon: UserRoundPlus, href: { pathname: '/c/[slug]/personagens/novo', params: { slug } } } as Option] : []),
            { label: 'Ficha da enciclopédia', hint: 'Lugar, facção, criatura…', icon: BookMarked, href: { pathname: '/c/[slug]/enciclopedia/nova', params: { slug } } } as Option,
          ],
        },
      ].filter((g) => g.options.length)
    : [{ title: 'Criar', options: [{ label: 'Comunidade', hint: 'Seu próprio mundo', icon: Plus, href: '/comunidades/nova' }] }];

  const show = () => {
    clearTimeout(closeTimer.current);
    if (!open) {
      spin.set(withSequence(withTiming(spin.get() + 360, { duration: 520 })));
      scale.set(withSpring(1.1, { damping: 9 }));
    }
    setOpen(true);
  };
  const hide = (delay = 220) => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      scale.set(withSpring(1));
    }, delay);
  };
  const hover = Platform.OS === 'web' ? { onHoverIn: show, onHoverOut: () => hide() } : {};

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      {open ? (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={styles.menu}>
          <Pressable {...hover} style={styles.menuInner}>
            {groups.map((g) => (
              <View key={g.title} style={styles.group}>
                <Text style={styles.groupTitle}>{g.title}</Text>
                {g.options.map((o) => (
                  <Pressable
                    key={o.label}
                    accessibilityRole="button"
                    onPress={() => {
                      setOpen(false);
                      router.push(o.href);
                    }}
                    style={({ hovered, pressed }) => [styles.option, (hovered || pressed) && styles.optionHover]}>
                    <View style={styles.optionIcon}>
                      <o.icon size={18} color={colors.brandSoftText} strokeWidth={2.2} />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>{o.label}</Text>
                      <Text style={styles.optionHint}>{o.hint}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </Pressable>
        </Animated.View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={community ? `Criar em ${community.name}` : 'Criar'}
        accessibilityState={{ expanded: open }}
        onPress={() => (open ? hide(0) : show())}
        {...hover}
        style={styles.fab}>
        <Animated.View style={anim}>
          <D20 size={60} color={colors.brand} faceColor={colors.brandText} textColor={colors.brand} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  anchor: { position: 'absolute', right: 28, bottom: 28, alignItems: 'flex-end', zIndex: 60 },
  fab: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, ...shadow(colors, 3) },
  menu: { marginBottom: 10 },
  menuInner: { width: 260, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 8, gap: 4, ...shadow(colors, 3) },
  group: { gap: 2, paddingBottom: 4 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 7, borderRadius: radius.md },
  optionHover: { backgroundColor: colors.surfaceAlt },
  optionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  optionHint: { fontSize: 12, color: colors.textMuted },
}));
