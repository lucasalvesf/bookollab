import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, colors, Notice } from '@/components/ui';

export default function HomeScreen() {
  const { signOut } = useSession();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error } = await api.GET('/me');
      if (error || !data) throw new Error('Não foi possível carregar seu perfil.');
      return data;
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Bookollab</Text>
      {me.isPending ? (
        <ActivityIndicator color={colors.brand} />
      ) : me.isError ? (
        <Notice kind="error">{me.error.message}</Notice>
      ) : (
        <>
          <Text style={styles.hello}>Olá, {me.data.displayName}!</Text>
          <Text style={styles.handle}>@{me.data.userName}</Text>
          <Text style={styles.muted}>Em breve: suas comunidades, personagens e cenas.</Text>
        </>
      )}
      <View style={styles.actions}>
        <Button title="Sair" variant="secondary" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, backgroundColor: colors.background },
  brand: { fontSize: 28, fontWeight: '700', color: colors.brand, marginBottom: 16 },
  hello: { fontSize: 24, fontWeight: '700', color: colors.text },
  handle: { fontSize: 16, color: colors.textMuted },
  muted: { fontSize: 15, color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  actions: { marginTop: 24, width: '100%', maxWidth: 240 },
});
