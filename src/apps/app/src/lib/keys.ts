/** Turns a field label into a valid field key ("Cor do pelo" → "cor_do_pelo"), unique among `taken`. */
export function fieldKey(label: string, taken: string[] = []): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 'f_$1')
      .slice(0, 50) || 'campo';
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`;
  return key;
}
