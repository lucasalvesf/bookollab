import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { problemMessage } from '@/api/client';
import { labels } from '@/api/hooks';
import type { components } from '@/api/schema';
import { fieldKey } from '@/lib/keys';

import { AvatarPicker } from './avatar-picker';
import { ChipPicker } from './pickers';
import { Button, colors, Field, Notice } from './ui';

type FieldType = components['schemas']['SheetFieldType'];
export type BaseField = { key: string; label: string; type: FieldType; required: boolean };
export type SheetFieldInput = components['schemas']['SheetFieldInput'];
type CustomField = { key: string; label: string; type: FieldType; value: string };

export type SheetFormValue = { name: string; kind: string | null; imageKey: string | null; fields: SheetFieldInput[] };

const TYPES: FieldType[] = ['Text', 'LongText', 'Number'];

/**
 * Form for an encyclopedia sheet: the template's fields (fixed) plus, when allowed, the player's own fields.
 */
export function SheetForm({
  baseFields,
  canAddFields,
  initial,
  submitLabel,
  onSubmit,
}: {
  baseFields: BaseField[];
  canAddFields: boolean;
  initial?: { name: string; kind: string | null; imageKey: string | null; values: Record<string, string>; custom: CustomField[] };
  submitLabel: string;
  onSubmit: (value: SheetFormValue) => Promise<{ ok: boolean; problem?: unknown }>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState(initial?.kind ?? '');
  const [imageKey, setImageKey] = useState<string | null>(initial?.imageKey ?? null);
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [custom, setCustom] = useState<CustomField[]>(initial?.custom ?? []);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();

  const takenKeys = () => [...baseFields.map((f) => f.key), ...custom.map((c) => c.key)];
  const updateCustom = (index: number, patch: Partial<CustomField>) =>
    setCustom((list) =>
      list.map((c, i) => {
        if (i !== index) return c;
        const next = { ...c, ...patch };
        // A new field's key follows its label until saved.
        if (patch.label !== undefined && !initial?.custom.some((x) => x.key === c.key)) {
          next.key = fieldKey(patch.label, takenKeys().filter((k) => k !== c.key));
        }
        return next;
      }),
    );

  async function submit() {
    setLoading(true);
    setProblem(undefined);
    try {
      const fields: SheetFieldInput[] = [
        ...baseFields.map((f) => ({ key: f.key, label: null, type: null, value: values[f.key] ?? '' })),
        ...custom.filter((c) => c.label.trim()).map((c) => ({ key: c.key, label: c.label, type: c.type, value: c.value })),
      ];
      const result = await onSubmit({ name, kind: kind || null, imageKey, fields });
      if (!result.ok) setProblem(result.problem ?? { detail: 'Não foi possível salvar.' });
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  const fieldError = (key: string) => problemMessage(problem, `fields.${key}`);
  const anyFieldError = [...baseFields.map((f) => f.key), ...custom.map((c) => c.key)].some((k) => fieldError(k)) || !!problemMessage(problem, 'name');

  return (
    <View style={styles.form}>
      {problem && !anyFieldError ? <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível salvar.'}</Notice> : null}
      <AvatarPicker name={name || '?'} imageKey={imageKey} onChange={setImageKey} />
      <Field label="Nome" value={name} onChangeText={setName} error={problemMessage(problem, 'name')} />
      <Field label="Tipo" value={kind} onChangeText={setKind} error={problemMessage(problem, 'kind')} placeholder="Ex.: Pet, Local, Família, Item" />

      {baseFields.map((f) => (
        <Field
          key={f.key}
          label={f.required ? `${f.label} *` : f.label}
          value={values[f.key] ?? ''}
          onChangeText={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
          error={fieldError(f.key)}
          multiline={f.type === 'LongText'}
          numberOfLines={f.type === 'LongText' ? 4 : undefined}
          inputMode={f.type === 'Number' ? 'decimal' : undefined}
        />
      ))}

      {custom.map((c, i) => (
        <View key={i} style={styles.customCard}>
          <Field label="Nome do campo" value={c.label} onChangeText={(label) => updateCustom(i, { label })} placeholder="Ex.: Cor do pelo" />
          <ChipPicker options={TYPES.map((t) => ({ value: t, label: labels.sheetFieldType[t] }))} value={c.type} onChange={(type) => updateCustom(i, { type })} />
          <Field
            label={c.label || 'Valor'}
            value={c.value}
            onChangeText={(value) => updateCustom(i, { value })}
            error={fieldError(c.key)}
            multiline={c.type === 'LongText'}
            numberOfLines={c.type === 'LongText' ? 4 : undefined}
            inputMode={c.type === 'Number' ? 'decimal' : undefined}
          />
          <Pressable accessibilityRole="button" onPress={() => setCustom((list) => list.filter((_, j) => j !== i))}>
            <Text style={styles.remove}>Remover campo</Text>
          </Pressable>
        </View>
      ))}

      {canAddFields ? (
        <Button title="+ Adicionar campo" variant="secondary" onPress={() => setCustom((list) => [...list, { key: fieldKey('campo', takenKeys()), label: '', type: 'Text', value: '' }])} />
      ) : (
        <Text style={styles.hint}>Esta ficha segue o modelo: não é possível adicionar campos.</Text>
      )}
      <Button title={submitLabel} onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  customCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10, backgroundColor: colors.surface },
  remove: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textMuted },
});
