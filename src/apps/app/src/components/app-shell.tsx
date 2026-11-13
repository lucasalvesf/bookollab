import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Bell, BookOpen, Compass, House, LogOut, Moon, Plus, Search, Sun, UserRound, type LucideIcon } from 'lucide-react-native';
import { useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { useUnreadByCommunity, useUnreadNotifications } from '@/realtime/notifications';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { useSession } from '@/auth/session';

import { Avatar } from './avatar';
import { ActiveCommunityProvider, useActiveCommunity } from './community-context';
import { CommunityDrawer } from './community-drawer';
import { useCommunityMenu } from './community-menu';
import { CreateFab } from './create-fab';
import { BackgroundLayer } from './page-background';
import { ContextMenu } from './menu';
import { NotificationsModal } from './notifications-panel';
import { QuickSwitcherProvider, useQuickSwitcher } from './quick-switcher';

export const WIDE_SHELL = 900;
const RAIL = 76;
const RAIL_OPEN = 264;

/** Top-level destinations that show the mobile bottom bar. */
const TAB_ROUTES = ['/', '/descobrir', '/notificacoes', '/perfil'];

/**
 * Logged-in app frame.
 * Wide screens: Discord-like rail with the user's communities on the left; hovering it expands it over
 * the page with the names. Inside a community: the d20 "create" button and the right-hand side menu.
 * Narrow screens: bottom tab bar on the top-level destinations (immersive screens like a scene hide it).
 */
export function AppShell({ children }: PropsWithChildren) {
  return (
    <QuickSwitcherProvider>
      <ActiveCommunityProvider>
        <ShellFrame>{children}</ShellFrame>
      </ActiveCommunityProvider>
    </QuickSwitcherProvider>
  );
}

function ShellFrame({ children }: PropsWithChildren) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { community } = useActiveCommunity();
  const [notifications, setNotifications] = useState(false);
  const wide = width >= WIDE_SHELL;
  return wide ? (
    <View style={styles.wide}>
      <View style={styles.railSlot}>
        <CommunityRail onBell={() => setNotifications(true)} />
      </View>
      <View style={styles.flex}>
        {community?.backgroundKey ? <BackgroundLayer value={{ imageKey: community.backgroundKey, color: null, blur: community.backgroundBlur ?? 0 }} /> : null}
        {children}
        <CreateFab />
        {community && !pathname.startsWith('/cenas/') ? <CommunityDrawer community={community} /> : null}
      </View>
      {notifications ? (
        <NotificationsModal community={community ? { id: community.id, name: community.name, iconKey: community.iconKey } : undefined} onClose={() => setNotifications(false)} />
      ) : null}
    </View>
  ) : (
    <View style={styles.flex}>
      <View style={styles.flex}>
        {children}
        {TAB_ROUTES.includes(pathname) || pathname.startsWith('/c/') ? <CreateFab /> : null}
      </View>
      {TAB_ROUTES.includes(pathname) ? <BottomTabs /> : null}
    </View>
  );
}

function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
}

/** Left rail. Collapsed it shows icons; on hover it grows over the page (no layout shift) and shows the names. */
function CommunityRail({ onBell }: { onBell: () => void }) {
  const styles = useStyles();
  const { colors, scheme, setPreference } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const unread = useUnreadNotifications();
  const unreadBy = useUnreadByCommunity();
  const mine = useQuery({ queryKey: ['my-communities'], queryFn: () => unwrap(api.GET('/me/communities')) });
  const communityMenu = useCommunityMenu();
  const openSearch = useQuickSwitcher();
  const { signOut } = useSession();
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const w = useSharedValue(RAIL);
  const anim = useAnimatedStyle(() => ({ width: w.get() }));
  const setOpen = (open: boolean) => {
    clearTimeout(timer.current);
    // Small delay on the way in, so crossing the rail with the mouse doesn't flash it open.
    timer.current = setTimeout(() => {
      setExpanded(open);
      w.set(withTiming(open ? RAIL_OPEN : RAIL, { duration: 180 }));
    }, open ? 120 : 60);
  };
  // DOM mouseenter/mouseleave (forwarded by React Native Web): unlike Pressable hover, they keep working over the items inside.
  const hover = Platform.OS === 'web' ? ({ onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) } as object) : {};

  return (
    <Animated.View style={[styles.rail, expanded && styles.railOpen, anim]} {...hover}>
      <View style={styles.railInner}>
        <RailItem label="Início" expanded={expanded} active={pathname === '/'} onPress={() => router.push('/')}>
          <View style={[styles.logo, pathname === '/' && styles.logoActive]}>
            <BookOpen size={22} color={pathname === '/' ? colors.brandText : colors.brand} strokeWidth={2.4} />
          </View>
        </RailItem>
        <RailIcon icon={Search} label="Buscar (Ctrl+K)" expanded={expanded} onPress={openSearch} />
        <View style={styles.railDivider} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.railList} showsVerticalScrollIndicator={false}>
          {(mine.data ?? []).map((c) => {
            const active = pathname.startsWith(`/c/${c.slug}`);
            const count = unreadBy[c.id] ?? 0;
            return (
              <ContextMenu key={c.id} items={communityMenu(c)} title={c.name}>
                <RailItem label={c.name} expanded={expanded} active={active} onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } })}>
                  <View>
                    <Avatar name={c.name} imageKey={c.iconKey} size={46} shape="rounded" />
                    {count ? <View style={styles.dot} accessibilityLabel={`${count} notificações não lidas`} /> : null}
                  </View>
                </RailItem>
              </ContextMenu>
            );
          })}
          <RailIcon icon={Plus} label="Criar comunidade" expanded={expanded} active={pathname === '/comunidades/nova'} onPress={() => router.push('/comunidades/nova')} />
          <RailIcon icon={Compass} label="Descobrir comunidades" expanded={expanded} active={pathname === '/descobrir'} onPress={() => router.push('/descobrir')} />
        </ScrollView>
        <View style={styles.railBottom}>
          <RailIcon icon={Bell} label="Notificações" expanded={expanded} badge={unread} onPress={onBell} />
          <RailIcon icon={scheme === 'dark' ? Sun : Moon} label={scheme === 'dark' ? 'Tema claro' : 'Tema escuro'} expanded={expanded} onPress={() => setPreference(scheme === 'dark' ? 'light' : 'dark')} />
          <ContextMenu
            title={me.data ? `@${me.data.userName}` : undefined}
            items={[
              { label: 'Meu perfil e aparência', icon: UserRound, onPress: () => router.push('/perfil') },
              { label: 'Ver perfil público', icon: House, hidden: !me.data, onPress: () => router.push({ pathname: '/u/[userName]', params: { userName: me.data!.userName } }) },
              'separator',
              { label: 'Sair da conta', icon: LogOut, danger: true, onPress: signOut },
            ]}>
            <RailItem label={me.data?.displayName ?? 'Meu perfil'} expanded={expanded} active={pathname === '/perfil'} onPress={() => router.push('/perfil')}>
              {me.data ? <Avatar name={me.data.displayName} imageKey={me.data.avatarKey} size={40} /> : <UserRound size={22} color={colors.textMuted} />}
            </RailItem>
          </ContextMenu>
        </View>
      </View>
    </Animated.View>
  );
}

