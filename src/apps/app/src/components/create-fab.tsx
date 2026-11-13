import { usePathname, useRouter, type Href } from 'expo-router';
import { VenetianMask } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Polygon, Text as SvgText } from 'react-native-svg';

import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { useActiveCommunity } from './community-context';

/** Twenty-sided die: outer hexagon, the facets around the front triangle and a label (+ or the rolled number). */
export function D20({ size, color, faceColor, textColor, label = '20' }: { size: number; color: string; faceColor: string; textColor: string; label?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5" fill={color} />
      <Polygon points="50,24 75,67 25,67" fill={faceColor} />
      <Path d="M50 3 L50 24 M91 26.5 L75 67 M9 26.5 L25 67 M50 97 L25 67 M50 97 L75 67 M9 73.5 L25 67 M91 73.5 L75 67 M9 26.5 L50 24 L91 26.5" stroke={faceColor} strokeOpacity={0.55} strokeWidth={2.2} strokeLinejoin="round" fill="none" />
      <SvgText x="50" y={label === '+' ? 61 : 58} fontSize={label === '+' ? 30 : 20} fontWeight="800" fill={textColor} textAnchor="middle">{label}</SvgText>
    </Svg>
  );
}

type DieKind = 'd4' | 'd6' | 'd8' | 'd10' | 'd12';

