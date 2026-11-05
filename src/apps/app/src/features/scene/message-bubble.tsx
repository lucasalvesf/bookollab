import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { ConfirmButton } from '@/components/pickers';
import { colors } from '@/components/ui';
import { fileUrl } from '@/lib/files';

import type { SceneAction, SceneDetail } from './types';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** One chat message (an Action). Own messages are on the right; tap a message to see its options. */
export function MessageBubble({
  action,
  scene,
  mine,
  grouped,
  onChanged,
}: {
  action: SceneAction;
  scene: SceneDetail;
  mine: boolean;
  /** Same character as the previous message: hide avatar and name. */
  grouped: boolean;
  onChanged: (a: SceneAction) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.content ?? '');
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string>();
  const open = scene.status === 'Open';
  const canEdit = mine && open && !action.deleted;
  const canDelete = (mine || scene.canModerate) && !action.deleted;
  const canHistory = scene.canViewRevisions && !!action.editedAt && !action.deleted;
  const hasMenu = canEdit || canDelete || canHistory;

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
      setMenu(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    try {
      await unwrap(api.DELETE('/actions/{id}', { params: { path: { id: action.id } } }));
      onChanged({ ...action, deleted: true, content: null, attachmentKey: null });
      setMenu(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const image = fileUrl(action.attachmentKey);

  return (
    <View style={[styles.row, mine && styles.rowMine, grouped && styles.rowGrouped]}>
      {!mine ? <View style={styles.avatarSlot}>{!grouped ? <Avatar name={action.characterName} imageKey={action.characterAvatarKey} size={38} /> : null}</View> : null}
      <View style={[styles.column, mine && styles.columnMine]}>
        {!grouped ? <Text style={[styles.name, mine && styles.nameMine]}>{action.characterName}</Text> : null}
        <Pressable
          accessibilityRole={hasMenu ? 'button' : undefined}
          onPress={() => hasMenu && !editing && setMenu((v) => !v)}
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, action.deleted && styles.bubbleDeleted]}>
          {action.deleted ? (
            <Text style={styles.deleted}>Ação apagada</Text>
          ) : editing ? (
            <View style={styles.editBox}>
              <TextInput value={draft} onChangeText={setDraft} multiline style={styles.editInput} accessibilityLabel="Editar ação" autoFocus />
              <View style={styles.inline}>
                <Pressable onPress={save} accessibilityRole="button"><Text style={styles.link}>Salvar</Text></Pressable>
                <Pressable onPress={() => { setEditing(false); setDraft(action.content ?? ''); }} accessibilityRole="button"><Text style={styles.linkMuted}>Cancelar</Text></Pressable>
              </View>
            </View>
          ) : (
            <>
              {image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" accessibilityLabel="Imagem anexada" /> : null}
              {action.content ? <Text style={[styles.text, mine && styles.textMine]}>{action.content}</Text> : null}
            </>
          )}
          <Text style={[styles.meta, mine && styles.metaMine]}>
            {action.editedAt && !action.deleted ? 'editada · ' : ''}
            {timeFmt.format(new Date(action.createdAt))}
          </Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {menu && !editing ? (
          <View style={[styles.menu, mine && styles.menuMine]}>
            {canEdit ? <Pressable onPress={() => setEditing(true)} accessibilityRole="button"><Text style={styles.link}>Editar</Text></Pressable> : null}
            {canDelete ? <ConfirmButton label="Apagar" confirmLabel="Confirmar exclusão" onConfirm={remove} /> : null}
            {canHistory ? (
              <Pressable onPress={() => setShowHistory((v) => !v)} accessibilityRole="button">
                <Text style={styles.linkMuted}>{showHistory ? 'Ocultar histórico' : 'Histórico'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {showHistory && history.data ? (
          <View style={styles.history}>
            {history.data.map((r, i) => (
              <Text key={i} style={styles.historyItem}>
                <Text style={styles.historyTime}>{timeFmt.format(new Date(r.createdAt))}  </Text>
                {r.content}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingHorizontal: 16 },
  rowMine: { justifyContent: 'flex-end' },
  rowGrouped: { marginTop: 3 },
  avatarSlot: { width: 38 },
  column: { maxWidth: '78%', gap: 3, alignItems: 'flex-start' },
  columnMine: { alignItems: 'flex-end' },
  name: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3, marginLeft: 4 },
  nameMine: { marginRight: 4, marginLeft: 0 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 6, minWidth: 64 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.96)', borderTopLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.brand, borderTopRightRadius: 4 },
  bubbleDeleted: { backgroundColor: 'rgba(255,255,255,0.6)' },
  text: { fontSize: 15, lineHeight: 21, color: colors.text },
  textMine: { color: '#FFFFFF' },
  image: { width: 260, height: 200, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.1)' },
  meta: { fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end' },
  metaMine: { color: 'rgba(255,255,255,0.75)' },
  deleted: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  editBox: { gap: 8, minWidth: 220 },
  editInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, fontSize: 15, color: colors.text, backgroundColor: '#FFFFFF', minHeight: 60, textAlignVertical: 'top' },
  inline: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  menu: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  menuMine: { alignSelf: 'flex-end' },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  linkMuted: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  error: { fontSize: 12, color: colors.danger, backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 6 },
  history: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 10, padding: 10, gap: 4, maxWidth: 360 },
  historyItem: { fontSize: 13, color: colors.text },
  historyTime: { fontSize: 11, color: colors.textMuted },
});
