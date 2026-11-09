import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Empty, Loadable, Page, Section } from '@/components/layout';
import { Button, colors } from '@/components/ui';
import { NOTIFICATIONS_KEY } from '@/realtime/notifications';

type Notification = components['schemas']['NotificationDto'];

const ICONS: Record<Notification['type'], string> = {
  YourTurn: '⏳',
  SceneInvite: '✉️',
  SceneJoinRequest: '🙋',
  SceneJoinDecision: '✅',
  Mention: '@',
  ChapterApproval: '📝',
  ChapterDecision: '📜',
  RemovedFromCommunity: '🚪',
};

const timeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: () => unwrap(api.GET('/notifications')) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const readAll = useMutation({ mutationFn: () => unwrap(api.POST('/notifications/read-all')), onSuccess: refresh });

  async function open(n: Notification) {
    if (!n.read) {
      await api.POST('/notifications/{id}/read', { params: { path: { id: n.id } } }).catch(() => undefined);
      void refresh();
    }
    if (n.link) router.push(n.link as Href);
  }

  return (
    <Page
      title="Notificações"
      back
      bell={false}
      actions={list.data && list.data.unreadCount > 0 ? <View style={styles.readAll}><Button title="Marcar todas como lidas" variant="secondary" onPress={() => readAll.mutate()} /></View> : undefined}>
      <Loadable query={list}>
        {(data) => (
          <Section title={data.unreadCount > 0 ? `${data.unreadCount} não lidas` : 'Tudo em dia'}>
            {data.items.length === 0 ? (
              <Empty>Nenhuma notificação ainda.</Empty>
            ) : (
              data.items.map((n) => (
                <Pressable key={n.id} accessibilityRole="button" onPress={() => open(n)} style={({ pressed }) => [styles.row, !n.read && styles.unread, pressed && styles.pressed]}>
                  <Text style={styles.icon}>{ICONS[n.type]}</Text>
                  <View style={styles.text}>
                    <Text style={[styles.title, !n.read && styles.titleUnread]}>{n.title}</Text>
                    {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
                    <Text style={styles.time}>{timeFmt.format(new Date(n.createdAt))}</Text>
                  </View>
                  {!n.read ? <View style={styles.dot} /> : null}
                </Pressable>
              ))
            )}
          </Section>
        )}
      </Loadable>
    </Page>
  );
}

const styles = StyleSheet.create({
  readAll: { minWidth: 200 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.background },
  unread: { backgroundColor: '#F2FAF9' },
  pressed: { opacity: 0.6 },
  icon: { fontSize: 22, width: 30, textAlign: 'center', color: colors.brand, fontWeight: '700' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: colors.text },
  titleUnread: { fontWeight: '700' },
  body: { fontSize: 13, color: colors.textMuted },
  time: { fontSize: 12, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
});
