import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, NotebookPen, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { ConfirmButton } from '@/components/pickers';
import { Tag } from '@/components/layout';
import { Notice } from '@/components/ui';
import { BACKGROUND_PRESETS } from '@/lib/backgrounds';
import { pickAndUploadImage } from '@/lib/files';

import { PARTICIPATION_LABELS, SceneInvitesAndRequests, SceneSettings, SceneTurns } from './scene-settings';
import type { Character, Presence, SceneDetail } from './types';
import { makeStyles, useTheme } from '@/theme';

const COLLAPSED_COUNT = 5;

export function SceneSidebar({
  scene,
  online,
  myCharacters,
  myUserId,
  onClose,
}: {
  scene: SceneDetail;
  online: Presence[];
  myCharacters: Character[] | undefined;
  myUserId: string | undefined;
  onClose?: () => void;
}) {
  const styles = useStyles();
  const community = useQuery({ queryKey: ['community', scene.communitySlug], queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug: scene.communitySlug } } })) });
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const onlineIds = new Set(online.map((p) => p.userId));
  const joinedIds = new Set(scene.participants.filter((p) => p.ownerUserId === myUserId).map((p) => p.characterId));
  const notJoined = (myCharacters ?? []).filter((c) => !joinedIds.has(c.id));
  const setScene = (detail: SceneDetail) => queryClient.setQueryData(['scene', scene.id], detail);

  const join = useMutation({
    mutationFn: (characterId: string) => unwrap(api.POST('/scenes/{id}/join', { params: { path: { id: scene.id } }, body: { characterId } })),
    onSuccess: setScene,
  });
  const background = useMutation({
    mutationFn: (value: string | null) => unwrap(api.PUT('/scenes/{id}/background', { params: { path: { id: scene.id } }, body: { background: value } })),
    onSuccess: setScene,
  });
  const close = useMutation({
    mutationFn: () => unwrap(api.POST('/scenes/{id}/close', { params: { path: { id: scene.id } } })),
    onSuccess: setScene,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  async function useImage() {
    setUploadError(undefined);
    setUploading(true);
    try {
      const key = await pickAndUploadImage();
      if (key) background.mutate(`image:${key}`);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const participants = expanded ? scene.participants : scene.participants.slice(0, COLLAPSED_COUNT);

  return (
    <ScrollView style={styles.sidebar} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/c/[slug]', params: { slug: scene.communitySlug } })} hitSlop={8}>
          <View style={styles.backRow}><ChevronLeft size={18} color={colors.brand} /><Avatar name={scene.communityName} imageKey={community.data?.iconKey} size={26} shape="rounded" /><Text style={styles.back} numberOfLines={1}>{scene.communityName}</Text></View>
        </Pressable>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar painel" onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.title}>{scene.title}</Text>
        <View style={styles.status}>
          <Tag label={scene.kind === 'Chat' ? 'Chat público · Off' : 'Cena · On'} tone={scene.kind === 'Chat' ? 'neutral' : 'brand'} />
          <Tag label={scene.status === 'Open' ? 'Ao vivo' : 'Encerrada'} tone={scene.status === 'Open' ? 'live' : 'neutral'} />
        </View>
        {scene.description ? <Text style={styles.description}>{scene.description}</Text> : null}
      </View>

      {scene.kind === 'Chat' ? (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Chat público (Off)</Text>
          <Text style={styles.muted}>{`${online.length} online agora. Aqui todos os membros conversam como eles mesmos, fora dos personagens.`}</Text>
        </View>
      ) : (
      <View style={styles.block}>
        <Pressable accessibilityRole="button" onPress={() => setExpanded((v) => !v)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Participantes · {scene.participants.length}</Text>
          {expanded ? <ChevronDown size={18} color={colors.textMuted} /> : <ChevronRight size={18} color={colors.textMuted} />}
        </Pressable>
        <Text style={styles.muted}>{online.length} online agora</Text>
        {scene.participants.length === 0 ? <Text style={styles.muted}>Ninguém entrou ainda.</Text> : null}
        {participants.map((p) => (
          <View key={p.characterId} style={styles.member}>
            <Avatar name={p.characterName} imageKey={p.characterAvatarKey} size={36} online={onlineIds.has(p.ownerUserId)} />
            <View style={styles.memberText}>
              <Text style={styles.memberName} numberOfLines={1}>{p.characterName}</Text>
              <Text style={styles.muted} numberOfLines={1}>@{p.ownerUserName}</Text>
            </View>
          </View>
        ))}
        {!expanded && scene.participants.length > COLLAPSED_COUNT ? (
          <Pressable accessibilityRole="button" onPress={() => setExpanded(true)}>
            <Text style={styles.link}>Ver todos ({scene.participants.length})</Text>
          </Pressable>
        ) : null}
      </View>
      )}

      <SceneTurns scene={scene} />

      {scene.status === 'Open' && scene.canJoin && notJoined.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>
            {scene.participation === 'Request' && !scene.canManage ? 'Pedir para entrar com' : joinedIds.size === 0 ? 'Entrar na cena com' : 'Trazer outro personagem'}
          </Text>
          <Text style={styles.muted}>Participação: {PARTICIPATION_LABELS[scene.participation]}</Text>
          {join.isError ? <Notice kind="error">{join.error.message}</Notice> : null}
          {notJoined.map((c) => {
            const pending = scene.myPendingCharacterIds.includes(c.id);
            const blocked = scene.participation === 'InviteOnly' && !scene.canManage && !scene.invitedCharacterIds.includes(c.id);
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                disabled={pending || blocked}
                onPress={() => join.mutate(c.id)}
                style={({ pressed }) => [styles.member, styles.joinRow, (pending || blocked) && styles.disabled, pressed && styles.pressed]}>
                <Avatar name={c.name} imageKey={c.avatarKey} size={32} />
                <Text style={styles.memberName}>{c.name}</Text>
                <Text style={pending || blocked ? styles.muted : styles.plus}>{pending ? 'Pedido enviado' : blocked ? 'Não convidado' : '＋'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <SceneInvitesAndRequests scene={scene} />
      <SceneSettings scene={scene} />
      {scene.status === 'Open' && scene.canJoin && myCharacters && myCharacters.length === 0 ? (
        <Notice kind="info">Crie um personagem nesta comunidade para entrar na cena.</Notice>
      ) : null}

      {scene.canEditBackground ? (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Fundo do chat</Text>
          <View style={styles.swatches}>
            {BACKGROUND_PRESETS.map((p) => {
              const selected = scene.background === `preset:${p.name}` || (!scene.background && p.name === BACKGROUND_PRESETS[0].name);
              return (
                <Pressable
                  key={p.name}
                  accessibilityRole="radio"
                  accessibilityLabel={p.label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => background.mutate(`preset:${p.name}`)}
                  style={[styles.swatch, { backgroundColor: p.color }, selected && styles.swatchSelected]}
                />
              );
            })}
          </View>
          <View style={styles.inline}>
            <Pressable accessibilityRole="button" onPress={useImage} disabled={uploading}>
              <Text style={styles.link}>{uploading ? 'Enviando…' : 'Usar uma imagem'}</Text>
            </Pressable>
            {scene.background ? (
              <Pressable accessibilityRole="button" onPress={() => background.mutate(null)}>
                <Text style={styles.linkMuted}>Restaurar padrão</Text>
              </Pressable>
            ) : null}
            {background.isPending || uploading ? <ActivityIndicator size="small" color={colors.brand} /> : null}
          </View>
          {uploadError || background.isError ? <Text style={styles.error}>{uploadError ?? background.error?.message}</Text> : null}
        </View>
      ) : null}

      {scene.status === 'Closed' && joinedIds.size > 0 ? (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Depois da cena</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug: scene.communitySlug, sceneId: scene.id } })}
            style={({ pressed }) => [styles.member, styles.joinRow, pressed && styles.pressed]}>
            <NotebookPen size={18} color={colors.brand} /><Text style={styles.memberName}>Escrever o capítulo desta cena</Text>
          </Pressable>
        </View>
      ) : null}

      {scene.canClose ? (
        <View style={styles.block}>
          {close.isError ? <Notice kind="error">{close.error.message}</Notice> : null}
          <ConfirmButton label="Encerrar cena" confirmLabel="Confirmar: encerrar a cena" onConfirm={() => close.mutate()} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  sidebar: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  back: { color: colors.brand, fontSize: 14, fontWeight: '600' },
  block: { gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  status: { alignSelf: 'flex-start' },
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  muted: { fontSize: 13, color: colors.textMuted },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberText: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  joinRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8 },
  plus: { marginLeft: 'auto', fontSize: 18, color: colors.brand },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.55 },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  linkMuted: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  swatchSelected: { borderWidth: 3, borderColor: colors.brand },
  inline: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
  error: { fontSize: 13, color: colors.danger },
}));
