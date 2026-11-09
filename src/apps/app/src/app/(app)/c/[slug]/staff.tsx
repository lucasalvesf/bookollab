import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { ChapterApprovalAdmin } from '@/components/chapter-approval-admin';
import { EncyclopediaAdmin } from '@/components/encyclopedia-admin';
import { Empty, Loadable, Page, Row, Section, ToggleRow } from '@/components/layout';
import { Button, colors, Field, Notice } from '@/components/ui';

type SheetField = components['schemas']['SheetFieldDto'];
type FieldType = components['schemas']['SheetFieldType'];
const TYPES: FieldType[] = ['Text', 'LongText', 'Number'];

export default function StaffScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } })),
  });

  return (
    <Loadable query={community}>
      {(c) => {
        const perms = new Set(c.me?.permissions ?? []);
        return (
          <Page title="Área da staff" subtitle={c.name} back>
            {perms.has('ManageMembers') ? <JoinRequests slug={slug} /> : null}
            {perms.has('CreateInvites') ? <Invites slug={slug} /> : null}
            {perms.has('ManageCommunity') ? <SheetEditor slug={slug} initial={c.sheetFields} /> : null}
            {perms.has('ManageCommunity') || perms.has('ModerateContent') ? (
              <ChapterApprovalAdmin slug={slug} canConfigure={perms.has('ManageCommunity')} canModerate={perms.has('ModerateContent')} />
            ) : null}
            {perms.has('ManageCommunity') ? <EncyclopediaAdmin slug={slug} /> : null}
          </Page>
        );
      }}
    </Loadable>
  );
}

function JoinRequests({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ['join-requests', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}/join-requests', { params: { path: { slug } } })),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      unwrap(
        approve
          ? api.POST('/communities/{slug}/join-requests/{id}/approve', { params: { path: { slug, id } } })
          : api.POST('/communities/{slug}/join-requests/{id}/reject', { params: { path: { slug, id } } }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests', slug] });
      queryClient.invalidateQueries({ queryKey: ['members', slug] });
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
    },
  });

  return (
    <Section title="Pedidos de entrada">
      <Loadable query={requests}>
        {(list) =>
          list.length === 0 ? (
            <Empty>Nenhum pedido pendente.</Empty>
          ) : (
            list.map((r) => (
              <Row
                key={r.id}
                title={r.displayName}
                subtitle={`@${r.userName}`}
                right={
                  <View style={styles.inline}>
                    <View style={styles.smallButton}>
                      <Button title="Aprovar" onPress={() => decide.mutate({ id: r.id, approve: true })} />
                    </View>
                    <View style={styles.smallButton}>
                      <Button title="Recusar" variant="secondary" onPress={() => decide.mutate({ id: r.id, approve: false })} />
                    </View>
                  </View>
                }
              />
            ))
          )
        }
      </Loadable>
    </Section>
  );
}

function Invites({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState('7');
  const [maxUses, setMaxUses] = useState('');
  const invites = useQuery({
    queryKey: ['invites', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}/invites', { params: { path: { slug } } })),
  });
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/communities/{slug}/invites', {
          params: { path: { slug } },
          body: { expiresInDays: days ? Number(days) : null, maxUses: maxUses ? Number(maxUses) : null },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', slug] }),
  });

  return (
    <Section title="Convites">
      <View style={styles.padded}>
        {create.isError ? <Notice kind="error">{create.error.message}</Notice> : null}
        <View style={styles.inline}>
          <View style={styles.flex}>
            <Field label="Validade (dias)" value={days} onChangeText={(v) => setDays(v.replace(/\D/g, ''))} hint="Vazio = não expira" inputMode="numeric" />
          </View>
          <View style={styles.flex}>
            <Field label="Limite de usos" value={maxUses} onChangeText={(v) => setMaxUses(v.replace(/\D/g, ''))} hint="Vazio = ilimitado" inputMode="numeric" />
          </View>
        </View>
        <Button title="Gerar link de convite" onPress={() => create.mutate()} loading={create.isPending} />
      </View>
      <Loadable query={invites}>
        {(list) =>
          list.length === 0 ? (
            <Empty>Nenhum convite ativo.</Empty>
          ) : (
            list.map((i) => (
              <Row
                key={i.code}
                title={Linking.createURL(`/convite/${i.code}`)}
                subtitle={[
                  i.expiresAt ? `expira em ${new Date(i.expiresAt).toLocaleDateString('pt-BR')}` : 'não expira',
                  i.maxUses ? `${i.uses}/${i.maxUses} usos` : `${i.uses} usos`,
                ].join(' · ')}
              />
            ))
          )
        }
      </Loadable>
    </Section>
  );
}

function SheetEditor({ slug, initial }: { slug: string; initial: SheetField[] }) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<SheetField[]>(initial);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => unwrap(api.PUT('/communities/{slug}/sheet-fields', { params: { path: { slug } }, body: fields })),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
    },
  });

  const update = (index: number, patch: Partial<SheetField>) => {
    setSaved(false);
    setFields((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };
  const keyFrom = (label: string) =>
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 'f_$1') || 'campo';

  return (
    <Section title="Enciclopédia · modelo de Personagem">
      <View style={styles.padded}>
        <Text style={styles.hint}>Defina os campos que todo personagem desta comunidade preenche.</Text>
        {fields.map((f, i) => (
          <View key={i} style={styles.fieldCard}>
            <Field label={`Campo ${i + 1}`} value={f.label} onChangeText={(label) => update(i, { label, key: initial.some((x) => x.key === f.key) ? f.key : keyFrom(label) })} placeholder="Ex.: Raça" />
            <View style={styles.inline}>
              {TYPES.map((t) => (
                <Pressable key={t} accessibilityRole="radio" accessibilityState={{ checked: f.type === t }} onPress={() => update(i, { type: t })} style={[styles.chip, f.type === t && styles.chipSelected]}>
                  <Text style={[styles.chipText, f.type === t && styles.chipTextSelected]}>{labels.sheetFieldType[t]}</Text>
                </Pressable>
              ))}
            </View>
            <ToggleRow label="Obrigatório" value={f.required} onChange={(required) => update(i, { required })} />
            <Pressable accessibilityRole="button" onPress={() => setFields((c) => c.filter((_, j) => j !== i))}>
              <Text style={styles.remove}>Remover campo</Text>
            </Pressable>
          </View>
        ))}
        <Button title="+ Adicionar campo" variant="secondary" onPress={() => setFields((c) => [...c, { key: 'campo', label: '', type: 'Text', required: false }])} />
        {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
        {saved ? <Notice kind="success">Ficha salva.</Notice> : null}
        <Button title="Salvar ficha" onPress={() => save.mutate()} loading={save.isPending} />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' },
  smallButton: { width: 96 },
  flex: { flex: 1, minWidth: 140 },
  padded: { padding: 16, gap: 12 },
  hint: { fontSize: 14, color: colors.textMuted },
  fieldCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSelected: { color: colors.brandText, fontWeight: '600' },
  remove: { fontSize: 13, color: colors.danger, fontWeight: '600' },
});
