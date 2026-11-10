import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';

import { ChipPicker } from './pickers';
import { useTheme } from '@/theme';

/** Staff-only: choose the encyclopedia folder of a sheet or character. */
export function FolderPicker({ slug, itemType, itemId, folderId, onMoved }: { slug: string; itemType: 'Sheet' | 'Character'; itemId: string; folderId: string | null | undefined; onMoved: () => void }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const encyclopedia = useQuery({
    queryKey: ['encyclopedia', slug, 'all', ''],
    queryFn: () => unwrap(api.GET('/communities/{slug}/encyclopedia', { params: { path: { slug }, query: {} } })),
  });
  const move = useMutation({
    mutationFn: (target: string | null) =>
      unwrap(
        itemType === 'Sheet'
          ? api.PUT('/sheets/{id}/folder', { params: { path: { id: itemId } }, body: { folderId: target } })
          : api.PUT('/characters/{id}/folder', { params: { path: { id: itemId } }, body: { folderId: target } }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['encyclopedia', slug] });
      onMoved();
    },
  });

  if (!encyclopedia.data?.canManage) return null;
  const options = [{ value: 'none', label: 'Sem pasta' }, ...encyclopedia.data.folders.map((f) => ({ value: f.id, label: f.name }))];
  return (
    <View style={{ gap: 6 }}>
      <ChipPicker label="Pasta na enciclopédia (moderação)" options={options} value={folderId ?? 'none'} onChange={(v) => move.mutate(v === 'none' ? null : v)} />
      {move.isError ? <Text style={{ color: colors.danger, fontSize: 13 }}>{move.error.message}</Text> : null}
    </View>
  );
}
