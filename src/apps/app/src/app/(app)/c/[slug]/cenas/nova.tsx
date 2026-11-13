import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clapperboard, Globe, Hourglass, ImagePlus, MailPlus, MessagesSquare, PenLine, Settings2, Trash2, UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { api, problemMessage } from '@/api/client';
import type { components } from '@/api/schema';
import { FormScreen, FormSection, OptionCards } from '@/components/form';
import { ChipPicker } from '@/components/pickers';
import { Button, Field, Notice } from '@/components/ui';
import { fileUrl, pickAndUploadImage } from '@/lib/files';
import { makeStyles, radius } from '@/theme';

type Participation = components['schemas']['SceneParticipation'];
type WritingMode = components['schemas']['SceneWritingMode'];
type Kind = components['schemas']['SceneKind'];

const TURN_LIMITS = [
  { value: '60', label: '1 h' },
  { value: '360', label: '6 h' },
  { value: '1440', label: '24 h' },
  { value: '4320', label: '3 dias' },
  { value: 'none', label: 'Sem limite' },
];

/**
 * New chat: a public OffGame chat (members talk as themselves) or a scene (OnGame, with characters).
 * Discord's "create channel" flow: what it is, the cover, then (scenes only) who joins and how people write.
 */
export default function NewChatScreen() {
  const styles = useStyles();
  const { slug, kind: kindParam } = useLocalSearchParams<{ slug: string; kind?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>(kindParam === 'chat' ? 'Chat' : 'Scene');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [participation, setParticipation] = useState<Participation>('Public');
  const [writingMode, setWritingMode] = useState<WritingMode>('Free');
  const [turnLimit, setTurnLimit] = useState('1440');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();
  const chat = kind === 'Chat';

  async function pickCover() {
    setUploading(true);
    try {
      const key = await pickAndUploadImage({ aspect: 16 / 9, title: 'Ajustar capa do chat' });
      if (key) setCoverKey(key);
    } catch (e) {
      setProblem({ detail: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setProblem(undefined);
    try {
      const { data, error } = await api.POST('/communities/{slug}/scenes', {
        params: { path: { slug } },
        body: {
          title,
          description,
          kind,
          coverKey,
          participation: chat ? 'Public' : participation,
          writingMode: chat ? 'Free' : writingMode,
          turnTimeLimitMinutes: !chat && writingMode === 'Turns' && turnLimit !== 'none' ? Number(turnLimit) : null,
        },
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
    <FormScreen
      title={chat ? 'Novo chat público' : 'Abrir cena'}
      subtitle={chat ? 'Um chat OFF: os membros conversam como eles mesmos.' : 'Uma cena é jogada ao vivo, cada um com seu personagem.'}
      submitLabel={chat ? 'Criar chat' : 'Abrir cena'}
      onSubmit={submit}
      loading={loading}
      disabled={!title.trim() || uploading}>
      {problem && !fieldError ? <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível criar.'}</Notice> : null}
      <FormSection title="Tipo de chat" icon={MessagesSquare}>
        <OptionCards<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'Chat', label: 'Chat público (Off)', description: 'Conversa livre entre os membros, fora dos personagens.', icon: MessagesSquare },
            { value: 'Scene', label: 'Cena (On)', description: 'História ao vivo: cada um escreve com um personagem.', icon: Clapperboard },
          ]}
        />
      </FormSection>
      <FormSection title={chat ? 'Sobre o chat' : 'Sobre a cena'} icon={chat ? MessagesSquare : Clapperboard}>
        <Field label="Título" value={title} onChangeText={setTitle} error={problemMessage(problem, 'title')} placeholder={chat ? 'Ex.: Conversa geral, Teorias do Arco 2' : 'Ex.: Noite de chuva na taverna'} />
        <Field
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
          error={problemMessage(problem, 'description')}
          multiline
          numberOfLines={4}
          placeholder={chat ? 'Sobre o que se conversa aqui' : 'Onde e quando acontece, o clima, o gancho inicial'}
        />
      </FormSection>
      <FormSection title="Capa" icon={ImagePlus} description="Aparece no cartão do chat na lista da comunidade.">
        {coverKey ? <Image source={{ uri: fileUrl(coverKey) }} style={styles.cover} contentFit="cover" /> : null}
        <View style={styles.inline}>
          <Button title={coverKey ? 'Trocar capa' : 'Escolher capa'} icon={ImagePlus} size="sm" variant="secondary" loading={uploading} onPress={() => void pickCover()} />
          {coverKey ? <Button title="Remover" icon={Trash2} size="sm" variant="ghost" onPress={() => setCoverKey(null)} /> : null}
        </View>
        {!coverKey ? <Text style={styles.hint}>Sem capa, o cartão usa uma cor gerada a partir do título.</Text> : null}
      </FormSection>
      {chat ? null : (
        <>
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
        </>
      )}
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  cover: { width: '100%', height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  inline: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hint: { fontSize: 13, color: colors.textSubtle },
}));