/** Small polyhedral die silhouette (d4 triangle, d6 square, d8 diamond, d10 kite, d12 pentagon). */
function Die({ kind, color, size = 46 }: { kind: DieKind; color: string; size?: number }) {
  const shapes: Record<DieKind, { outer: string; inner: string }> = {
    d4: { outer: '50,6 94,88 6,88', inner: 'M50 6 L50 62 M6 88 L50 62 L94 88' },
    d6: { outer: '14,14 86,14 86,86 14,86', inner: 'M14 14 L36 32 L86 14 M36 32 L36 86' },
    d8: { outer: '50,4 92,50 50,96 8,50', inner: 'M8 50 L92 50 M50 4 L50 96' },
    d10: { outer: '50,4 92,40 74,94 26,94 8,40', inner: 'M50 4 L50 58 M8 40 L50 58 L92 40 M26 94 L50 58 L74 94' },
    d12: { outer: '50,4 94,36 77,92 23,92 6,36', inner: 'M50 22 L72 40 L64 70 L36 70 L28 40 Z' },
  };
  const s = shapes[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points={s.outer} fill={color} stroke="rgba(0,0,0,0.12)" strokeWidth={2} strokeLinejoin="round" />
      <Path d={s.inner} stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

type Sub = { label: string; on?: boolean; href: Href };
type Option = { key: string; label: string; die: DieKind; color: string; href?: Href; subs?: Sub[] };

/** Routes where the button would cover something important (chat composer, form action bars). */
const HIDDEN = [/^\/cenas\//, /\/(novo|nova)$/, /\/staff$/, /^\/comunidades\/nova$/];

/**
 * Floating "create" button (Amino-like): a d20 with "+". Hovering rolls it (it lands on a random number)
 * and deals one colored die per thing you can create here; hovering a die shows its choices as ON/OFF pills.
 * Colors are fixed (not the community's) so each kind of creation is always recognizable.
 */
export function CreateFab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { slug, community } = useActiveCommunity();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const [face, setFace] = useState('+');
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const roller = useRef<ReturnType<typeof setInterval>>(undefined);
  const spin = useSharedValue(0);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }, { scale: scale.get() }] }));
  // Idle attention: a soft halo that breathes behind the die (hidden while the menu is open).
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - pulse.get()), transform: [{ scale: 1 + pulse.get() * 0.55 }] }));
  useEffect(() => () => {
    clearTimeout(timer.current);
    clearInterval(roller.current);
  }, []);

  if (HIDDEN.some((r) => r.test(pathname))) return null;
  const perms = new Set(community?.me?.permissions ?? []);
  const options: Option[] = slug && community
    ? [
        perms.has('WriteChapters') ? { key: 'post', label: 'Novo post', die: 'd4', color: '#E8573C', subs: [
          { label: 'Capítulo', on: true, href: { pathname: '/c/[slug]/capitulos/novo', params: { slug } } },
          { label: 'Blog', on: false, href: { pathname: '/c/[slug]/capitulos/novo', params: { slug, kind: 'blog' } } },
        ] } : null,
        perms.has('JoinScenes') ? { key: 'chat', label: 'Novo chat', die: 'd6', color: '#2F9E8F', subs: [
          { label: 'Chat público', on: false, href: { pathname: '/c/[slug]/cenas/nova', params: { slug, kind: 'chat' } } },
          ...(perms.has('OpenScenes') ? [{ label: 'Cena', on: true, href: { pathname: '/c/[slug]/cenas/nova', params: { slug } } } as Sub] : []),
        ] } : null,
        perms.has('CreateCharacters') ? { key: 'character', label: 'Personagem', die: 'd8', color: '#7B5CD6', href: { pathname: '/c/[slug]/personagens/novo', params: { slug } } } : null,
        { key: 'sheet', label: 'Ficha', die: 'd10', color: '#D99A1E', href: { pathname: '/c/[slug]/enciclopedia/nova', params: { slug } } },
      ].filter(Boolean) as Option[]
    : [{ key: 'community', label: 'Comunidade', die: 'd12', color: '#3D7BD9', href: '/comunidades/nova' }];

  const roll = () => {
    clearInterval(roller.current);
    // Number flickers while the die tumbles, then lands on a random face.
    roller.current = setInterval(() => setFace(String(1 + Math.floor(Math.random() * 20))), 70);
    setTimeout(() => clearInterval(roller.current), 620);
    spin.set(withTiming(spin.get() + 720, { duration: 700, easing: Easing.out(Easing.cubic) }));
    scale.set(withSequence(withTiming(1.18, { duration: 180, easing: Easing.out(Easing.quad) }), withSpring(1.06, { damping: 10, stiffness: 140 })));
  };
  const show = () => {
    clearTimeout(timer.current);
    if (!open) {
      roll();
      setOpenAt(pathname);
    }
  };
  const hide = (delay = 260) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpenAt(null);
      setHoverKey(null);
      setFace('+');
      scale.set(withSpring(1, { damping: 14, stiffness: 160 }));
    }, delay);
  };
  const go = (href: Href) => {
    setOpenAt(null);
    setFace('+');
    router.push(href);
  };
  const hover = Platform.OS === 'web' ? ({ onMouseEnter: show, onMouseLeave: () => hide() } as object) : {};

  return (
    <View style={styles.anchor} pointerEvents="box-none" {...hover}>
      {open ? (
        <View style={styles.stack}>
          {options.map((o, i) => (
            <Animated.View key={o.key} entering={ZoomIn.delay(60 * (options.length - i)).springify().damping(14)} exiting={FadeOut.duration(120)} style={styles.optionRow}>
              {hoverKey === o.key && o.subs ? (
                <Animated.View entering={FadeIn.duration(160)} style={styles.subs}>
                  {o.subs.map((s) => (
                    <Pressable key={s.label} accessibilityRole="button" accessibilityLabel={`${s.label} ${s.on ? 'ON' : 'OFF'}`} onPress={() => go(s.href)} style={({ hovered }) => [styles.sub, hovered && { borderColor: o.color }]}>
                      {s.on ? <VenetianMask size={13} color={o.color} strokeWidth={2.4} /> : null}
                      <Text style={styles.subText}>{s.label}</Text>
                      <View style={[styles.pill, { backgroundColor: s.on ? o.color : colors.surfaceAlt }]}>
                        <Text style={[styles.pillText, { color: s.on ? '#FFFFFF' : colors.textMuted }]}>{s.on ? 'ON' : 'OFF'}</Text>
                      </View>
                    </Pressable>
                  ))}
                </Animated.View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={o.label}
                onHoverIn={() => setHoverKey(o.key)}
                onPress={() => (o.href ? go(o.href) : setHoverKey(hoverKey === o.key ? null : o.key))}
                style={styles.option}>
                {({ hovered }) => (
                  <>
                    <View style={[styles.optionLabel, hovered && { backgroundColor: o.color }]}>
                      <Text style={[styles.optionLabelText, hovered && styles.optionLabelTextOn]}>{o.label}</Text>
                    </View>
                    <View style={[styles.die, hovered && styles.dieHover]}>
                      <Die kind={o.die} color={o.color} size={52} />
                    </View>
                  </>
                )}
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={community ? `Criar em ${community.name}` : 'Criar'}
        accessibilityState={{ expanded: open }}
        onPress={() => (open ? hide(0) : show())}
        style={styles.fab}>
        {open ? null : <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: colors.brand }, halo]} />}
        <Animated.View style={anim}>
          <D20 size={104} color={colors.brand} faceColor={colors.brandText} textColor={colors.brand} label={face} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  anchor: { position: 'absolute', right: 120, bottom: 30, alignItems: 'flex-end', zIndex: 60, paddingTop: 8, paddingLeft: 8 },
  fab: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', borderRadius: 52 },
  halo: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  stack: { alignItems: 'flex-end', gap: 12, marginBottom: 6, marginRight: 18 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionLabel: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, ...shadow(colors, 2) },
  optionLabelText: { fontSize: 13, fontWeight: '700', color: colors.text },
  optionLabelTextOn: { color: '#FFFFFF' },
  die: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow(colors, 2) },
  dieHover: { transform: [{ scale: 1.12 }, { rotate: '-12deg' }] },
  subs: { flexDirection: 'row', gap: 8 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, paddingLeft: 12, paddingRight: 6, paddingVertical: 5, ...shadow(colors, 2) },
  subText: { fontSize: 13, fontWeight: '600', color: colors.text },
  pill: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
}));
