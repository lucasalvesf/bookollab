import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ExternalLink, Eye, EyeOff, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

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

type Visibility = components['schemas']['PresenceVisibility'];

/**
 * Presence privacy, like most chat apps: show when I'm online / when I was last seen. Reciprocal (WhatsApp):
 * whoever hides theirs doesn't see the others' either.
 */
function PrivacySection() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const privacy = useQuery({ queryKey: ['privacy'], queryFn: () => unwrap(api.GET('/me/privacy')) });
  const save = async (patch: Partial<components['schemas']['PrivacySettings']>) => {
    const next = { onlineVisibility: 'Everyone' as Visibility, lastSeenVisibility: 'Everyone' as Visibility, ...privacy.data, ...patch };
    queryClient.setQueryData(['privacy'], next);
    await api.PUT('/me/privacy', { body: next });
    void queryClient.invalidateQueries({ queryKey: ['members'] });
  };
  const options = [
    { value: 'Everyone' as Visibility, label: 'Todos', icon: Eye },
    { value: 'Nobody' as Visibility, label: 'Ninguém', icon: EyeOff },
  ];
  return (
    <Section title="Privacidade" icon={ShieldCheck} plain>
      <View style={styles.card}>
        <ChipPicker<Visibility> label="Quem vê quando estou online" segmented value={privacy.data?.onlineVisibility ?? 'Everyone'} onChange={(v) => void save({ onlineVisibility: v })} options={options} />
        <ChipPicker<Visibility> label="Quem vê quando fui visto por último" segmented value={privacy.data?.lastSeenVisibility ?? 'Everyone'} onChange={(v) => void save({ lastSeenVisibility: v })} options={options} />
        <Text style={styles.hint}>É recíproco: se você esconder, também não verá essas informações dos outros membros.</Text>
      </View>
    </Section>
  );
}

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
            <PrivacySection />
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
  hint: { fontSize: 13, color: colors.textSubtle, lineHeight: 18 },
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
