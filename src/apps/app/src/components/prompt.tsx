import { X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { makeStyles, radius, shadow } from '@/theme';

import { Button, Field, IconButton, Notice } from './ui';

/** Small dialog asking for one text value (e.g. a folder name). */
export function PromptModal({ title, label, initial = '', submitLabel, onSubmit, onClose }: {
  title: string;
  label: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (value: string) => Promise<string | void>;
  onClose: () => void;
}) {
  const styles = useStyles();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const problem = await onSubmit(value.trim());
      if (problem) setError(problem);
      else onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <DialogModal title={title} onClose={onClose} maxWidth={440}>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field label={label} value={value} onChangeText={setValue} autoFocus onSubmitEditing={() => void submit()} />
      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" size="sm" onPress={onClose} />
        <Button title={submitLabel} size="sm" onPress={() => void submit()} loading={busy} disabled={!value.trim()} />
      </View>
    </DialogModal>
  );
}

/** Generic centered dialog with a title bar; content scrolls. */
export function DialogModal({ title, onClose, maxWidth = 640, children }: { title: string; onClose: () => void; maxWidth?: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.dialog, { maxWidth }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <IconButton icon={X} label="Fechar" size={36} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  layer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  dialog: { width: '100%', maxHeight: '88%', backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow(colors, 3) },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  body: { padding: 20, gap: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
}));
