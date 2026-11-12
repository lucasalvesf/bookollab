import { CheckCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Page, Section } from '@/components/layout';
import { NotificationList } from '@/components/notifications-panel';
import { Button } from '@/components/ui';
import { makeStyles } from '@/theme';

/** Every notification (mobile tab). On wide screens the bell opens the same list in a modal. */
export default function NotificationsScreen() {
  const styles = useStyles();
  return (
    <Page title="Notificações">
      <Section title="Todas">
        <NotificationList
          header={(unread, readAll) =>
            unread > 0 ? (
              <View style={styles.header}>
                <Text style={styles.unread}>{`${unread} não ${unread === 1 ? 'lida' : 'lidas'}`}</Text>
                <Button title="Marcar todas como lidas" icon={CheckCheck} size="sm" variant="ghost" onPress={readAll} />
              </View>
            ) : null
          }
        />
      </Section>
    </Page>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  unread: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
}));
