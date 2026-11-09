import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ExternalLink, LogOut, Monitor, Moon, Palette, Sun, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { useSession } from '@/auth/session';
import { AvatarPicker } from '@/components/avatar-picker';
import { Loadable, Page, Section } from '@/components/layout';
import { ChipPicker } from '@/components/pickers';
import { Button, Field, Notice } from '@/components/ui';
import { makeStyles, radius, useTheme, type ThemePreference } from '@/theme';

type Me = components['schemas']['MeResponse'];

export default function ProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { signOut } = useSession();
  const { preference, setPreference } = useTheme();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  return (
    <Page title="Meu perfil" subtitle="Vale em toda a plataforma. Em cada comunidade você também pode ter um perfil próprio.">
      <Loadable query={me}>
        {(data) => (
          <View style={styles.stack}>
            <Section title="Perfil global" icon={UserRound} right={<Button title="Ver público" icon={ExternalLink} size="sm" variant="secondary" onPress={() => router.push({ pathname: '/u/[userName]', params: { userName: data.userName } })} />} plain>
              <View style={styles.card}>
                <ProfileForm me={data} />
              </View>
            </Section>
            <Section title="Aparência" icon={Palette} plain>
              <ChipPicker<ThemePreference>
                segmented
                value={preference}
                onChange={setPreference}
                options={[
                  { value: 'light', label: 'Claro', icon: Sun },
                  { value: 'dark', label: 'Escuro', icon: Moon },
                  { value: 'system', label: 'Do sistema', icon: Monitor },
                ]}
              />
            </Section>
            <Button title="Sair da conta" icon={LogOut} variant="ghost" onPress={signOut} />
          </View>
        )}
      </Loadable>
    </Page>
  );
}

const useStyles = makeStyles((colors) => ({
  stack: { gap: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 16 },
}));

function ProfileForm({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio ?? '');
  const [avatarKey, setAvatarKey] = useState<string | null>(me.avatarKey ?? null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();
  const [saved, setSaved] = useState(false);

  async function save() {
    setLoading(true);
    setProblem(undefined);
    setSaved(false);
    try {
      const { data, error } = await api.PUT('/me', { body: { displayName, bio, avatarKey } });
      if (data) {
        queryClient.setQueryData(['me'], data);
        setSaved(true);
      } else setProblem(error);
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {saved ? <Notice kind="success">Perfil salvo.</Notice> : null}
      {problem && !problemMessage(problem, 'displayName') && !problemMessage(problem, 'bio') ? <Notice kind="error">{problemMessage(problem)}</Notice> : null}
      <AvatarPicker name={displayName || me.userName} imageKey={avatarKey} onChange={setAvatarKey} />
      <Field label="Nome de exibição" value={displayName} onChangeText={setDisplayName} error={problemMessage(problem, 'displayName')} />
      <Field label="Bio" value={bio} onChangeText={setBio} error={problemMessage(problem, 'bio')} multiline numberOfLines={4} placeholder="Conte um pouco sobre você" />
      <Field label="Nome de usuário" value={`@${me.userName}`} editable={false} hint="O @ não pode ser alterado." />
      <Button title="Salvar" onPress={save} loading={loading} />
    </>
  );
}
