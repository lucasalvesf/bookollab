import { Stack } from 'expo-router';

import { AppShell } from '@/components/app-shell';
import { NotificationsProvider } from '@/realtime/notifications';

export default function AppLayout() {
  return (
    <NotificationsProvider>
      <AppShell>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      </AppShell>
    </NotificationsProvider>
  );
}
