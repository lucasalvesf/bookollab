import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { fieldKey } from '@/lib/keys';

import { Empty, Row, Section, ToggleRow } from './layout';
import { ChipPicker, ConfirmButton } from './pickers';
import { Button, Field, Notice } from './ui';
import { makeStyles } from '@/theme';
import { Folder } from 'lucide-react-native';

type Template = components['schemas']['TemplateDto'];
type SheetField = components['schemas']['SheetFieldDto'];
type FieldType = components['schemas']['SheetFieldType'];
type TemplateMode = components['schemas']['TemplateMode'];
const TYPES: FieldType[] = ['Text', 'LongText', 'Number'];

/** Staff tools for the encyclopedia: rules, folders and sheet templates. */
export function EncyclopediaAdmin({ slug }: { slug: string }) {
  const encyclopedia = useQuery({
    queryKey: ['encyclopedia', slug, 'all', ''],
    queryFn: () => unwrap(api.GET('/communities/{slug}/encyclopedia', { params: { path: { slug }, query: {} } })),
  });
  if (!encyclopedia.data) return null;
  const e = encyclopedia.data;
  return (
    <>
      <Rules slug={slug} freeSheetsEnabled={e.settings.freeSheetsEnabled} templateMode={e.settings.templateMode} />
      <Folders slug={slug} folders={e.folders} />
      <Templates slug={slug} templates={e.templates} />
    </>
  );
}

function useRefresh(slug: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['encyclopedia', slug] });
}

