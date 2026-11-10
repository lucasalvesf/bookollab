import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Loadable, Page } from '@/components/layout';
import { Button, Notice } from '@/components/ui';
import { useTheme } from '@/theme';

export default function InviteScreen() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ['invite', code],
    queryFn: () => unwrap(api.GET('/invites/{code}', { params: { path: { code } } }), 'Convite não encontrado.'),
  });
  const accept = useMutation({
    mutationFn: () => unwrap(api.POST('/invites/{code}/accept', { params: { path: { code } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-communities'] });
      router.replace({ pathname: '/c/[slug]', params: { slug: preview.data!.communitySlug } });
    },
  });

  return (
    <Loadable query={preview}>
      {(p) => (
        <Page title={`Convite para ${p.communityName}`} back>
          {p.communityDescription ? <Text style={{ fontSize: 15, color: colors.text }}>{p.communityDescription}</Text> : null}
          {accept.isError ? <Notice kind="error">{accept.error.message}</Notice> : null}
          {p.alreadyMember ? (
            <Button title="Você já é membro · abrir comunidade" onPress={() => router.replace({ pathname: '/c/[slug]', params: { slug: p.communitySlug } })} />
          ) : p.usable ? (
            <Button title="Aceitar convite" onPress={() => accept.mutate()} loading={accept.isPending} />
          ) : (
            <Notice kind="error">Este convite expirou ou atingiu o limite de usos. Peça um novo para a moderação.</Notice>
          )}
        </Page>
      )}
    </Loadable>
  );
}
