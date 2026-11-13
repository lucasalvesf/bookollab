import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Link2, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { useDeclareCommunity } from '@/components/community-context';
import { FolderPicker } from '@/components/folder-picker';
import { Loadable, Page } from '@/components/layout';
import { MoreButton, useCopyLink, useMenu, type MenuItem } from '@/components/menu';
import { SheetForm } from '@/components/sheet-form';
import { ReceiptFields, SheetBackdrop, SheetContent, SheetFooter, SheetHero, sheetImages } from '@/components/sheet-page';
import { Notice } from '@/components/ui';
import { makeStyles } from '@/theme';

/**
 * An encyclopedia sheet: image slideshow header with the main image centered, the data as a receipt,
 * then the text (like a post). Edit, delete and move to a folder sit in the "⋯" menu.
 */
export default function SheetScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const copyLink = useCopyLink();
  const { openMenu } = useMenu();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const sheet = useQuery({ queryKey: ['sheet', id], queryFn: () => unwrap(api.GET('/sheets/{id}', { params: { path: { id } } }), 'Ficha não encontrada.') });
  const page = useQuery({ queryKey: ['sheet-page', id], queryFn: () => unwrap(api.GET('/sheets/{id}/page', { params: { path: { id } } })) });
  useDeclareCommunity(sheet.data?.communitySlug);

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
      {(s) => {
        const menu: MenuItem[] = [
          { label: 'Editar dados da ficha', icon: Pencil, hidden: !s.canEdit, onPress: () => setEditing(true) },
          { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/fichas/${s.id}`) },
          ...(s.canEdit
            ? (['separator', { label: 'Apagar ficha', icon: Trash2, danger: true, onPress: () => openMenu([{ label: `Apagar "${s.name}"`, icon: Trash2, danger: true, onPress: () => void remove(s.communitySlug) }], undefined, 'Apagar a ficha? Não dá para desfazer.') }] as MenuItem[])
            : []),
        ];
        return (
          <SheetBackdrop page={editing ? null : page.data}>
            <Page
              title={editing ? 'Editar ficha' : s.name}
              back
              maxWidth={1100}
              transparent={!editing && (!!page.data?.backgroundKey || !!page.data?.backgroundColor)}
              actions={editing ? undefined : <MoreButton items={menu} title={s.name} size={40} />}>
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
                  <SheetHero name={s.name} kind={s.kind ?? 'Ficha'} imageKey={s.imageKey} images={sheetImages(s.imageKey, page.data?.content)} />
                  <ReceiptFields fields={s.fields.map((f) => ({ label: f.label, value: f.value, long: f.type === 'LongText' }))} />
                  {page.data ? (
                    <SheetContent
                      key={page.dataUpdatedAt}
                      page={page.data}
                      slug={s.communitySlug}
                      onSave={async ({ content, background }) => {
                        const data = await unwrap(api.PUT('/sheets/{id}/page', { params: { path: { id } }, body: { content, backgroundKey: background.imageKey, backgroundColor: background.color, backgroundBlur: background.blur } }));
                        queryClient.setQueryData(['sheet-page', id], data);
                      }}
                    />
                  ) : null}
                  <View style={styles.quiet}>
                    <FolderPicker slug={s.communitySlug} itemType="Sheet" itemId={s.id} folderId={s.folderId} onMoved={() => queryClient.invalidateQueries({ queryKey: ['sheet', id] })} />
                  </View>
                  <SheetFooter slug={s.communitySlug} communityName={s.communityName} ownerUserName={s.ownerUserName} />
                </>
              )}
            </Page>
          </SheetBackdrop>
        );
      }}
    </Loadable>
  );
}

const useStyles = makeStyles(() => ({
  quiet: { opacity: 0.9 },
}));
