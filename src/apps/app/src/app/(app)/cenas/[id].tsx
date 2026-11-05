import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { useSession } from '@/auth/session';
import { Empty, Loadable, Page, Section, Tag } from '@/components/layout';
import { ChipPicker, ConfirmButton } from '@/components/pickers';
import { Button, colors, Notice } from '@/components/ui';
import { useSceneRealtime } from '@/realtime/use-scene-realtime';

type SceneAction = components['schemas']['SceneActionDto'];
type SceneDetail = components['schemas']['SceneDetail'];

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export default function SceneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const sceneKey = ['scene', id];
  const actionsKey = ['scene-actions', id];

  const scene = useQuery({ queryKey: sceneKey, queryFn: () => unwrap(api.GET('/scenes/{id}', { params: { path: { id } } }), 'Cena não encontrada.') });
  const actions = useQuery({
    queryKey: actionsKey,
    queryFn: () => unwrap(api.GET('/scenes/{id}/actions', { params: { path: { id }, query: { limit: 200 } } })),
  });

  const setActions = (fn: (list: SceneAction[]) => SceneAction[]) =>
    queryClient.setQueryData<SceneAction[]>(actionsKey, (list) => fn(list ?? []));
  const upsert = (a: SceneAction) => setActions((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]));

  const realtime = useSceneRealtime(id, {
    onActionCreated: upsert,
    onActionUpdated: upsert,
    onActionDeleted: (actionId) => setActions((list) => list.map((x) => (x.id === actionId ? { ...x, deleted: true, content: null } : x))),
    onParticipantJoined: () => queryClient.invalidateQueries({ queryKey: sceneKey }),
    onSceneClosed: () => queryClient.invalidateQueries({ queryKey: sceneKey }),
  });

  return (
    <Loadable query={scene}>
      {(s) => (
        <Page
          title={s.title}
          subtitle={`${s.communityName} · ${s.status === 'Open' ? 'cena aberta' : 'cena encerrada'}`}
          back
          actions={<Tag label={realtime.connected ? `${realtime.online.length} online` : 'conectando…'} />}>
          {s.description ? <Text style={styles.description}>{s.description}</Text> : null}
          <Text style={styles.muted}>
            {s.participants.length === 0 ? 'Ninguém entrou na cena ainda.' : `Na cena: ${s.participants.map((p) => p.characterName).join(', ')}`}
          </Text>

          <Section title="Ações">
            <Loadable query={actions}>
              {(list) => (list.length === 0 ? <Empty>Nenhuma ação ainda. Comece a história!</Empty> : list.map((a) => <ActionItem key={a.id} action={a} scene={s} onChanged={upsert} />))}
            </Loadable>
          </Section>

          {realtime.typingNames.length > 0 ? (
            <Text style={styles.typing}>{realtime.typingNames.join(', ')} {realtime.typingNames.length === 1 ? 'está' : 'estão'} escrevendo…</Text>
          ) : null}

          {s.status === 'Open' ? (
            <Composer scene={s} onTyping={realtime.notifyTyping} onSent={upsert} />
          ) : (
            <Notice kind="info">Esta cena foi encerrada. As ações ficam salvas para leitura.</Notice>
          )}

          {s.canClose ? <CloseScene id={id} /> : null}
        </Page>
      )}
    </Loadable>
  );
}

