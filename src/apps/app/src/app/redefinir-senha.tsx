import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { api, problemMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { AuthScreen, Button, Field, Notice } from '@/components/ui';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const { email, token } = useLocalSearchParams<{ email?: string; token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    if (password !== confirm) {
      setError('As senhas não são iguais.');
      return;
    }
    if (!email || !token) {
      setError('Link incompleto. Abra novamente o link do e-mail.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const { response, error: problem } = await api.POST('/auth/reset-password', { body: { email, token, newPassword: password } });
      if (response.ok) {
        // The API ends every session after a reset; drop the local one too.
        if (session) await signOut();
        setDone(true);
      } else {
        setError(problemMessage(problem) ?? 'Não foi possível redefinir a senha.');
      }
    } catch {
      setError('Sem conexão com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthScreen title="Senha redefinida">
        <Notice kind="success">Pronto! Entre com sua nova senha.</Notice>
        <Button title="Ir para Entrar" onPress={() => router.replace('/entrar')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Nova senha" subtitle={email ? `Conta: ${email}` : undefined}>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field label="Nova senha" value={password} onChangeText={setPassword} hint="Pelo menos 8 caracteres, com um número." secureTextEntry autoComplete="new-password" />
      <Field label="Repita a nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
      <Button title="Salvar nova senha" onPress={submit} loading={loading} />
    </AuthScreen>
  );
}