function Rules({ slug, freeSheetsEnabled, templateMode }: { slug: string; freeSheetsEnabled: boolean; templateMode: TemplateMode }) {
  const styles = useStyles();
  const refresh = useRefresh(slug);
  const save = useMutation({
    mutationFn: (body: { freeSheetsEnabled: boolean; templateMode: TemplateMode }) =>
      unwrap(api.PUT('/communities/{slug}/encyclopedia/settings', { params: { path: { slug } }, body })),
    onSuccess: refresh,
  });
  return (
    <Section title="Enciclopédia · regras">
      <View style={styles.padded}>
        {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
        <ToggleRow
          label="Fichas livres"
          hint={freeSheetsEnabled ? 'Jogadores podem criar fichas do zero, além dos modelos.' : 'Jogadores só criam fichas a partir dos modelos.'}
          value={freeSheetsEnabled}
          onChange={(v) => save.mutate({ freeSheetsEnabled: v, templateMode })}
        />
        <ChipPicker
          label="Fichas feitas a partir de um modelo"
          options={[
            { value: 'Strict' as TemplateMode, label: 'Somente os campos do modelo' },
            { value: 'Base' as TemplateMode, label: 'Modelo como base (pode adicionar campos)' },
          ]}
          value={templateMode}
          onChange={(mode) => save.mutate({ freeSheetsEnabled, templateMode: mode })}
        />
      </View>
    </Section>
  );
}

function Folders({ slug, folders }: { slug: string; folders: components['schemas']['FolderDto'][] }) {
  const styles = useStyles();
  const refresh = useRefresh(slug);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string }>();
  const [error, setError] = useState<string>();

  async function run(promise: Promise<unknown>) {
    setError(undefined);
    try {
      await promise;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Section title="Enciclopédia · pastas">
      <View style={styles.padded}>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <View style={styles.inline}>
          <View style={styles.flex}>
            <Field label="Nova pasta" value={name} onChangeText={setName} placeholder="Ex.: Bestiário, Locais, Famílias" />
          </View>
          <View style={styles.addButton}>
            <Button
              title="Criar"
              onPress={() => name.trim() && run(unwrap(api.POST('/communities/{slug}/folders', { params: { path: { slug } }, body: { name, position: null } })).then(() => setName('')))}
            />
          </View>
        </View>
      </View>
      {folders.length === 0 ? <Empty>Nenhuma pasta ainda.</Empty> : null}
      {folders.map((f) =>
        renaming?.id === f.id ? (
          <View key={f.id} style={styles.padded}>
            <Field label="Nome da pasta" value={renaming.name} onChangeText={(v) => setRenaming({ id: f.id, name: v })} />
            <View style={styles.inline}>
              <Pressable onPress={() => run(unwrap(api.PUT('/folders/{id}', { params: { path: { id: f.id } }, body: { name: renaming.name, position: null } })).then(() => setRenaming(undefined)))}>
                <Text style={styles.link}>Salvar</Text>
              </Pressable>
              <Pressable onPress={() => setRenaming(undefined)}>
                <Text style={styles.muted}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Row
            key={f.id}
            icon={Folder}
            title={f.name}
            subtitle={`${f.itemCount} ${f.itemCount === 1 ? 'ficha' : 'fichas'}`}
            right={
              <View style={styles.inline}>
                <Pressable onPress={() => setRenaming({ id: f.id, name: f.name })}>
                  <Text style={styles.link}>Renomear</Text>
                </Pressable>
                <ConfirmButton label="Apagar" confirmLabel="Apagar pasta (as fichas ficam)" onConfirm={() => run(unwrap(api.DELETE('/folders/{id}', { params: { path: { id: f.id } } })))} />
              </View>
            }
          />
        ),
      )}
    </Section>
  );
}

function Templates({ slug, templates }: { slug: string; templates: Template[] }) {
  const styles = useStyles();
  const [editing, setEditing] = useState<Template | 'new'>();
  return (
    <Section
      title="Enciclopédia · modelos de ficha"
      right={!editing ? <View style={styles.addButton}><Button title="+ Modelo" onPress={() => setEditing('new')} /></View> : undefined}>
      {editing ? (
        <TemplateEditor slug={slug} template={editing === 'new' ? undefined : editing} onDone={() => setEditing(undefined)} />
      ) : templates.length === 0 ? (
        <Empty>Nenhum modelo. Crie modelos (ex.: Pet, Local, Família) para os jogadores seguirem.</Empty>
      ) : (
        templates.map((t) => (
          <Row key={t.id} title={t.name} subtitle={[t.kind, `${t.fields.length} ${t.fields.length === 1 ? 'campo' : 'campos'}`].filter(Boolean).join(' · ')} onPress={() => setEditing(t)} />
        ))
      )}
    </Section>
  );
}

function TemplateEditor({ slug, template, onDone }: { slug: string; template?: Template; onDone: () => void }) {
  const styles = useStyles();
  const refresh = useRefresh(slug);
  const [name, setName] = useState(template?.name ?? '');
  const [kind, setKind] = useState(template?.kind ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [fields, setFields] = useState<SheetField[]>(template?.fields ?? []);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const update = (index: number, patch: Partial<SheetField>) =>
    setFields((list) =>
      list.map((f, i) => {
        if (i !== index) return f;
        const next = { ...f, ...patch };
        if (patch.label !== undefined && !template?.fields.some((x) => x.key === f.key)) {
          next.key = fieldKey(patch.label, list.filter((_, j) => j !== i).map((x) => x.key));
        }
        return next;
      }),
    );

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const body = { name, kind: kind || null, description: description || null, fields: fields.filter((f) => f.label.trim()) };
      await unwrap(
        template
          ? api.PUT('/sheet-templates/{id}', { params: { path: { id: template.id } }, body })
          : api.POST('/communities/{slug}/sheet-templates', { params: { path: { slug } }, body }),
      );
      await refresh();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!template) return;
    try {
      await unwrap(api.DELETE('/sheet-templates/{id}', { params: { path: { id: template.id } } }));
      await refresh();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={styles.padded}>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field label="Nome do modelo" value={name} onChangeText={setName} placeholder="Ex.: Pet" />
      <Field label="Tipo das fichas" value={kind} onChangeText={setKind} placeholder="Ex.: Pet" hint="Aparece no cartão das fichas criadas com este modelo." />
      <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
      {fields.map((f, i) => (
        <View key={i} style={styles.fieldCard}>
          <Field label={`Campo ${i + 1}`} value={f.label} onChangeText={(label) => update(i, { label })} placeholder="Ex.: Espécie" />
          <ChipPicker options={TYPES.map((t) => ({ value: t, label: labels.sheetFieldType[t] }))} value={f.type} onChange={(type) => update(i, { type })} />
          <ToggleRow label="Obrigatório" value={f.required} onChange={(required) => update(i, { required })} />
          <Pressable onPress={() => setFields((list) => list.filter((_, j) => j !== i))}>
            <Text style={styles.remove}>Remover campo</Text>
          </Pressable>
        </View>
      ))}
      <Button title="+ Adicionar campo" variant="secondary" onPress={() => setFields((list) => [...list, { key: fieldKey('campo', list.map((x) => x.key)), label: '', type: 'Text', required: false }])} />
      <Text style={styles.hint}>Mudar um modelo vale para as fichas novas; as fichas já criadas mantêm os campos que tinham.</Text>
      <View style={styles.inline}>
        <View style={styles.flex}>
          <Button title="Salvar modelo" onPress={save} loading={saving} />
        </View>
        <View style={styles.flex}>
          <Button title="Cancelar" variant="secondary" onPress={onDone} />
        </View>
      </View>
      {template ? <ConfirmButton label="Apagar modelo" confirmLabel="Confirmar: apagar modelo (as fichas ficam)" onConfirm={remove} /> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  padded: { padding: 16, gap: 12 },
  inline: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 140 },
  addButton: { width: 110 },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  fieldCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10 },
  remove: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textMuted },
}));