/** Rail entry with the active "pill" indicator on the left (Discord) and the name when the rail is open. */
function RailItem({ label, active, expanded, onPress, children }: { label: string; active?: boolean; expanded: boolean; onPress: () => void; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={({ hovered }) => [styles.railItem, expanded && hovered && styles.railItemHover]}>
      {({ hovered }) => (
        <>
          <View style={[styles.pill, active ? styles.pillActive : hovered ? styles.pillHover : null]} />
          <View style={styles.railIconSlot}>
            <View style={(hovered || active) && styles.railItemLift}>{children}</View>
          </View>
          {expanded ? (
            <Text style={[styles.railLabel, active && styles.railLabelActive]} numberOfLines={1}>{label}</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function RailIcon({ icon: Icon, label, active, badge, expanded, onPress }: { icon: LucideIcon; label: string; active?: boolean; badge?: number; expanded: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <RailItem label={label} active={active} expanded={expanded} onPress={onPress}>
      <View style={[styles.railIcon, active && styles.railIconActive]}>
        <Icon size={22} color={active ? colors.brandText : colors.textMuted} strokeWidth={2.1} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
    </RailItem>
  );
}

function BottomTabs() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const unread = useUnreadNotifications();
  const me = useMe();
  const tabs: { href: Href; path: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: '/', path: '/', label: 'Início', icon: House },
    { href: '/descobrir', path: '/descobrir', label: 'Descobrir', icon: Compass },
    { href: '/notificacoes', path: '/notificacoes', label: 'Avisos', icon: Bell, badge: unread },
    { href: '/perfil', path: '/perfil', label: 'Perfil', icon: UserRound },
  ];
  return (
    <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = pathname === t.path;
        const color = active ? colors.brand : colors.textSubtle;
        return (
          <Pressable key={t.path} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t.label} onPress={() => router.navigate(t.href)} style={styles.tab}>
            <View style={[styles.tabIcon, active && styles.tabIconActive]}>
              {t.path === '/perfil' && me.data ? (
                <Avatar name={me.data.displayName} imageKey={me.data.avatarKey} size={24} />
              ) : (
                <t.icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
              )}
              {t.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.badge > 99 ? '99+' : t.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, { color }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  wide: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  railSlot: { width: RAIL, zIndex: 50 },
  rail: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.rail, borderRightWidth: 1, borderRightColor: colors.border, overflow: 'hidden' },
  railOpen: { ...shadow(colors, 3) },
  railInner: { flex: 1, paddingVertical: 12 },
  railDivider: { width: 32, height: 2, borderRadius: 1, backgroundColor: colors.border, marginVertical: 8, marginLeft: (RAIL - 32) / 2 },
  railList: { gap: 6, paddingBottom: 8 },
  railBottom: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  railItem: { flexDirection: 'row', alignItems: 'center', minHeight: 50, marginRight: 8, borderRadius: radius.md },
  railItemHover: { backgroundColor: colors.surfaceAlt },
  railIconSlot: { width: RAIL, alignItems: 'center', justifyContent: 'center' },
  railItemLift: { transform: [{ scale: 1.05 }] },
  railLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textMuted, marginLeft: -6, paddingRight: 8 },
  railLabelActive: { color: colors.text, fontWeight: '700' },
  pill: { position: 'absolute', left: 0, width: 4, height: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: colors.text },
  pillHover: { height: 20 },
  pillActive: { height: 36, backgroundColor: colors.brand },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  logoActive: { backgroundColor: colors.brand },
  railIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  railIconActive: { backgroundColor: colors.brand },
  dot: { position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.danger, borderWidth: 2.5, borderColor: colors.surface },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  tabIcon: { width: 52, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: colors.brandSoft },
  tabLabel: { fontSize: 11, fontWeight: '600' },
}));
