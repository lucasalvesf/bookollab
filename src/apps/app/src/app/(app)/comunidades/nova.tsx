import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import { labels } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Page } from '@/components/layout';
import { Button, Field, Notice } from '@/components/ui';
import { makeStyles } from '@/theme';

type JoinPolicy = components['schemas']['JoinPolicy'];
const POLICIES: { value: JoinPolicy; hint: string }[] = [
  { value: 'Open', hint: 'Qualquer pessoa entra direto e a comunidade aparece na busca.' },
  { value: 'Request', hint: 'A staff aprova cada pedido de entrada.' },
  { value: 'InviteOnly', hint: 'Só entra quem recebe um link de convite.' },
];

export default function NewCommunityScreen() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('Open');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string; general?: string }>({});

  async function submit() {
    setLoading(true);
    setErrors({});
    try {
      const { data, error } = await api.POST('/communities', { body: { name, description, joinPolicy, slug: null } });
      if (data) {
        await queryClient.invalidateQueries({ queryKey: ['my-communities'] });
        router.replace({ pathname: '/c/[slug]', params: { slug: data.slug } });
        return;
      }
      setErrors({ name: problemMessage(error, 'name'), description: problemMessage(error, 'description'), general: problemMessage(error) });
    } catch {
      setErrors({ general: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page title="Nova comunidade" subtitle="Você será o Dono e poderá personalizar tudo depois." back>
      {errors.general && !errors.name && !errors.description ? <Notice kind="error">{errors.general}</Notice> : null}
      <Field label="Nome" value={name} onChangeText={setName} error={errors.name} placeholder="Ex.: Crônicas de Âmbar" />
      <Field label="Descrição" value={description} onChangeText={setDescription} error={errors.description} multiline numberOfLines={4} placeholder="Sobre o que é o mundo e o estilo de jogo" />
      <View style={styles.policies}>
        <Text style={styles.label}>Como as pessoas entram?</Text>
        {POLICIES.map((p) => (
          <Pressable
            key={p.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: joinPolicy === p.value }}
            onPress={() => setJoinPolicy(p.value)}
            style={[styles.policy, joinPolicy === p.value && styles.policySelected]}>
            <Text style={styles.policyTitle}>{labels.joinPolicy[p.value]}</Text>
            <Text style={styles.policyHint}>{p.hint}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Criar comunidade" onPress={submit} loading={loading} />
    </Page>
  );
}

const useStyles = makeStyles((colors) => ({
  policies: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  policy: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.surface, gap: 2 },
  policySelected: { borderColor: colors.brand, borderWidth: 2 },
  policyTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  policyHint: { fontSize: 13, color: colors.textMuted },
}));
