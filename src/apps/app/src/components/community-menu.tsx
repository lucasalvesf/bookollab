import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { ArrowRight, Link2, LogOut, Shield, UserRound, X } from 'lucide-react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';

import { useCopyLink, useMenu, type MenuItem } from './menu';

const STAFF_PERMISSIONS = ['ManageMembers', 'CreateInvites', 'ManageCommunity', 'ModerateContent', 'ArrangeSections'];

/** Actions of a community (rail icon, cards, community header). Leaving asks for confirmation in a second menu. */
export function useCommunityMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const copyLink = useCopyLink();
  const { openMenu, toast } = useMenu();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });

  return (c: { slug: string; name: string; myPermissions?: string[] | null }, isMember = true): MenuItem[] => {
    const perms = new Set(c.myPermissions ?? []);
    const leave = async () => {
      const { error, response } = await api.POST('/communities/{slug}/leave', { params: { path: { slug: c.slug } } });
      if (!response.ok) {
        toast((error as { detail?: string } | undefined)?.detail ?? 'Não foi possível sair.');
        return;
      }
      toast(`Você saiu de ${c.name}`);
      await queryClient.invalidateQueries({ queryKey: ['my-communities'] });
      await queryClient.invalidateQueries({ queryKey: ['community', c.slug] });
      if (pathname.startsWith(`/c/${c.slug}`)) router.replace('/');
    };
    return [
      { label: 'Abrir comunidade', icon: ArrowRight, onPress: () => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } }) },
      {
        label: 'Meu perfil aqui',
        icon: UserRound,
        hidden: !isMember || !me.data,
        onPress: () => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug: c.slug, userName: me.data!.userName } }),
      },
      { label: 'Moderação e configurações', icon: Shield, hidden: !STAFF_PERMISSIONS.some((p) => perms.has(p)), onPress: () => router.push({ pathname: '/c/[slug]/staff', params: { slug: c.slug } }) },
      'separator',
      { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/c/${c.slug}`) },
      ...(isMember
        ? (['separator', {
            label: 'Sair da comunidade',
            icon: LogOut,
            danger: true,
            onPress: () =>
              openMenu(
                [
                  { label: `Sair de ${c.name}`, icon: LogOut, danger: true, onPress: () => void leave() },
                  { label: 'Cancelar', icon: X, onPress: () => undefined },
                ],
                undefined,
                'Tem certeza?',
              ),
          }] as MenuItem[])
        : []),
    ];
  };
}
