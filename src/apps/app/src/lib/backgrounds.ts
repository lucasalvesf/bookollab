/** Preset chat backgrounds for scenes. Stored as "preset:<name>"; images as "image:<upload key>". */
export const BACKGROUND_PRESETS = [
  { name: 'pergaminho', label: 'Pergaminho', color: '#EFE6D2', dark: false },
  { name: 'neve', label: 'Neve', color: '#F1F4F8', dark: false },
  { name: 'lavanda', label: 'Lavanda', color: '#E7E0F4', dark: false },
  { name: 'menta', label: 'Menta', color: '#DDF0E8', dark: false },
  { name: 'noite', label: 'Noite', color: '#1B2235', dark: true },
  { name: 'floresta', label: 'Floresta', color: '#1E3B2F', dark: true },
  { name: 'oceano', label: 'Oceano', color: '#13314A', dark: true },
  { name: 'vinho', label: 'Vinho', color: '#3B1624', dark: true },
  { name: 'carvao', label: 'Carvão', color: '#222222', dark: true },
] as const;

const DEFAULT = BACKGROUND_PRESETS[0];

export type ResolvedBackground = { color: string; imageKey?: string; dark: boolean };

export function resolveBackground(value: string | null | undefined): ResolvedBackground {
  if (value?.startsWith('image:')) return { color: '#111111', imageKey: value.slice(6), dark: true };
  const preset = BACKGROUND_PRESETS.find((p) => `preset:${p.name}` === value) ?? DEFAULT;
  return { color: preset.color, dark: preset.dark };
}
