import { useState } from 'react';
import { View } from 'react-native';

import { problemMessage } from '@/api/client';
import type { components } from '@/api/schema';

import { AvatarPicker } from './avatar-picker';
import { ToggleRow } from './layout';
import { Button, Field, Notice } from './ui';

type SheetField = components['schemas']['SheetFieldDto'];
export type CharacterInput = components['schemas']['SaveCharacterRequest'];

/** Create/edit form for a character, driven by the community's sheet fields. */
export function CharacterForm({
  fields,
  initial,
  submitLabel,
  onSubmit,
}: {
  fields: SheetField[];
  initial?: CharacterInput;
  submitLabel: string;
  onSubmit: (input: CharacterInput) => Promise<{ ok: boolean; problem?: unknown }>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sheet, setSheet] = useState<Record<string, string>>(
    Object.fromEntries((initial?.sheet ?? []).map((v) => [v.key, v.value ?? ''])),
  );
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
    <View style={{ gap: 14 }}>
      {problem && !fieldErrorsShown ? <Notice kind="error">{problemMessage(problem) ?? 'Não foi possível salvar.'}</Notice> : null}
      <AvatarPicker name={name || '?'} imageKey={avatarKey} onChange={setAvatarKey} />
      <Field label="Nome do personagem" value={name} onChangeText={setName} error={problemMessage(problem, 'name')} />
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
      <ToggleRow label="Exibir no meu perfil global" value={showOnGlobalProfile} onChange={setShowOnGlobalProfile} />
      {showOnGlobalProfile ? (
        <ToggleRow label="Mostrar de qual comunidade ele é" value={showCommunityOnProfile} onChange={setShowCommunityOnProfile} />
      ) : null}
      <Button title={submitLabel} onPress={submit} loading={loading} />
    </View>
  );
}
