import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { CharacterForm } from '@/components/character-form';
import { FolderPicker } from '@/components/folder-picker';
import { Loadable, Page, Row, Section } from '@/components/layout';
import { Button, colors, Notice } from '@/components/ui';

export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const character = useQuery({
    queryKey: ['character', id],
    queryFn: () => unwrap(api.GET('/characters/{id}', { params: { path: { id } } }), 'Personagem não encontrado.'),
  });
  const community = useQuery({
    queryKey: ['community', character.data?.communitySlug],
    enabled: !!character.data,
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug: character.data!.communitySlug } } })),
  });

  return (
    <Loadable query={character}>
      {(ch) => (
        <Page
          title={ch.name}
          subtitle={`de @${ch.ownerUserName}${community.data ? ` · ${community.data.name}` : ''}`}
          back
          actions={
            ch.canEdit && !editing ? (
              <View style={styles.edit}>
                <Button title="Editar" variant="secondary" onPress={() => { setSaved(false); setEditing(true); }} />
              </View>
            ) : undefined
          }>
          {!editing ? <Avatar name={ch.name} imageKey={ch.avatarKey} size={96} /> : null}
          {!editing ? (
            <FolderPicker slug={ch.communitySlug} itemType="Character" itemId={ch.id} folderId={ch.folderId} onMoved={() => queryClient.invalidateQueries({ queryKey: ['character', id] })} />
          ) : null}
          {saved ? <Notice kind="success">Personagem salvo.</Notice> : null}
          <Loadable query={community}>
            {(c) =>
              editing ? (
                <CharacterForm
                  fields={c.sheetFields}
                  initial={{ name: ch.name, sheet: ch.sheet, showOnGlobalProfile: ch.showOnGlobalProfile, showCommunityOnProfile: ch.showCommunityOnProfile, avatarKey: ch.avatarKey }}
                  submitLabel="Salvar"
                  onSubmit={async (input) => {
                    const { data, error } = await api.PUT('/characters/{id}', { params: { path: { id } }, body: input });
                    if (!data) return { ok: false, problem: error };
                    queryClient.setQueryData(['character', id], data);
                    await queryClient.invalidateQueries({ queryKey: ['characters', ch.communitySlug] });
                    setEditing(false);
                    setSaved(true);
                    return { ok: true };
                  }}
                />
              ) : (
                <Section title="Ficha">
                  {c.sheetFields.length === 0 ? (
                    <Text style={styles.empty}>A comunidade ainda não definiu campos de ficha.</Text>
                  ) : (
                    c.sheetFields.map((f) => (
                      <Row key={f.key} title={f.label} subtitle={ch.sheet.find((v) => v.key === f.key)?.value ?? '—'} />
                    ))
                  )}
                </Section>
              )
            }
          </Loadable>
          {!editing ? (
            <Text style={styles.muted}>
              {ch.showOnGlobalProfile
                ? `Aparece no perfil global${ch.showCommunityOnProfile ? ', com a comunidade de origem.' : ', sem mostrar a comunidade.'}`
                : 'Não aparece no perfil global.'}
            </Text>
          ) : null}
        </Page>
      )}
    </Loadable>
  );
}

const styles = StyleSheet.create({
  edit: { width: 100 },
  empty: { padding: 16, color: colors.textMuted },
  muted: { fontSize: 13, color: colors.textMuted },
});
