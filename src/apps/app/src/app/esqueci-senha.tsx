import { useRouter } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api/client';
import { AuthScreen, Button, Field, Notice, TextLink } from '@/components/ui';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setLoading(true);
    setError(undefined);
    try {
      await api.POST('/auth/forgot-password', { body: { email } });
      setSent(true);
    } catch {
      setError('Sem conexão com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen title="Esqueci minha senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {error ? <Notice kind="error">{error}</Notice> : null}
      {sent ? (
        <Notice kind="success">Se houver uma conta com {email}, você vai receber um e-mail com o link em instantes.</Notice>
      ) : (
        <>
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" onSubmitEditing={submit} />
          <Button title="Enviar link" onPress={submit} loading={loading} />
        </>
      )}
      <TextLink title="Voltar para Entrar" onPress={() => router.replace('/entrar')} />
    </AuthScreen>
  );
}