function ActionItem({ action, scene, onChanged }: { action: SceneAction; scene: SceneDetail; onChanged: (a: SceneAction) => void }) {
  const { session } = useSession();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')), enabled: !!session });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.content ?? '');
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string>();
  const mine = me.data?.id === action.authorUserId;
  const open = scene.status === 'Open';

  const history = useQuery({
    queryKey: ['action-revisions', action.id, action.editedAt],
    enabled: showHistory,
    queryFn: () => unwrap(api.GET('/actions/{id}/revisions', { params: { path: { id: action.id } } })),
  });

  async function save() {
    setError(undefined);
    try {
      onChanged(await unwrap(api.PUT('/actions/{id}', { params: { path: { id: action.id } }, body: { content: draft } })));
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    try {
      await unwrap(api.DELETE('/actions/{id}', { params: { path: { id: action.id } } }));
      onChanged({ ...action, deleted: true, content: null });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={styles.action}>
      <View style={styles.actionHeader}>
        <Text style={styles.character}>{action.characterName}</Text>
        <Text style={styles.time}>
          {timeFmt.format(new Date(action.createdAt))}
          {action.editedAt && !action.deleted ? ' · editada' : ''}
        </Text>
      </View>
      {action.deleted ? (
        <Text style={styles.deleted}>Ação apagada.</Text>
      ) : editing ? (
        <View style={styles.editBox}>
          <TextInput value={draft} onChangeText={setDraft} multiline style={styles.input} accessibilityLabel="Editar ação" />
          <View style={styles.inline}>
            <Pressable onPress={save} accessibilityRole="button"><Text style={styles.link}>Salvar</Text></Pressable>
            <Pressable onPress={() => { setEditing(false); setDraft(action.content ?? ''); }} accessibilityRole="button"><Text style={styles.linkMuted}>Cancelar</Text></Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.content}>{action.content}</Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!action.deleted && !editing ? (
        <View style={styles.inline}>
          {mine && open ? <Pressable onPress={() => setEditing(true)} accessibilityRole="button"><Text style={styles.link}>Editar</Text></Pressable> : null}
          {mine || scene.canModerate ? <ConfirmButton label="Apagar" confirmLabel="Confirmar exclusão" onConfirm={remove} /> : null}
          {scene.canViewRevisions && action.editedAt ? (
            <Pressable onPress={() => setShowHistory((v) => !v)} accessibilityRole="button"><Text style={styles.linkMuted}>{showHistory ? 'Ocultar histórico' : 'Ver histórico'}</Text></Pressable>
          ) : null}
        </View>
      ) : null}
      {showHistory && history.data ? (
        <View style={styles.history}>
          {history.data.map((r, i) => (
            <Text key={i} style={styles.historyItem}>
              <Text style={styles.time}>{timeFmt.format(new Date(r.createdAt))}  </Text>
              {r.content}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Composer({ scene, onTyping, onSent }: { scene: SceneDetail; onTyping: (characterId: string) => void; onSent: (a: SceneAction) => void }) {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const myCharacters = useQuery({
    queryKey: ['characters', scene.communitySlug, 'mine'],
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug: scene.communitySlug }, query: { mine: true } } })),
  });
  const joinedIds = scene.participants.filter((p) => p.ownerUserId === me?.id).map((p) => p.characterId);
  const [characterId, setCharacterId] = useState<string>();
  const [text, setText] = useState('');
  const selected = characterId && joinedIds.includes(characterId) ? characterId : joinedIds[0];

  const join = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/scenes/{id}/join', { params: { path: { id: scene.id } }, body: { characterId: id } })),
    onSuccess: (detail) => queryClient.setQueryData(['scene', scene.id], detail),
  });
  const send = useMutation({
    mutationFn: () => unwrap(api.POST('/scenes/{id}/actions', { params: { path: { id: scene.id } }, body: { characterId: selected!, content: text } })),
    onSuccess: (action) => {
      onSent(action);
      setText('');
    },
  });

  if (!myCharacters.data) return null;
  const notJoined = myCharacters.data.filter((c) => !joinedIds.includes(c.id));

  if (joinedIds.length === 0) {
    if (!scene.canJoin) return <Notice kind="info">Você não tem permissão para entrar nesta cena.</Notice>;
    if (myCharacters.data.length === 0) return <Notice kind="info">Crie um personagem nesta comunidade para entrar na cena.</Notice>;
    return (
      <Section title="Entrar na cena">
        <View style={styles.composer}>
          {join.isError ? <Notice kind="error">{join.error.message}</Notice> : null}
          <Text style={styles.muted}>Escolha com qual personagem você vai jogar:</Text>
          <ChipPicker options={myCharacters.data.map((c) => ({ value: c.id, label: c.name }))} value={undefined} onChange={(id) => join.mutate(id)} />
        </View>
      </Section>
    );
  }

  const joinedOptions = myCharacters.data.filter((c) => joinedIds.includes(c.id)).map((c) => ({ value: c.id, label: c.name }));
  return (
    <Section title="Sua ação">
      <View style={styles.composer}>
        {joinedOptions.length > 1 ? <ChipPicker label="Jogando como" options={joinedOptions} value={selected} onChange={setCharacterId} /> : null}
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (selected && v) onTyping(selected);
          }}
          multiline
          placeholder={`O que ${joinedOptions.find((o) => o.value === selected)?.label ?? 'seu personagem'} faz?`}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.composerInput]}
          accessibilityLabel="Escrever ação"
        />
        {send.isError ? <Notice kind="error">{send.error.message}</Notice> : null}
        <Button title="Enviar ação" onPress={() => text.trim() && send.mutate()} loading={send.isPending} />
        {notJoined.length > 0 && scene.canJoin ? (
          <ChipPicker label="Trazer outro personagem para a cena" options={notJoined.map((c) => ({ value: c.id, label: `+ ${c.name}` }))} value={undefined} onChange={(id) => join.mutate(id)} />
        ) : null}
      </View>
    </Section>
  );
}

function CloseScene({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => unwrap(api.POST('/scenes/{id}/close', { params: { path: { id } } })),
    onSuccess: (detail) => queryClient.setQueryData(['scene', id], detail),
  });
  return (
    <View style={styles.close}>
      {close.isError ? <Notice kind="error">{close.error.message}</Notice> : null}
      <ConfirmButton label="Encerrar cena" confirmLabel="Confirmar: encerrar a cena" onConfirm={() => close.mutate()} />
    </View>
  );
}

const styles = StyleSheet.create({
  description: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.textMuted },
  typing: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  action: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.background, gap: 6 },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  character: { fontSize: 15, fontWeight: '700', color: colors.brand },
  time: { fontSize: 12, color: colors.textMuted },
  content: { fontSize: 15, color: colors.text, lineHeight: 22 },
  deleted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  inline: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  linkMuted: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  error: { fontSize: 13, color: colors.danger },
  editBox: { gap: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 15, color: colors.text, backgroundColor: colors.surface, minHeight: 60, textAlignVertical: 'top' },
  composer: { padding: 16, gap: 12 },
  composerInput: { minHeight: 100 },
  history: { backgroundColor: colors.background, borderRadius: 8, padding: 10, gap: 6 },
  historyItem: { fontSize: 13, color: colors.text },
  close: { alignItems: 'center', gap: 8, marginTop: 8 },
});
