import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clapperboard, Globe, Hourglass, MailPlus, PenLine, Settings2, UserCheck } from 'lucide-react-native';
import { useState } from 'react';

import { api, problemMessage } from '@/api/client';
import type { components } from '@/api/schema';
import { FormScreen, FormSection, OptionCards } from '@/components/form';
import { ChipPicker } from '@/components/pickers';
import { Field, Notice } from '@/components/ui';

type Participation = components['schemas']['SceneParticipation'];
type WritingMode = components['schemas']['SceneWritingMode'];

const TURN_LIMITS = [
  { value: '60', label: '1 h' },
  { value: '360', label: '6 h' },
  { value: '1440', label: '24 h' },
  { value: '4320', label: '3 dias' },
  { value: 'none', label: 'Sem limite' },
];

/** Open a scene: what it is about, then who can join and how people write (Discord's "create channel" flow). */
export default function NewSceneScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participation, setParticipation] = useState<Participation>('Public');
  const [writingMode, setWritingMode] = useState<WritingMode>('Free');
  const [turnLimit, setTurnLimit] = useState('1440');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();

  async function submit() {
    setLoading(true);
    setProblem(undefined);
    try {
      const { data, error } = await api.POST('/communities/{slug}/scenes', {
        params: { path: { slug } },
        body: { title, description, participation, writingMode, turnTimeLimitMinutes: writingMode === 'Turns' && turnLimit !== 'none' ? Number(turnLimit) : null },
      });
      if (data) {
        await queryClient.invalidateQueries({ queryKey: ['scenes', slug] });
        router.replace({ pathname: '/cenas/[id]', params: { id: data.id } });
        return;
      }
      setProblem(error);
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  const fieldError = problemMessage(problem, 'title') || problemMessage(problem, 'description');
  return (
    <FormScreen title="Abrir cena" subtitle="Uma cena é jogada ao vivo, com os outros jogadores." submitLabel="Abrir cena" onSubmit={submit} loading={loading} disabled={!title.trim()}>
      {problem && !fieldError ? <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível abrir a cena.'}</Notice> : null}
      <FormSection title="Sobre a cena" icon={Clapperboard}>
        <Field label="Título" value={title} onChangeText={setTitle} error={problemMessage(problem, 'title')} placeholder="Ex.: Noite de chuva na taverna" />
        <Field
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
          error={problemMessage(problem, 'description')}
          multiline
          numberOfLines={4}
          placeholder="Onde e quando acontece, o clima, o gancho inicial"
        />
      </FormSection>
      <FormSection title="Quem participa" icon={UserCheck} description="Dá para mudar depois nas configurações do chat.">
        <OptionCards<Participation>
          value={participation}
          onChange={setParticipation}
          options={[
            { value: 'Public', label: 'Pública', description: 'Qualquer membro entra com um personagem.', icon: Globe },
            { value: 'Request', label: 'Com pedido', description: 'Membros pedem para entrar e você aprova.', icon: UserCheck },
            { value: 'InviteOnly', label: 'Só convidados', description: 'Só entram os personagens que você convidar.', icon: MailPlus },
          ]}
        />
      </FormSection>
      <FormSection title="Escrita" icon={Settings2}>
        <OptionCards<WritingMode>
          value={writingMode}
          onChange={setWritingMode}
          options={[
            { value: 'Free', label: 'Livre', description: 'Todos escrevem quando quiserem, como num chat.', icon: PenLine },
            { value: 'Turns', label: 'Por turnos', description: 'Um personagem por vez, numa ordem. Bom para cenas com muita gente.', icon: Hourglass },
          ]}
        />
        {writingMode === 'Turns' ? <ChipPicker label="Tempo de cada vez" segmented value={turnLimit} onChange={setTurnLimit} options={TURN_LIMITS} /> : null}
      </FormSection>
    </FormScreen>
  );
}
