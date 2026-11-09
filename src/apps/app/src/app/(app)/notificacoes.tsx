import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { AtSign, BellOff, CheckCheck, DoorOpen, FileCheck2, FilePen, Hourglass, Mail, UserPlus, UserRoundCheck, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Empty, Loadable, Page, Section } from '@/components/layout';
import { Button } from '@/components/ui';
import { NOTIFICATIONS_KEY } from '@/realtime/notifications';
import { makeStyles, radius, useTheme } from '@/theme';

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

export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
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
      actions={list.data && list.data.unreadCount > 0 ? <Button title="Marcar todas como lidas" icon={CheckCheck} size="sm" variant="secondary" onPress={() => readAll.mutate()} /> : undefined}>
      <Loadable query={list}>
        {(data) => (
          <Section title={data.unreadCount > 0 ? `${data.unreadCount} não lidas` : 'Tudo em dia'}>
            {data.items.length === 0 ? (
              <Empty icon={BellOff}>Nenhuma notificação ainda.</Empty>
            ) : (
              data.items.map((n) => {
                const Icon = ICONS[n.type];
                return (
                  <Pressable key={n.id} accessibilityRole="button" onPress={() => open(n)} style={({ pressed, hovered }) => [styles.row, !n.read && styles.unread, (pressed || hovered) && styles.active]}>
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
                );
              })
            )}
          </Section>
        )}
      </Loadable>
    </Page>
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
}));
