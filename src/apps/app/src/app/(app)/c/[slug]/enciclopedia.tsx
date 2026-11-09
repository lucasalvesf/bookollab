import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { Empty, Loadable, Page } from '@/components/layout';
import { Button, colors, Field } from '@/components/ui';

/** Encyclopedia of the community: all sheets (characters and others), organized in staff folders. */
export default function EncyclopediaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [folderId, setFolderId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const encyclopedia = useQuery({
    queryKey: ['encyclopedia', slug, folderId ?? 'all', term],
    queryFn: () => unwrap(api.GET('/communities/{slug}/encyclopedia', { params: { path: { slug }, query: { folderId, search: term || undefined } } })),
  });

  return (
    <Page
      title="Enciclopédia"
      subtitle="Personagens, locais, pets, famílias e tudo mais deste mundo."
      back
      actions={
        encyclopedia.data?.canCreate ? (
          <View style={styles.newButton}>
            <Button title="+ Nova ficha" onPress={() => router.push({ pathname: '/c/[slug]/enciclopedia/nova', params: { slug } })} />
          </View>
        ) : undefined
      }>
      <Field label="Buscar" value={search} onChangeText={setSearch} placeholder="Nome ou tipo" autoCapitalize="none" />
      <Loadable query={encyclopedia}>
        {(e) => (
          <>
            <View style={styles.folders}>
              <FolderChip label="Todas" selected={!folderId} onPress={() => setFolderId(undefined)} />
              {e.folders.map((f) => (
                <FolderChip key={f.id} label={`📁 ${f.name} · ${f.itemCount}`} selected={folderId === f.id} onPress={() => setFolderId(f.id)} />
              ))}
            </View>
            {e.canManage ? (
              <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/c/[slug]/staff', params: { slug } })}>
                <Text style={styles.manage}>Gerenciar pastas, modelos e regras da enciclopédia ›</Text>
              </Pressable>
            ) : null}
            {e.items.length === 0 ? (
              <Empty>Nenhuma ficha {folderId ? 'nesta pasta' : 'ainda'}.</Empty>
            ) : (
              <View style={styles.grid}>
                {e.items.map((item) => (
                  <Pressable
                    key={`${item.itemType}-${item.id}`}
                    accessibilityRole="button"
                    onPress={() =>
                      item.itemType === 'Character'
                        ? router.push({ pathname: '/personagens/[id]', params: { id: item.id } })
                        : router.push({ pathname: '/fichas/[id]', params: { id: item.id } })
                    }
                    style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                    <Avatar name={item.name} imageKey={item.imageKey} size={72} />
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.kind, item.itemType === 'Character' && styles.kindCharacter]}>
                      <Text style={[styles.kindText, item.itemType === 'Character' && styles.kindTextCharacter]} numberOfLines={1}>{item.kind}</Text>
                    </View>
                    <Text style={styles.owner} numberOfLines={1}>@{item.ownerUserName}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </Loadable>
    </Page>
  );
}

function FolderChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  newButton: { width: 140 },
  folders: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.brandText, fontWeight: '600' },
  manage: { fontSize: 13, color: colors.brand, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: 150, alignItems: 'center', gap: 6, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text, maxWidth: '100%' },
  kind: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, maxWidth: '100%' },
  kindCharacter: { backgroundColor: colors.brand },
  kindText: { fontSize: 12, fontWeight: '600', color: colors.brand },
  kindTextCharacter: { color: colors.brandText },
  owner: { fontSize: 12, color: colors.textMuted, maxWidth: '100%' },
  pressed: { opacity: 0.6 },
});
