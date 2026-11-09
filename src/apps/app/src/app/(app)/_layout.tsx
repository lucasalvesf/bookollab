import { Stack } from 'expo-router';

import { NotificationsProvider } from '@/realtime/notifications';

export default function AppLayout() {
  return (
    <NotificationsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </NotificationsProvider>
  );
}
