import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';

import { Empty, Row, Section } from './layout';
import { ChipPicker } from './pickers';
import { colors, Notice } from './ui';

type Mode = components['schemas']['ChapterApprovalMode'];

/** Staff: who needs chapter approval (nobody, everyone, selected roles) and the pending queue. */
export function ChapterApprovalAdmin({ slug, canConfigure, canModerate }: { slug: string; canConfigure: boolean; canModerate: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ['chapter-approval', slug],
    enabled: canConfigure,
    queryFn: () => unwrap(api.GET('/communities/{slug}/chapter-approval', { params: { path: { slug } } })),
  });
  const queue = useQuery({
    queryKey: ['chapter-approvals', slug],
    enabled: canModerate,
    queryFn: () => unwrap(api.GET('/communities/{slug}/chapter-approvals', { params: { path: { slug } } })),
  });
  const save = useMutation({
    mutationFn: (body: { mode: Mode; roleIds: string[] }) => unwrap(api.PUT('/communities/{slug}/chapter-approval', { params: { path: { slug } }, body })),
    onSuccess: (data) => queryClient.setQueryData(['chapter-approval', slug], data),
  });

  return (
    <>
      {canModerate ? (
        <Section title={`Capítulos aguardando aprovação${queue.data ? ` · ${queue.data.length}` : ''}`}>
          {(queue.data ?? []).length === 0 ? (
            <Empty>Nenhum capítulo na fila.</Empty>
          ) : (
            queue.data!.map((c) => (
              <Row key={c.id} title={c.title} subtitle={`${c.characterName} · @${c.authorUserName}`} onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: c.id } })} />
            ))
          )}
        </Section>
      ) : null}
      {canConfigure && config.data ? (
        <Section title="Aprovação de capítulos">
          <View style={styles.padded}>
            {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
            <ChipPicker
              label="Quem precisa de aprovação"
              options={[
                { value: 'Off' as Mode, label: 'Ninguém' },
                { value: 'All' as Mode, label: 'Todos os membros' },
                { value: 'Roles' as Mode, label: 'Cargos escolhidos' },
              ]}
              value={config.data.mode}
              onChange={(mode) => save.mutate({ mode, roleIds: config.data!.roleIds })}
            />
            {config.data.mode === 'Roles' ? (
              <View style={styles.roles}>
                {config.data.roles
                  .filter((r) => r.baseKind !== 'Owner')
                  .map((r) => {
                    const on = config.data!.roleIds.includes(r.id);
                    return (
                      <Pressable
                        key={r.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        onPress={() => save.mutate({ mode: 'Roles', roleIds: on ? config.data!.roleIds.filter((x) => x !== r.id) : [...config.data!.roleIds, r.id] })}
                        style={[styles.role, on && styles.roleOn]}>
                        <Text style={[styles.roleText, on && styles.roleTextOn]}>{on ? '☑' : '☐'} {r.name}</Text>
                      </Pressable>
                    );
                  })}
              </View>
            ) : null}
            <Text style={styles.hint}>A staff (quem modera) nunca precisa de aprovação: é ela quem aprova. Aprovação por jogador específico chega no Marco 3.</Text>
          </View>
        </Section>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  padded: { padding: 16, gap: 12 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  role: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  roleOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  roleText: { fontSize: 14, color: colors.text },
  roleTextOn: { color: colors.brandText, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textMuted },
});
