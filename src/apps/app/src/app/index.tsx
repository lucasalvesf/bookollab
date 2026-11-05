import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';

export default function HomeScreen() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await api.GET('/health');
      if (error || !data) throw new Error('API unavailable');
      return data;
    },
  });

  const apiStatus = health.isPending
    ? 'verificando…'
    : health.isError
      ? 'indisponível'
      : health.data.status;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bookollab</Text>
      <Text style={styles.subtitle}>Histórias colaborativas no estilo RPG de texto</Text>
      <Text style={styles.status}>API: {apiStatus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center' },
  status: { marginTop: 16, fontSize: 14 },
});
