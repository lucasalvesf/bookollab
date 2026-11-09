import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { API_URL, api, validAccessToken } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { colors } from '@/components/ui';

export const NOTIFICATIONS_KEY = ['notifications'];

/** Keeps the notification list fresh: loads it and listens to the per-user realtime channel. */
export function NotificationsProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: () => unwrap(api.GET('/notifications')) });

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/notifications`, { accessTokenFactory: async () => (await validAccessToken()) ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on('NotificationCreated', () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }));
    connection.onreconnected(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }));
    void connection.start().catch(() => undefined);
    return () => void connection.stop();
  }, [queryClient]);

  return <>{children}</>;
}

/** Bell button with the unread count; opens the notifications screen. */
export function NotificationBell() {
  const router = useRouter();
  const { data } = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: () => unwrap(api.GET('/notifications')) });
  const unread = data?.unreadCount ?? 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Notificações${unread ? `, ${unread} novas` : ''}`} onPress={() => router.push('/notificacoes')} style={styles.bell}>
      <Text style={styles.icon}>🔔</Text>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 24 },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
