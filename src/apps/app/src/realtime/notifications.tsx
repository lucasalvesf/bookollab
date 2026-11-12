import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';

import { API_URL, api, validAccessToken } from '@/api/client';
import { unwrap } from '@/api/hooks';

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

/** Unread notifications per community id (red dots on the community icons). */
export function useUnreadByCommunity(): Record<string, number> {
  const { data } = useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'by-community'], queryFn: () => unwrap(api.GET('/notifications/unread-by-community')) });
  return Object.fromEntries((data ?? []).map((r) => [r.communityId, r.count]));
}

/** Unread notifications count, shown as a badge in the app shell. */
export function useUnreadNotifications(): number {
  const { data } = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: () => unwrap(api.GET('/notifications')) });
  return data?.unreadCount ?? 0;
}