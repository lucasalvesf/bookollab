import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { AuthScreen, Button, colors, Notice } from '@/components/ui';

type State = { status: 'loading' } | { status: 'done' } | { status: 'error'; message: string };

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const { userId, token } = useLocalSearchParams<{ userId?: string; token?: string }>();
  const [result, setResult] = useState<State>({ status: 'loading' });
  const state: State = !userId || !token ? { status: 'error', message: 'Link incompleto. Abra novamente o link do e-mail.' } : result;

  useEffect(() => {
    if (!userId || !token) return;
    api
      .POST('/auth/confirm-email', { body: { userId, token } })
      .then(({ response, error }) =>
        setResult(response.ok ? { status: 'done' } : { status: 'error', message: problemMessage(error) ?? 'Link inválido ou expirado.' }),
      )
      .catch(() => setResult({ status: 'error', message: 'Sem conexão com o servidor. Tente novamente.' }));
  }, [userId, token]);

  return (
    <AuthScreen title="Confirmação de e-mail">
      {state.status === 'loading' ? <ActivityIndicator color={colors.brand} /> : null}
      {state.status === 'done' ? <Notice kind="success">E-mail confirmado! Agora você já pode entrar.</Notice> : null}
      {state.status === 'error' ? (
        <Notice kind="error">{`${state.message} Se o link expirou, tente entrar para receber um novo.`}</Notice>
      ) : null}
      {state.status !== 'loading' ? <Button title="Ir para Entrar" onPress={() => router.replace('/entrar')} /> : null}
    </AuthScreen>
  );
}
