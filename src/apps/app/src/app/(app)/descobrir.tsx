import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search, TrendingUp } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { CardGrid, CommunityCard } from '@/components/community';
import { useCommunityMenu } from '@/components/community-menu';
import { Empty, Loadable, Page, Section, Tag } from '@/components/layout';
import { makeStyles, radius, useTheme } from '@/theme';

export default function DiscoverScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const communityMenu = useCommunityMenu();
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const results = useQuery({
    queryKey: ['discover', term],
    queryFn: () => unwrap(api.GET('/communities', { params: { query: { search: term || undefined } } })),
  });

  return (
    <Page title="Descobrir" subtitle="Comunidades públicas: algumas você entra direto, outras pedem aprovação da staff.">
      <View style={styles.search}>
        <Search size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou tema"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          style={styles.searchInput}
          accessibilityLabel="Buscar comunidades"
        />
      </View>
      <Section title={term ? `Resultados para "${term}"` : 'Em alta'} icon={TrendingUp} plain>
        <Loadable query={results}>
          {(list) =>
            list.length === 0 ? (
              <Empty icon={Search}>Nenhuma comunidade encontrada.</Empty>
            ) : (
              <CardGrid>
                {list.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    menu={communityMenu(c, false)}
                    right={c.joinPolicy === 'Request' ? <Tag label="Com aprovação" tone="warning" /> : <Tag label="Aberta" tone="success" />}
                    onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } })}
                  />
                ))}
              </CardGrid>
            )
          }
        </Loadable>
      </Section>
    </Page>
  );
}

const useStyles = makeStyles((colors) => ({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 },
}));
