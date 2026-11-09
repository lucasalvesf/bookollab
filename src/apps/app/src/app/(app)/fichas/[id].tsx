import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { FolderPicker } from '@/components/folder-picker';
import { Loadable, Page, Row, Section, Tag } from '@/components/layout';
import { ConfirmButton } from '@/components/pickers';
import { SheetForm } from '@/components/sheet-form';
import { Button, colors, Notice } from '@/components/ui';

/** An encyclopedia sheet (non-playable): view, edit, delete and (staff) move to a folder. */
export default function SheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const sheet = useQuery({ queryKey: ['sheet', id], queryFn: () => unwrap(api.GET('/sheets/{id}', { params: { path: { id } } }), 'Ficha não encontrada.') });

  async function remove(slug: string) {
    try {
      await unwrap(api.DELETE('/sheets/{id}', { params: { path: { id } } }));
      await queryClient.invalidateQueries({ queryKey: ['encyclopedia', slug] });
      router.replace({ pathname: '/c/[slug]/enciclopedia', params: { slug } });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Loadable query={sheet}>
      {(s) => (
        <Page
          title={editing ? 'Editar ficha' : s.name}
          subtitle={`${s.kind ?? 'Ficha'} · de @${s.ownerUserName} · ${s.communityName}`}
          back
          actions={s.canEdit && !editing ? <View style={styles.edit}><Button title="Editar" variant="secondary" onPress={() => setEditing(true)} /></View> : undefined}>
          {error ? <Notice kind="error">{error}</Notice> : null}
          {editing ? (
            <SheetForm
              baseFields={s.fields.filter((f) => f.fromTemplate)}
              canAddFields={s.canAddFields}
              initial={{
                name: s.name,
                kind: s.kind ?? null,
                imageKey: s.imageKey ?? null,
                values: Object.fromEntries(s.fields.filter((f) => f.fromTemplate).map((f) => [f.key, f.value ?? ''])),
                custom: s.fields.filter((f) => !f.fromTemplate).map((f) => ({ key: f.key, label: f.label, type: f.type, value: f.value ?? '' })),
              }}
              submitLabel="Salvar"
              onSubmit={async (value) => {
                const { data, error: problem } = await api.PUT('/sheets/{id}', { params: { path: { id } }, body: value });
                if (!data) return { ok: false, problem };
                queryClient.setQueryData(['sheet', id], data);
                await queryClient.invalidateQueries({ queryKey: ['encyclopedia', s.communitySlug] });
                setEditing(false);
                return { ok: true };
              }}
            />
          ) : (
            <>
              <View style={styles.header}>
                <Avatar name={s.name} imageKey={s.imageKey} size={110} />
                <View style={styles.tags}>
                  <Tag label={s.kind ?? 'Ficha'} />
                  <Tag label={s.templateName ? `Modelo: ${s.templateName}` : s.fields.some((f) => f.fromTemplate) ? 'Modelo removido' : 'Ficha livre'} />
                </View>
              </View>
              <Section title="Ficha">
                {s.fields.length === 0 ? (
                  <Text style={styles.empty}>Sem campos.</Text>
                ) : (
                  s.fields.map((f) => <Row key={f.key} title={f.label} subtitle={f.value || '—'} />)
                )}
              </Section>
              <FolderPicker slug={s.communitySlug} itemType="Sheet" itemId={s.id} folderId={s.folderId} onMoved={() => queryClient.invalidateQueries({ queryKey: ['sheet', id] })} />
              {s.canEdit ? <ConfirmButton label="Apagar ficha" confirmLabel="Confirmar exclusão" onConfirm={() => remove(s.communitySlug)} /> : null}
            </>
          )}
        </Page>
      )}
    </Loadable>
  );
}

const styles = StyleSheet.create({
  edit: { width: 100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  tags: { gap: 8 },
  empty: { padding: 16, color: colors.textMuted },
});
