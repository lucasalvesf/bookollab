import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { DoorOpen, Eye, Globe, Lock, Sparkles, UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import type { components } from '@/api/schema';
import { CommunityCard } from '@/components/community';
import { FormScreen, FormSection, OptionCards } from '@/components/form';
import { Field, Notice } from '@/components/ui';
import { makeStyles } from '@/theme';

type JoinPolicy = components['schemas']['JoinPolicy'];

/** Create a community (Discord's "create server"): identity with a live preview, then how people join. */
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
    <FormScreen
      title="Nova comunidade"
      subtitle="Você será o Dono. Ícone, capa, seções e regras ficam nas configurações depois."
      submitLabel="Criar comunidade"
      onSubmit={submit}
      loading={loading}
      disabled={!name.trim()}>
      {errors.general && !errors.name && !errors.description ? <Notice kind="error">{errors.general}</Notice> : null}
      <FormSection title="Identidade" icon={Sparkles}>
        <Field label="Nome" value={name} onChangeText={setName} error={errors.name} placeholder="Ex.: Crônicas de Âmbar" />
        <Field label="Descrição" value={description} onChangeText={setDescription} error={errors.description} multiline numberOfLines={4} placeholder="Sobre o que é o mundo e o estilo de jogo" />
      </FormSection>
      <FormSection title="Prévia" icon={Eye} description="Assim ela aparece na busca e na tela inicial dos membros.">
        <View style={styles.preview}>
          <CommunityCard community={{ name: name.trim() || 'Sua comunidade', description: description.trim() || null, memberCount: 1 }} onPress={() => undefined} />
        </View>
      </FormSection>
      <FormSection title="Como as pessoas entram" icon={DoorOpen} description="Dá para mudar depois.">
        <OptionCards<JoinPolicy>
          value={joinPolicy}
          onChange={setJoinPolicy}
          options={[
            { value: 'Open', label: 'Aberta', description: 'Aparece na busca e qualquer pessoa entra direto.', icon: Globe },
            { value: 'Request', label: 'Com pedido', description: 'Aparece na busca; a moderação aprova cada pedido de entrada.', icon: UserCheck },
            { value: 'InviteOnly', label: 'Só por convite', description: 'Privada: fora da busca, só entra quem recebe um link.', icon: Lock },
          ]}
        />
      </FormSection>
    </FormScreen>
  );
}

const useStyles = makeStyles(() => ({
  preview: { maxWidth: 340 },
}));
