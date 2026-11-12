/** Parses a Brazilian date (DD/MM/AAAA) into ISO "YYYY-MM-DD". Returns null if invalid. */
export function parseBrazilianDate(input: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? `${yyyy}-${mm}-${dd}` : null;
}

/** Inserts the slashes while the user types digits: "14042000" → "14/04/2000". */
export function maskBrazilianDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "Online" / "Visto por último há 5 min" for a member, respecting what the API returned (null = hidden). */
export function presenceLabel(p: { online?: boolean | null; lastSeenAt?: string | null } | null | undefined): string | null {
  if (!p) return null;
  if (p.online) return 'Online agora';
  if (!p.lastSeenAt) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(p.lastSeenAt).getTime()) / 60000));
  if (minutes < 1) return 'Visto agora mesmo';
  if (minutes < 60) return `Visto há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Visto há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Visto há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return `Visto em ${new Date(p.lastSeenAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
}