import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { ArrowRight, AtSign, BellOff, Check, CheckCheck, DoorOpen, FileCheck2, FilePen, Globe, Hourglass, Mail, UserPlus, UserRoundCheck, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { NOTIFICATIONS_KEY } from '@/realtime/notifications';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Empty, Loadable } from './layout';
import { ContextMenu } from './menu';
import { Button, IconButton } from './ui';

type Notification = components['schemas']['NotificationDto'];

const ICONS: Record<Notification['type'], LucideIcon> = {
  YourTurn: Hourglass,
  SceneInvite: Mail,
  SceneJoinRequest: UserPlus,
  SceneJoinDecision: UserRoundCheck,
  Mention: AtSign,
  ChapterApproval: FilePen,
  ChapterDecision: FileCheck2,
  RemovedFromCommunity: DoorOpen,
};

const timeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Notification list, all of them or only one community's. Used by the screen (mobile) and the modal (web). */
export function NotificationList({ communityId, onOpened, header }: { communityId?: string; onOpened?: () => void; header?: (unread: number, readAll: () => void) => React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: communityId ? [...NOTIFICATIONS_KEY, communityId] : NOTIFICATIONS_KEY,
    queryFn: () => unwrap(api.GET('/notifications', { params: { query: communityId ? { communityId } : {} } })),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const readAll = useMutation({ mutationFn: () => unwrap(api.POST('/notifications/read-all', { params: { query: communityId ? { communityId } : {} } })), onSuccess: refresh });

  async function open(n: Notification) {
    if (!n.read) {
      await api.POST('/notifications/{id}/read', { params: { path: { id: n.id } } }).catch(() => undefined);
      void refresh();
    }
    if (n.link) {
      onOpened?.();
      router.push(n.link as Href);
    }
  }

  return (
    <Loadable query={list}>
      {(data) => (
        <View>
          {header?.(data.unreadCount, () => readAll.mutate())}
          {data.items.length === 0 ? (
            <Empty icon={BellOff}>Nenhuma notificação aqui ainda.</Empty>
          ) : (
            data.items.map((n) => {
              const Icon = ICONS[n.type];
              return (
                <ContextMenu
                  key={n.id}
                  title={n.title}
                  items={[
                    { label: 'Abrir', icon: ArrowRight, hidden: !n.link, onPress: () => void open(n) },
                    { label: 'Marcar como lida', icon: Check, hidden: n.read, onPress: () => void api.POST('/notifications/{id}/read', { params: { path: { id: n.id } } }).then(refresh) },
                  ]}>
                  <Pressable accessibilityRole="button" onPress={() => open(n)} style={({ pressed, hovered }) => [styles.row, !n.read && styles.unread, (pressed || hovered) && styles.active]}>
                    <View style={[styles.icon, !n.read && styles.iconUnread]}>
                      <Icon size={18} color={n.read ? colors.textMuted : colors.brandText} strokeWidth={2.2} />
                    </View>
                    <View style={styles.text}>
                      <Text style={[styles.title, !n.read && styles.titleUnread]}>{n.title}</Text>
                      {n.body ? <Text style={styles.body} numberOfLines={2}>{n.body}</Text> : null}
                      <Text style={styles.time}>{timeFmt.format(new Date(n.createdAt))}</Text>
                    </View>
                    {!n.read ? <View style={styles.dot} /> : null}
                  </Pressable>
                </ContextMenu>
              );
            })
          )}
        </View>
      )}
    </Loadable>
  );
}

/** Blur behind modals on the web (React Native Web drops backdropFilter from styles, so it goes on the node). */
export function blurBehind(node: unknown) {
  if (Platform.OS !== 'web' || !node) return;
  const style = (node as HTMLElement).style;
  style.backdropFilter = 'blur(10px) saturate(120%)';
  style.setProperty('-webkit-backdrop-filter', 'blur(10px) saturate(120%)');
}

/**
 * Notifications over a blurred screen. Inside a community it opens on "Notificações - <comunidade>" with a
 * globe tab for everything; outside any community it shows everything.
 */
export function NotificationsModal({ community, onClose }: { community?: { id: string; name: string; iconKey?: string | null }; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [scope, setScope] = useState<'community' | 'global'>(community ? 'community' : 'global');
  const current = community && scope === 'community' ? community : undefined;
  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.backdrop} ref={blurBehind}>
      <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Fechar notificações" />
      <Animated.View entering={ZoomIn.duration(180)} style={styles.modal} accessibilityViewIsModal>
        <View style={styles.modalHeader}>
          {current ? <Avatar name={current.name} imageKey={current.iconKey} size={30} shape="rounded" /> : <Globe size={22} color={colors.brand} />}
          <Text style={styles.modalTitle} numberOfLines={1}>{current ? `Notificações - ${current.name}` : 'Notificações - Global'}</Text>
          <IconButton icon={X} label="Fechar" size={34} onPress={onClose} />
        </View>
        {community ? (
          <View style={styles.tabs} accessibilityRole="tablist">
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: scope === 'community' }} onPress={() => setScope('community')} style={[styles.tab, scope === 'community' && styles.tabOn]}>
              <Avatar name={community.name} imageKey={community.iconKey} size={18} shape="rounded" />
              <Text style={[styles.tabText, scope === 'community' && styles.tabTextOn]} numberOfLines={1}>{community.name}</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: scope === 'global' }} onPress={() => setScope('global')} style={[styles.tab, scope === 'global' && styles.tabOn]}>
              <Globe size={16} color={scope === 'global' ? colors.brandSoftText : colors.textMuted} />
              <Text style={[styles.tabText, scope === 'global' && styles.tabTextOn]}>Global</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView style={styles.list}>
          <NotificationList
            key={scope}
            communityId={current?.id}
            onOpened={onClose}
            header={(unread, readAll) =>
              unread > 0 ? (
                <View style={styles.listHeader}>
                  <Text style={styles.unreadText}>{`${unread} não ${unread === 1 ? 'lida' : 'lidas'}`}</Text>
                  <Button title="Marcar todas como lidas" icon={CheckCheck} size="sm" variant="ghost" onPress={readAll} />
                </View>
              ) : null
            }
          />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  unread: { backgroundColor: colors.brandSoft },
  active: { opacity: 0.85 },
  icon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  iconUnread: { backgroundColor: colors.brand },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: colors.text },
  titleUnread: { fontWeight: '700' },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  time: { fontSize: 12, color: colors.textSubtle },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 100 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modal: { width: '100%', maxWidth: 560, maxHeight: '86%', backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow(colors, 3) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, maxWidth: 260 },
  tabOn: { backgroundColor: colors.brandSoft },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextOn: { color: colors.brandSoftText },
  list: { flexGrow: 0 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
}));
