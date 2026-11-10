import { Eye, IdCard, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { problemMessage } from '@/api/client';
import type { components } from '@/api/schema';
import { makeStyles } from '@/theme';

import { AvatarPicker } from './avatar-picker';
import { FormSection } from './form';
import { ToggleRow } from './layout';
import { Button, Field, Notice } from './ui';

type SheetField = components['schemas']['SheetFieldDto'];
export type CharacterInput = components['schemas']['SaveCharacterRequest'];

/** Create/edit form for a character, grouped like a profile: identity, sheet, visibility. */
export function CharacterForm({
  fields,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  fields: SheetField[];
  initial?: CharacterInput;
  submitLabel: string;
  onSubmit: (input: CharacterInput) => Promise<{ ok: boolean; problem?: unknown }>;
  onCancel?: () => void;
}) {
  const styles = useStyles();
  const [name, setName] = useState(initial?.name ?? '');
  const [sheet, setSheet] = useState<Record<string, string>>(Object.fromEntries((initial?.sheet ?? []).map((v) => [v.key, v.value ?? ''])));
  const [showOnGlobalProfile, setShowOnGlobalProfile] = useState(initial?.showOnGlobalProfile ?? false);
  const [showCommunityOnProfile, setShowCommunityOnProfile] = useState(initial?.showCommunityOnProfile ?? true);
  const [avatarKey, setAvatarKey] = useState<string | null>(initial?.avatarKey ?? null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<unknown>();

  async function submit() {
    setLoading(true);
    setProblem(undefined);
    try {
      const result = await onSubmit({
        name,
        sheet: fields.map((f) => ({ key: f.key, value: sheet[f.key] ?? '' })),
        showOnGlobalProfile,
        showCommunityOnProfile,
        avatarKey,
      });
      if (!result.ok) setProblem(result.problem ?? { detail: 'Não foi possível salvar.' });
    } catch {
      setProblem({ detail: 'Sem conexão com o servidor. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  const fieldErrorsShown = fields.some((f) => problemMessage(problem, `sheet.${f.key}`)) || !!problemMessage(problem, 'name');

  return (
    <View style={styles.stack}>
      {problem && !fieldErrorsShown ? <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível salvar.'}</Notice> : null}
      <FormSection title="Identidade" icon={UserRound}>
        <AvatarPicker name={name || '?'} imageKey={avatarKey} onChange={setAvatarKey} />
        <Field label="Nome do personagem" value={name} onChangeText={setName} error={problemMessage(problem, 'name')} placeholder="Ex.: Ayla Venn" />
      </FormSection>
      {fields.length > 0 ? (
        <FormSection title="Ficha" icon={IdCard} description="Campos definidos pela staff. * = obrigatório. Campos numéricos podem virar atributos nas rolagens.">
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.required ? `${f.label} *` : f.label}
              value={sheet[f.key] ?? ''}
              onChangeText={(v) => setSheet((s) => ({ ...s, [f.key]: v }))}
              error={problemMessage(problem, `sheet.${f.key}`)}
              multiline={f.type === 'LongText'}
              numberOfLines={f.type === 'LongText' ? 4 : undefined}
              inputMode={f.type === 'Number' ? 'decimal' : undefined}
            />
          ))}
        </FormSection>
      ) : null}
      <FormSection title="Visibilidade" icon={Eye}>
        <View style={styles.toggles}>
          <ToggleRow label="Exibir no meu perfil global" hint="Aparece na sua vitrine, fora da comunidade." value={showOnGlobalProfile} onChange={setShowOnGlobalProfile} />
          {showOnGlobalProfile ? <ToggleRow label="Mostrar de qual comunidade ele é" value={showCommunityOnProfile} onChange={setShowCommunityOnProfile} /> : null}
        </View>
      </FormSection>
      <View style={styles.actions}>
        {onCancel ? <Button title="Cancelar" variant="ghost" size="sm" onPress={onCancel} /> : null}
        <Button title={submitLabel} size="sm" onPress={submit} loading={loading} disabled={!name.trim()} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  stack: { gap: 16 },
  toggles: { marginHorizontal: -16, marginVertical: -12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
}));
