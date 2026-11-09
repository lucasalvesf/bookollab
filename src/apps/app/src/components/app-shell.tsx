import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, type Href } from 'expo-router';
import { BookOpen, Compass, House, Moon, Plus, Sun, UserRound, Bell, type LucideIcon } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { useUnreadNotifications } from '@/realtime/notifications';
import { makeStyles, radius, useTheme } from '@/theme';

import { Avatar } from './avatar';

export const WIDE_SHELL = 900;

/** Top-level destinations that show the mobile bottom bar. */
const TAB_ROUTES = ['/', '/descobrir', '/notificacoes', '/perfil'];

/**
 * Logged-in app frame.
 * Wide screens: Discord-like rail with the user's communities on the left.
 * Narrow screens: bottom tab bar on the top-level destinations (immersive screens like a scene hide it).
 */
export function AppShell({ children }: PropsWithChildren) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  if (width >= WIDE_SHELL) {
    return (
      <View style={styles.wide}>
        <CommunityRail />
        <View style={styles.flex}>{children}</View>
      </View>
    );
  }
  return (
    <View style={styles.flex}>
      <View style={styles.flex}>{children}</View>
      {TAB_ROUTES.includes(pathname) ? <BottomTabs /> : null}
    </View>
  );
}

function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
}

function CommunityRail() {
  const styles = useStyles();
  const { colors, scheme, setPreference } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const unread = useUnreadNotifications();
  const mine = useQuery({ queryKey: ['my-communities'], queryFn: () => unwrap(api.GET('/me/communities')) });

  return (
    <View style={styles.rail}>
      <RailItem label="Início" active={pathname === '/'} onPress={() => router.push('/')}>
        <View style={[styles.logo, pathname === '/' && styles.logoActive]}>
          <BookOpen size={22} color={pathname === '/' ? colors.brandText : colors.brand} strokeWidth={2.4} />
        </View>
      </RailItem>
      <View style={styles.railDivider} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.railList} showsVerticalScrollIndicator={false}>
        {(mine.data ?? []).map((c) => {
          const active = pathname.startsWith(`/c/${c.slug}`);
          return (
            <RailItem key={c.id} label={c.name} active={active} onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } })}>
              <Avatar name={c.name} imageKey={c.iconKey} size={46} shape="rounded" />
            </RailItem>
          );
        })}
        <RailIcon icon={Plus} label="Criar comunidade" active={pathname === '/comunidades/nova'} onPress={() => router.push('/comunidades/nova')} />
        <RailIcon icon={Compass} label="Descobrir comunidades" active={pathname === '/descobrir'} onPress={() => router.push('/descobrir')} />
      </ScrollView>
      <View style={styles.railBottom}>
        <RailIcon icon={Bell} label="Notificações" badge={unread} active={pathname === '/notificacoes'} onPress={() => router.push('/notificacoes')} />
        <RailIcon icon={scheme === 'dark' ? Sun : Moon} label={scheme === 'dark' ? 'Tema claro' : 'Tema escuro'} onPress={() => setPreference(scheme === 'dark' ? 'light' : 'dark')} />
        <RailItem label="Meu perfil" active={pathname === '/perfil'} onPress={() => router.push('/perfil')}>
          {me.data ? <Avatar name={me.data.displayName} imageKey={me.data.avatarKey} size={40} /> : <UserRound size={22} color={colors.textMuted} />}
        </RailItem>
      </View>
    </View>
  );
}

/** Rail entry with the active "pill" indicator on the left, like Discord. */
function RailItem({ label, active, onPress, children }: PropsWithChildren<{ label: string; active?: boolean; onPress: () => void }>) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={styles.railItem}>
      {({ hovered }) => (
        <>
          <View style={[styles.pill, active ? styles.pillActive : hovered ? styles.pillHover : null]} />
          <View style={[styles.railItemInner, (hovered || active) && styles.railItemLift]}>{children}</View>
          {hovered ? (
            <Animated.View entering={FadeIn.duration(120)} style={styles.tooltip} pointerEvents="none">
              <Text style={styles.tooltipText} numberOfLines={1}>{label}</Text>
            </Animated.View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function RailIcon({ icon: Icon, label, active, badge, onPress }: { icon: LucideIcon; label: string; active?: boolean; badge?: number; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <RailItem label={label} active={active} onPress={onPress}>
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
  rail: { width: 76, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingVertical: 12, alignItems: 'center', zIndex: 10 },
  railDivider: { width: 32, height: 2, borderRadius: 1, backgroundColor: colors.border, marginVertical: 8 },
  railList: { gap: 8, alignItems: 'center', paddingBottom: 8 },
  railBottom: { gap: 8, alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  railItem: { width: 76, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  railItemInner: { alignItems: 'center', justifyContent: 'center' },
  railItemLift: { transform: [{ scale: 1.05 }] },
  pill: { position: 'absolute', left: 0, width: 4, height: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: colors.text },
  pillHover: { height: 20 },
  pillActive: { height: 36, backgroundColor: colors.brand },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  logoActive: { backgroundColor: colors.brand },
  railIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  railIconActive: { backgroundColor: colors.brand },
  tooltip: { position: 'absolute', left: 70, backgroundColor: colors.text, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 240 },
  tooltipText: { color: colors.surface, fontSize: 13, fontWeight: '600' },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  tabIcon: { width: 52, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: colors.brandSoft },
  tabLabel: { fontSize: 11, fontWeight: '600' },
}));
