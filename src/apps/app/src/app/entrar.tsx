import { useRouter } from 'expo-router';
import { useState } from 'react';

import { api, problemMessage, type ApiProblem } from '@/api/client';
import { useSession } from '@/auth/session';
import { AuthScreen, Button, Field, Notice, TextLink } from '@/components/ui';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit() {
    setLoading(true);
    setError(undefined);
    setUnconfirmed(false);
    setResent(false);
    try {
      const { data, error: problem } = await api.POST('/auth/login', { body: { email, password } });
      if (data) {
        await signIn(data);
        return; // the root layout redirects to the logged-in area
      }
      setUnconfirmed((problem as ApiProblem | undefined)?.code === 'email_not_confirmed');
      setError(problemMessage(problem) ?? 'Não foi possível entrar.');
    } catch {
      setError('Sem conexão com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    await api.POST('/auth/resend-confirmation', { body: { email } }).catch(() => undefined);
    setResent(true);
  }

  return (
    <AuthScreen title="Entrar" subtitle="Bem-vindo de volta à sua história.">
      {error ? <Notice kind="error">{error}</Notice> : null}
      {resent ? <Notice kind="success">Enviamos um novo link de confirmação para {email}.</Notice> : null}
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={submit} />
      <Button title="Entrar" onPress={submit} loading={loading} />
      {unconfirmed && !resent ? <Button title="Reenviar e-mail de confirmação" variant="secondary" onPress={resend} /> : null}
      <TextLink title="Esqueci minha senha" onPress={() => router.push('/esqueci-senha')} />
      <TextLink title="Ainda não tem conta? Criar conta" onPress={() => router.push('/cadastro')} />
    </AuthScreen>
  );
}
