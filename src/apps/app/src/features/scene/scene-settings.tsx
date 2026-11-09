import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Avatar } from '@/components/avatar';
import { ChipPicker } from '@/components/pickers';
import { colors, Notice } from '@/components/ui';

import type { SceneDetail } from './types';

type WritingMode = components['schemas']['SceneWritingMode'];
type Participation = components['schemas']['SceneParticipation'];
type ArchiveVisibility = components['schemas']['SceneArchiveVisibility'];

export const PARTICIPATION_LABELS: Record<Participation, string> = { Public: 'Pública', InviteOnly: 'Só convidados', Request: 'Com pedido' };

const TIME_LIMITS: { value: string; label: string; minutes: number | null }[] = [
  { value: 'none', label: 'Sem limite', minutes: null },
  { value: '60', label: '1 h', minutes: 60 },
  { value: '360', label: '6 h', minutes: 360 },
  { value: '1440', label: '24 h', minutes: 1440 },
  { value: '4320', label: '3 dias', minutes: 4320 },
  { value: '10080', label: '7 dias', minutes: 10080 },
];

function useSetScene(sceneId: string) {
  const queryClient = useQueryClient();
  return (detail: SceneDetail) => queryClient.setQueryData(['scene', sceneId], detail);
}

const deadlineFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Turn order with the current turn highlighted; managers reorder, narrators/staff skip. */
export function SceneTurns({ scene }: { scene: SceneDetail }) {
  const setScene = useSetScene(scene.id);
  const reorder = useMutation({
    mutationFn: (characterIds: string[]) => unwrap(api.PUT('/scenes/{id}/turn-order', { params: { path: { id: scene.id } }, body: { characterIds } })),
    onSuccess: setScene,
  });
  const skip = useMutation({ mutationFn: () => unwrap(api.POST('/scenes/{id}/skip-turn', { params: { path: { id: scene.id } } })), onSuccess: setScene });
  if (scene.writingMode !== 'Turns') return null;

  const ids = scene.participants.map((p) => p.characterId);
  const move = (index: number, delta: number) => {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next);
  };

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Ordem dos turnos</Text>
      {scene.turnDeadline ? <Text style={styles.muted}>Prazo da vez atual: {deadlineFmt.format(new Date(scene.turnDeadline))}</Text> : null}
      {scene.participants.length === 0 ? <Text style={styles.muted}>A ordem começa quando alguém entrar.</Text> : null}
      {scene.participants.map((p, i) => {
        const current = p.characterId === scene.currentTurnCharacterId;
        return (
          <View key={p.characterId} style={[styles.turnRow, current && styles.turnCurrent]}>
            <Text style={styles.position}>{i + 1}</Text>
            <Avatar name={p.characterName} imageKey={p.characterAvatarKey} size={28} />
            <Text style={[styles.name, current && styles.nameCurrent]} numberOfLines={1}>{p.characterName}</Text>
            {current ? <Text style={styles.now}>VEZ</Text> : null}
            {scene.canManage ? (
              <View style={styles.arrows}>
                <Pressable accessibilityRole="button" accessibilityLabel="Subir" onPress={() => move(i, -1)} hitSlop={6}><Text style={styles.arrow}>▲</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Descer" onPress={() => move(i, 1)} hitSlop={6}><Text style={styles.arrow}>▼</Text></Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      {scene.canSkipTurn && scene.currentTurnCharacterId ? (
        <Pressable accessibilityRole="button" onPress={() => skip.mutate()}>
          <Text style={styles.link}>Pular a vez</Text>
        </Pressable>
      ) : null}
      {reorder.isError || skip.isError ? <Text style={styles.error}>{(reorder.error ?? skip.error)?.message}</Text> : null}
    </View>
  );
}

/** Chat settings (opener or staff): turns, time limit, participation, visibility after closing. */
export function SceneSettings({ scene }: { scene: SceneDetail }) {
  const setScene = useSetScene(scene.id);
  const save = useMutation({
    mutationFn: (patch: Partial<{ writingMode: WritingMode; turnTimeLimitMinutes: number | null; participation: Participation; archiveVisibility: ArchiveVisibility }>) =>
      unwrap(
        api.PUT('/scenes/{id}/settings', {
          params: { path: { id: scene.id } },
          body: {
            writingMode: scene.writingMode,
            turnTimeLimitMinutes: scene.turnTimeLimitMinutes ?? null,
            participation: scene.participation,
            archiveVisibility: scene.archiveVisibility,
            ...patch,
          },
        }),
      ),
    onSuccess: setScene,
  });
  if (!scene.canManage) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Configurações do chat</Text>
      {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
      <ChipPicker
        label="Escrita"
        options={[{ value: 'Free' as WritingMode, label: 'Livre' }, { value: 'Turns' as WritingMode, label: 'Por turnos' }]}
        value={scene.writingMode}
        onChange={(writingMode) => save.mutate({ writingMode })}
      />
      {scene.writingMode === 'Turns' ? (
        <ChipPicker
          label="Tempo por turno"
          options={TIME_LIMITS.map((t) => ({ value: t.value, label: t.label }))}
          value={scene.turnTimeLimitMinutes ? String(scene.turnTimeLimitMinutes) : 'none'}
          onChange={(v) => save.mutate({ turnTimeLimitMinutes: TIME_LIMITS.find((t) => t.value === v)?.minutes ?? null })}
        />
      ) : null}
      <ChipPicker
        label="Quem participa"
        options={(Object.keys(PARTICIPATION_LABELS) as Participation[]).map((p) => ({ value: p, label: PARTICIPATION_LABELS[p] }))}
        value={scene.participation}
        onChange={(participation) => save.mutate({ participation })}
      />
      <ChipPicker
        label="Depois de encerrada, quem lê"
        options={[{ value: 'Community' as ArchiveVisibility, label: 'Toda a comunidade' }, { value: 'Participants' as ArchiveVisibility, label: 'Só participantes' }]}
        value={scene.archiveVisibility}
        onChange={(archiveVisibility) => save.mutate({ archiveVisibility })}
      />
    </View>
  );
}

/** Invite characters (invite-only scenes) and review join requests (request scenes). */
export function SceneInvitesAndRequests({ scene }: { scene: SceneDetail }) {
  const queryClient = useQueryClient();
  const setScene = useSetScene(scene.id);
  const [inviting, setInviting] = useState(false);
  const characters = useQuery({
    queryKey: ['characters', scene.communitySlug],
    enabled: scene.canManage && inviting,
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug: scene.communitySlug }, query: {} } })),
  });
  const requests = useQuery({
    queryKey: ['scene-requests', scene.id, scene.pendingRequestCount],
    enabled: scene.canManage && scene.pendingRequestCount > 0,
    queryFn: () => unwrap(api.GET('/scenes/{id}/join-requests', { params: { path: { id: scene.id } } })),
  });
  const invite = useMutation({
    mutationFn: (characterId: string) => unwrap(api.POST('/scenes/{id}/invites', { params: { path: { id: scene.id } }, body: { characterId } })),
    onSuccess: setScene,
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      unwrap(approve ? api.POST('/scene-join-requests/{id}/approve', { params: { path: { id } } }) : api.POST('/scene-join-requests/{id}/reject', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scene', scene.id] }),
  });
  if (!scene.canManage) return null;

  const participantIds = new Set(scene.participants.map((p) => p.characterId));
  const invitable = (characters.data ?? []).filter((c) => !participantIds.has(c.id) && !scene.invitedCharacterIds.includes(c.id));

  return (
    <>
      {scene.pendingRequestCount > 0 ? (
        <View style={styles.block}>
          <Text style={styles.title}>Pedidos para entrar · {scene.pendingRequestCount}</Text>
          {(requests.data ?? []).map((r) => (
            <View key={r.id} style={styles.turnRow}>
              <Avatar name={r.characterName} imageKey={r.characterAvatarKey} size={28} />
              <Text style={styles.name} numberOfLines={1}>{r.characterName} <Text style={styles.muted}>@{r.userName}</Text></Text>
              <Pressable onPress={() => decide.mutate({ id: r.id, approve: true })}><Text style={styles.link}>Aceitar</Text></Pressable>
              <Pressable onPress={() => decide.mutate({ id: r.id, approve: false })}><Text style={styles.danger}>Recusar</Text></Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {scene.participation === 'InviteOnly' && scene.status === 'Open' ? (
        <View style={styles.block}>
          <Pressable accessibilityRole="button" onPress={() => setInviting((v) => !v)} style={styles.header}>
            <Text style={styles.title}>Convidar personagens</Text>
            <Text style={styles.muted}>{inviting ? '▾' : '▸'}</Text>
          </Pressable>
          {scene.invitedCharacterIds.length > 0 ? <Text style={styles.muted}>{scene.invitedCharacterIds.length} convidado(s)</Text> : null}
          {inviting
            ? invitable.map((c) => (
                <Pressable key={c.id} accessibilityRole="button" onPress={() => invite.mutate(c.id)} style={styles.turnRow}>
                  <Avatar name={c.name} imageKey={c.avatarKey} size={28} />
                  <Text style={styles.name} numberOfLines={1}>{c.name} <Text style={styles.muted}>@{c.ownerUserName}</Text></Text>
                  <Text style={styles.link}>Convidar</Text>
                </Pressable>
              ))
            : null}
          {inviting && characters.data && invitable.length === 0 ? <Text style={styles.muted}>Nenhum personagem para convidar.</Text> : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  muted: { fontSize: 13, color: colors.textMuted, fontWeight: '400' },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8 },
  turnCurrent: { backgroundColor: '#ECFDF3' },
  position: { width: 16, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  name: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  nameCurrent: { color: colors.brand },
  now: { fontSize: 10, fontWeight: '800', color: colors.brand },
  arrows: { flexDirection: 'row', gap: 10 },
  arrow: { fontSize: 12, color: colors.textMuted },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  danger: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  error: { fontSize: 13, color: colors.danger },
});
