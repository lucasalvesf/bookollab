import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookMarked, Check, Plus, Dices, FileCheck2, IdCard, LayoutList, Link2, Paintbrush, Pin, UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Avatar } from '@/components/avatar';
import { ChapterApprovalAdmin } from '@/components/chapter-approval-admin';
import { CommunityCover } from '@/components/community';
import { AppearanceAdmin, PinsAdmin, SectionsAdmin, ThemeAdmin } from '@/components/community-admin';
import { EncyclopediaAdmin } from '@/components/encyclopedia-admin';
import { MechanicsAdmin } from '@/components/mechanics';
import { Empty, Loadable, Row, Section, ToggleRow } from '@/components/layout';
import { SettingsLayout, type SettingsPage } from '@/components/settings';
import { Button, Field, Notice } from '@/components/ui';
import { makeStyles } from '@/theme';

type SheetField = components['schemas']['SheetFieldDto'];
type FieldType = components['schemas']['SheetFieldType'];
const TYPES: FieldType[] = ['Text', 'LongText', 'Number'];

export default function StaffScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug } } })),
  });

  const requests = useQuery({
    queryKey: ['join-requests', slug],
    enabled: !!community.data?.me?.permissions.includes('ManageMembers'),
    queryFn: () => unwrap(api.GET('/communities/{slug}/join-requests', { params: { path: { slug } } })),
  });

  return (
    <Loadable query={community}>
      {(c) => {
        const perms = new Set(c.me?.permissions ?? []);
        const manage = perms.has('ManageCommunity');
        const pages: SettingsPage[] = [
          { key: 'appearance', group: 'Comunidade', title: 'Aparência', icon: Paintbrush, keywords: 'capa ícone imagem foto visual cor', description: 'Ícone e capa que aparecem na faixa lateral, nos cartões e no topo da comunidade.', render: () => (
            <>
              <AppearanceAdmin community={c} />
              <ThemeAdmin community={c} />
            </>
          ) },
          { key: 'sections', group: 'Comunidade', title: 'Seções e ordem', icon: LayoutList, keywords: 'abas ordem menu visão geral reordenar', description: 'A ordem das abas que os membros veem.', render: () => <SectionsAdmin community={c} /> },
          { key: 'requests', group: 'Membros', title: 'Pedidos de entrada', icon: UserPlus, keywords: 'aprovar entrada pedidos aceitar recusar', description: 'Quem pediu para entrar na comunidade.', badge: requests.data?.length, render: () => <JoinRequests slug={slug} /> },
          { key: 'invites', group: 'Membros', title: 'Convites', icon: Link2, keywords: 'link convite validade usos', description: 'Links para entrar na comunidade, com validade e limite de usos.', render: () => <Invites slug={slug} /> },
          ...(perms.has('PinPosts') ? [{ key: 'pins', group: 'Conteúdo', title: 'Posts fixados', icon: Pin, keywords: 'fixar alfinete topo destaque barra', description: 'Posts que ficam fixados logo abaixo do cabeçalho da comunidade.', render: () => <PinsAdmin slug={slug} /> } as SettingsPage] : []),
          { key: 'chapters', group: 'Conteúdo', title: 'Aprovação de capítulos', icon: FileCheck2, keywords: 'fila moderação aprovar recusar capítulos cargos', description: 'Quem precisa de aprovação e a fila de capítulos pendentes.', render: () => <ChapterApprovalAdmin slug={slug} canConfigure={manage} canModerate={perms.has('ModerateContent')} /> },
          { key: 'encyclopedia', group: 'Conteúdo', title: 'Enciclopédia', icon: BookMarked, keywords: 'pastas modelos fichas livres wiki', description: 'Pastas, modelos de ficha e regras da enciclopédia.', render: () => <EncyclopediaAdmin slug={slug} /> },
          { key: 'sheet', group: 'Conteúdo', title: 'Ficha de personagem', icon: IdCard, keywords: 'campos ficha personagem atributos raça classe', description: 'Campos que todo personagem desta comunidade preenche. Campos numéricos viram atributos.', render: () => <SheetEditor slug={slug} initial={c.sheetFields} /> },
          { key: 'mechanics', group: 'Jogo', title: 'Mecânicas de RPG', icon: Dices, keywords: 'dados rolagem atributos inventário itens', description: 'Ligue o que a comunidade usa: mais regras ou mais literária.', render: () => <MechanicsAdmin slug={slug} /> },
        ];
        const allowed: Record<string, boolean> = {
          appearance: manage,
          sections: perms.has('ArrangeSections'),
          requests: perms.has('ManageMembers'),
          invites: perms.has('CreateInvites'),
          chapters: manage || perms.has('ModerateContent'),
          pins: perms.has('PinPosts'),
          encyclopedia: manage,
          sheet: manage,
          mechanics: manage,
        };
        return (
          <SettingsLayout
            title="Moderação"
            subtitle="Configurações da comunidade"
            pages={pages.filter((p) => allowed[p.key])}
            identity={
              <Pressable accessibilityRole="link" accessibilityLabel={`Abrir ${c.name}`} onPress={() => router.push({ pathname: '/c/[slug]', params: { slug } })}>
                <CommunityCover name={c.name} coverKey={c.coverKey} height={84} />
                <View style={styles.identity}>
                  <View style={styles.identityIcon}>
                    <Avatar name={c.name} imageKey={c.iconKey} size={52} shape="rounded" />
                  </View>
                  <Text style={styles.identityName} numberOfLines={2}>{c.name}</Text>
                </View>
              </Pressable>
            }
          />
        );
      }}
    </Loadable>
  );
}

function JoinRequests({ slug }: { slug: string }) {
  const styles = useStyles();
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
                    <Button title="Aprovar" icon={Check} size="sm" onPress={() => decide.mutate({ id: r.id, approve: true })} />
                    <Button title="Recusar" icon={X} size="sm" variant="ghost" onPress={() => decide.mutate({ id: r.id, approve: false })} />
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
  const styles = useStyles();
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
  const styles = useStyles();
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
    <Section title="Campos da ficha">
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
        <Button title="Adicionar campo" icon={Plus} variant="secondary" onPress={() => setFields((c) => [...c, { key: 'campo', label: '', type: 'Text', required: false }])} />
        {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
        {saved ? <Notice kind="success">Ficha salva.</Notice> : null}
        <Button title="Salvar ficha" onPress={() => save.mutate()} loading={save.isPending} />
      </View>
    </Section>
  );
}

const useStyles = makeStyles((colors) => ({
  identity: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, marginTop: -26, paddingBottom: 6 },
  identityIcon: { borderRadius: 18, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.surface },
  identityName: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text, paddingBottom: 4 },
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
}));
