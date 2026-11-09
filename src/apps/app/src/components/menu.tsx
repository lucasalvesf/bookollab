import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { MoreHorizontal, type LucideIcon } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

import { makeStyles, radius, shadow, useTheme } from '@/theme';

export type MenuAction = { label: string; icon?: LucideIcon; onPress: () => void; danger?: boolean; hidden?: boolean };
export type MenuItem = MenuAction | 'separator';
type Anchor = { x: number; y: number };
type MenuState = { items: MenuItem[]; at: Anchor; title?: string };

type MenuApi = {
  /** Without an anchor, the menu opens where the previous one was (e.g. a confirmation step). */
  openMenu: (items: MenuItem[], at?: Anchor, title?: string) => void;
  toast: (message: string) => void;
};

const MenuContext = createContext<MenuApi | null>(null);
const MENU_WIDTH = 248;
const SHEET_BREAKPOINT = 600;

/**
 * App-level menus: context menu (right click on web), "⋯" menus and small toasts.
 * Wide screens show a floating menu at the pointer; phones show a bottom sheet.
 */
export function MenuProvider({ children }: PropsWithChildren) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastAnchor = useRef<Anchor>({ x: 0, y: 0 });

  const api = useMemo<MenuApi>(
    () => ({
      openMenu: (items, at, title) => {
        const visible = items.filter((i) => i === 'separator' || !i.hidden);
        const anchor = at ?? lastAnchor.current;
        lastAnchor.current = anchor;
        if (visible.some((i) => i !== 'separator')) setMenu({ items: visible, at: anchor, title });
      },
      toast: (message) => {
        setToastText(message);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastText(null), 2200);
      },
    }),
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const sheet = width < SHEET_BREAKPOINT;
  const actions = menu?.items ?? [];
  const estimated = actions.reduce((h, i) => h + (i === 'separator' ? 9 : 40), 16 + (menu?.title ? 30 : 0));
  const left = menu ? Math.max(8, Math.min(menu.at.x, width - MENU_WIDTH - 8)) : 0;
  const top = menu ? Math.max(8, Math.min(menu.at.y, height - estimated - 8)) : 0;

  const list = (
    <>
      {menu?.title ? <Text style={styles.title} numberOfLines={1}>{menu.title}</Text> : null}
      {actions.map((item, i) =>
        item === 'separator' ? (
          <View key={`sep-${i}`} style={styles.separator} />
        ) : (
          <Pressable
            key={item.label}
            accessibilityRole="menuitem"
            onPress={() => {
              setMenu(null);
              item.onPress();
            }}
            style={({ hovered, pressed }) => [styles.item, (hovered || pressed) && (item.danger ? styles.itemDangerActive : styles.itemActive)]}>
            {item.icon ? <item.icon size={17} color={item.danger ? colors.danger : colors.textMuted} strokeWidth={2.1} /> : null}
            <Text style={[styles.itemText, item.danger && styles.itemDanger]}>{item.label}</Text>
          </Pressable>
        ),
      )}
    </>
  );

  return (
    <MenuContext.Provider value={api}>
      <View style={styles.root}>
        {children}
        {menu ? (
          <View style={styles.layer} accessibilityViewIsModal>
            <Pressable style={[styles.backdrop, sheet && styles.backdropSheet]} onPress={() => setMenu(null)} accessibilityLabel="Fechar menu" />
            {sheet ? (
              <Animated.View entering={SlideInDown.duration(200)} style={styles.sheet} accessibilityRole="menu">
                <View style={styles.handle} />
                {list}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(100)} exiting={FadeOut.duration(80)} style={[styles.menu, { left, top }]} accessibilityRole="menu">
                {list}
              </Animated.View>
            )}
          </View>
        ) : null}
        {toastText ? (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toastText}</Text>
          </Animated.View>
        ) : null}
      </View>
    </MenuContext.Provider>
  );
}

export function useMenu(): MenuApi {
  const api = useContext(MenuContext);
  if (!api) throw new Error('useMenu must be used inside MenuProvider');
  return api;
}

/** Copies an in-app path as a full link (web origin, or the app scheme on native). */
export function useCopyLink() {
  const { toast } = useMenu();
  return useCallback(
    async (path: string) => {
      const url = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}${path}` : Linking.createURL(path);
      await Clipboard.setStringAsync(url);
      toast('Link copiado');
    },
    [toast],
  );
}

/**
 * Right-click area (web). Wrap anything that has actions; the same items should also be reachable
 * through a visible "⋯" (MoreButton) for touch screens.
 */
export function ContextMenu({ items, title, style, children }: { items: MenuItem[]; title?: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useRef<ViewInstance>(null);
  const { openMenu } = useMenu();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(items, { x: e.clientX, y: e.clientY }, title);
    };
    node.addEventListener('contextmenu', onContext);
    return () => node.removeEventListener('contextmenu', onContext);
  }, [items, openMenu, title]);
  return (
    <View ref={ref} style={style}>
      {children}
    </View>
  );
}

/** "⋯" button that opens the same menu, anchored below itself. */
export function MoreButton({ items, title, label = 'Mais opções', size = 34, tone = 'default' }: { items: MenuItem[]; title?: string; label?: string; size?: number; tone?: 'default' | 'onImage' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const ref = useRef<ViewInstance>(null);
  const { openMenu } = useMenu();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() =>
        ref.current?.measureInWindow((x, y, w, h) => openMenu(items, { x: x + w - MENU_WIDTH, y: y + h + 4 }, title))
      }
      style={({ hovered, pressed }) => [styles.more, { width: size, height: size, borderRadius: size / 2 }, tone === 'onImage' && styles.moreOnImage, (hovered || pressed) && styles.moreActive]}>
      <MoreHorizontal size={Math.round(size * 0.55)} color={tone === 'onImage' ? '#FFFFFF' : colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backdropSheet: { backgroundColor: colors.overlay },
  menu: { position: 'absolute', width: MENU_WIDTH, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, ...shadow(colors, 3) },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 8, paddingBottom: 28, paddingHorizontal: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 8 },
  title: { fontSize: 12, fontWeight: '700', color: colors.textSubtle, paddingHorizontal: 14, paddingVertical: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 6, borderRadius: radius.sm },
  itemActive: { backgroundColor: colors.surfaceAlt },
  itemDangerActive: { backgroundColor: colors.dangerBg },
  itemText: { fontSize: 14, fontWeight: '500', color: colors.text },
  itemDanger: { color: colors.danger },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: 4, marginHorizontal: 8 },
  more: { alignItems: 'center', justifyContent: 'center' },
  moreOnImage: { backgroundColor: 'rgba(0,0,0,0.35)' },
  moreActive: { backgroundColor: colors.surfaceAlt },
  toast: { position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, zIndex: 1001 },
  toastText: { color: colors.surface, fontSize: 14, fontWeight: '600' },
}));
