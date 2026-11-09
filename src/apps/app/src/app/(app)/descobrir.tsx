import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useDeferredValue, useState } from 'react';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Empty, Loadable, Page, Row, Section, Tag } from '@/components/layout';
import { Field } from '@/components/ui';

export default function DiscoverScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const results = useQuery({
    queryKey: ['discover', term],
    queryFn: () => unwrap(api.GET('/communities', { params: { query: { search: term || undefined } } })),
  });

  return (
    <Page title="Descobrir comunidades" subtitle="Comunidades públicas: algumas você entra direto, outras pedem aprovação da staff." back>
      <Field label="Buscar" value={search} onChangeText={setSearch} placeholder="Nome ou tema" autoCapitalize="none" />
      <Section title={term ? `Resultados para "${term}"` : 'Mais populares'}>
        <Loadable query={results}>
          {(list) =>
            list.length === 0 ? (
              <Empty>Nenhuma comunidade encontrada.</Empty>
            ) : (
              list.map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  subtitle={[c.description, `${c.memberCount} ${c.memberCount === 1 ? 'membro' : 'membros'}`].filter(Boolean).join(' · ')}
                  right={c.joinPolicy === 'Request' ? <Tag label="Com aprovação" /> : undefined}
                  onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } })}
                />
              ))
            )
          }
        </Loadable>
      </Section>
    </Page>
  );
}
