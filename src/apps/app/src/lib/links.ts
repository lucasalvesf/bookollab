import type { Href } from 'expo-router';

/**
 * Internal links: anything in a community can be linked as "kind:id" (same format as the API's
 * Features/Links). In texts a link is written `@[Label](kind:id)`.
 */
export type LinkKind = 'character' | 'sheet' | 'chat' | 'post' | 'member' | 'section' | 'url';

export const MENTION = /@\[([^\]\n]{1,80})\]\(((?:character|sheet|chat|post|member|section|url):[^)\s]+)\)/g;

export function mentionMarkup(label: string, target: string) {
  return `@[${label.replace(/[[\]]/g, '')}](${target})`;
}

export function parseTarget(target: string): { kind: LinkKind; id: string } | null {
  const i = target.indexOf(':');
  if (i <= 0) return null;
  return { kind: target.slice(0, i) as LinkKind, id: target.slice(i + 1) };
}

/** Route of a link target. Sections need the community slug. External URLs return the URL string. */
export function targetHref(target: string, slug?: string): Href | string | null {
  const t = parseTarget(target);
  if (!t) return null;
  switch (t.kind) {
    case 'character':
      return { pathname: '/personagens/[id]', params: { id: t.id } };
    case 'sheet':
      return { pathname: '/fichas/[id]', params: { id: t.id } };
    case 'chat':
      return { pathname: '/cenas/[id]', params: { id: t.id } };
    case 'post':
      return { pathname: '/capitulos/[id]', params: { id: t.id } };
    case 'member':
      return slug ? { pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: t.id } } : { pathname: '/u/[userName]', params: { userName: t.id } };
    case 'section':
      if (!slug) return null;
      return t.id === 'encyclopedia' ? { pathname: '/c/[slug]/enciclopedia', params: { slug } } : { pathname: '/c/[slug]', params: { slug, tab: t.id } };
    case 'url':
      return t.id;
  }
}

export const KIND_LABEL: Record<string, string> = {
  character: 'Personagens',
  sheet: 'Enciclopédia',
  chat: 'Chats',
  post: 'Posts',
  member: 'Membros',
  section: 'Seções',
  url: 'Links externos',
};

/** Splits a text into plain parts and mention links. */
export function splitMentions(text: string): ({ text: string } | { label: string; target: string })[] {
  const parts: ({ text: string } | { label: string; target: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ label: m[1], target: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
