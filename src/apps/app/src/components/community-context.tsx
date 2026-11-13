import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { CommunityColor } from '@/theme';

type Community = components['schemas']['CommunityDetail'];

type Ctx = { slug?: string; community?: Community; declare: (path: string, slug: string | undefined) => void };

const ActiveCommunityContext = createContext<Ctx>({ declare: () => undefined });

/**
 * Which community the user is "inside" right now: routes under /c/[slug] say it in the URL; content
 * screens (scene, chapter, sheet, character) declare it with useDeclareCommunity once loaded.
 * Everything inside gets the community color; the shell uses it for the d20 button, the side menu
 * and the notifications filter.
 */
export function ActiveCommunityProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [declared, setDeclared] = useState<{ path: string; slug: string }>();
  const fromPath = /^\/c\/([^/]+)/.exec(pathname)?.[1];
  const slug = fromPath ?? (declared?.path === pathname ? declared.slug : undefined);
  const community = useQuery({
    queryKey: ['community', slug],
    enabled: !!slug,
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug: slug! } } })),
  });
  const declare = useCallback(
    (path: string, s: string | undefined) =>
      setDeclared((old) => (s ? (old?.path === path && old.slug === s ? old : { path, slug: s }) : old?.path === path ? undefined : old)),
    [],
  );
  const value = useMemo<Ctx>(() => ({ slug, community: community.data?.me ? community.data : undefined, declare }), [slug, community.data, declare]);
  return (
    <ActiveCommunityContext.Provider value={value}>
      <CommunityColor color={value.community?.accentColor} mode={value.community?.themeMode} overrides={value.community?.themeOverrides} translucent={!!value.community?.backgroundKey}>{children}</CommunityColor>
    </ActiveCommunityContext.Provider>
  );
}

export function useActiveCommunity() {
  return useContext(ActiveCommunityContext);
}

/** Content screens outside /c/[slug] call this with their community's slug (e.g. a scene). */
export function useDeclareCommunity(slug: string | undefined) {
  const pathname = usePathname();
  const { declare } = useContext(ActiveCommunityContext);
  useEffect(() => {
    declare(pathname, slug);
  }, [declare, pathname, slug]);
}
