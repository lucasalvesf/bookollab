import { useRouter } from 'expo-router';
import { useState } from 'react';

import { api, problemMessage } from '@/api/client';
import { AuthScreen, Button, Field, Notice, TextLink } from '@/components/ui';
import { maskBrazilianDate, parseBrazilianDate } from '@/lib/date';

type FieldErrors = Partial<Record<'email' | 'password' | 'userName' | 'displayName' | 'birthDate', string>>;

export default function SignUpScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  async function submit() {
    const isoBirthDate = parseBrazilianDate(birthDate);
    if (!isoBirthDate) {
      setErrors({ birthDate: 'Use o formato DD/MM/AAAA.' });
      return;
    }
    setLoading(true);
    setErrors({});
    setError(undefined);
    try {
      const { response, error: problem } = await api.POST('/auth/register', {
        body: { displayName, userName, email, password, birthDate: isoBirthDate },
      });
      if (response.ok) {
        setSentTo(email);
        return;
      }
      setErrors({
        displayName: problemMessage(problem, 'displayName'),
        userName: problemMessage(problem, 'userName'),
        email: problemMessage(problem, 'email'),
        password: problemMessage(problem, 'password'),
        birthDate: problemMessage(problem, 'birthDate'),
      });
      setError(problemMessage(problem, 'general'));
    } catch {
      setError('Sem conexão com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <AuthScreen title="Confirme seu e-mail">
        <Notice kind="success">Conta criada! Enviamos um link de confirmação para {sentTo}. Abra o e-mail e clique no link para poder entrar.</Notice>
        <Button title="Ir para Entrar" onPress={() => router.replace('/entrar')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Criar conta" subtitle="Comece a escrever histórias com outros jogadores.">
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field label="Nome de exibição" value={displayName} onChangeText={setDisplayName} error={errors.displayName} autoComplete="name" />
      <Field
        label="Nome de usuário"
        value={userName}
        onChangeText={(v) => setUserName(v.toLowerCase())}
        error={errors.userName}
        hint="Seu @ público: letras minúsculas, números e _."
        autoCapitalize="none"
        autoComplete="username"
      />
      <Field label="E-mail" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <Field
        label="Data de nascimento"
        value={birthDate}
        onChangeText={(v) => setBirthDate(maskBrazilianDate(v))}
        error={errors.birthDate}
        hint="É preciso ter pelo menos 13 anos. Não pode ser alterada depois."
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
      />
      <Field label="Senha" value={password} onChangeText={setPassword} error={errors.password} hint="Pelo menos 8 caracteres, com um número." secureTextEntry autoComplete="new-password" />
      <Button title="Criar conta" onPress={submit} loading={loading} />
      <TextLink title="Já tem conta? Entrar" onPress={() => router.replace('/entrar')} />
    </AuthScreen>
  );
}
