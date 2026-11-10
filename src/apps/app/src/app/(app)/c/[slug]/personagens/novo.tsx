import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { CharacterForm } from '@/components/character-form';
import { Loadable, Page } from '@/components/layout';

export default function NewCharacterScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } })),
  });

  return (
    <Loadable query={community}>
      {(c) => (
        <Page title="Novo personagem" subtitle={c.name} back>
          <CharacterForm
            fields={c.sheetFields}
            submitLabel="Criar personagem"
            onCancel={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/c/[slug]', params: { slug } }))}
            onSubmit={async (input) => {
              const { data, error } = await api.POST('/communities/{slug}/characters', { params: { path: { slug } }, body: input });
              if (!data) return { ok: false, problem: error };
              await queryClient.invalidateQueries({ queryKey: ['characters', slug] });
              router.replace({ pathname: '/personagens/[id]', params: { id: data.id } });
              return { ok: true };
            }}
          />
        </Page>
      )}
    </Loadable>
  );
}
