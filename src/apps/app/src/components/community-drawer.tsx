import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Check, ExternalLink, FolderPlus, Link2, Pencil, PencilLine, Plus, RotateCcw, Share2, Trash2, Users, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { targetHref } from '@/lib/links';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { CommunityCover } from './community';
import { SECTION_INFO, sectionTitle } from './community-admin';
import { LinkPickerModal } from './link-picker';
import { MoreButton, useCopyLink, type MenuItem } from './menu';
import { PromptModal } from './prompt';
import { SortableList } from './sortable';
import { Button, IconButton } from './ui';

type Community = components['schemas']['CommunityDetail'];
type SideMenu = components['schemas']['SideMenuDto'];
type Group = components['schemas']['SideMenuGroupDto'];

/** Opens a link target: internal route or external URL. */
export function useOpenTarget(slug?: string) {
  const router = useRouter();
  return (target: string) => {
    const href = targetHref(target, slug);
    if (!href) return;
    if (typeof href === 'string' && /^https?:/.test(href)) void Linking.openURL(href);
    else router.push(href as Href);
  };
}

/** Opens a community section: the encyclopedia has its own screen; the others are panels of the home. */
export function useOpenSection(slug: string) {
  const router = useRouter();
  return (key: string) =>
    key === 'encyclopedia'
      ? router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug } })
      : router.push({ pathname: '/c/[slug]', params: { slug, tab: key } });
}

/**
 * Amino-like side menu: a discreet bar on the right edge; hovering it slides the menu over the page,
 * with the cover, identity, share, the main sections (renamable/reorderable) and the moderation's link groups.
 */
export function CommunityDrawer({ community: c }: { community: Community }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stay = editing || dialog;
  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(timer.current);
    if (!stay) timer.current = setTimeout(() => setOpen(false), 260);
  };
  const hover = Platform.OS === 'web' ? { onHoverIn: show, onHoverOut: hide } : {};
  // Over the open drawer use DOM mouseenter/leave: Pressable hover breaks over the buttons inside it.
  const mouse = Platform.OS === 'web' ? ({ onMouseEnter: show, onMouseLeave: hide } as object) : {};
  return (
    <>
      <Pressable {...hover} onPress={show} accessibilityRole="button" accessibilityLabel={`Menu de ${c.name}`} style={styles.edge}>
        <View style={styles.edgeGrip} />
      </Pressable>
      {open ? (
        <>
          {stay ? <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}><Pressable style={styles.fill} onPress={() => { setEditing(false); setOpen(false); }} /></Animated.View> : null}
          <Animated.View entering={SlideInRight.duration(280).easing(Easing.out(Easing.cubic))} exiting={SlideOutRight.duration(200).easing(Easing.in(Easing.cubic))} style={styles.drawer}>
            <View {...mouse} style={styles.fill}>
              <DrawerContent community={c} editing={editing} setEditing={setEditing} onDialog={setDialog} onClose={() => { setEditing(false); setOpen(false); }} />
            </View>
          </Animated.View>
        </>
      ) : null}
    </>
  );
}

function DrawerContent({ community: c, editing, setEditing, onDialog, onClose }: { community: Community; editing: boolean; setEditing: (v: boolean) => void; onDialog: (v: boolean) => void; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const copyLink = useCopyLink();
  const openTarget = useOpenTarget(c.slug);
  const openSection = useOpenSection(c.slug);
  const canEdit = (c.me?.permissions ?? []).includes('ArrangeSections');
  const menu = useQuery({ queryKey: ['side-menu', c.slug], queryFn: () => unwrap(api.GET('/communities/{slug}/side-menu', { params: { path: { slug: c.slug } } })) });
  const [prompt, setPrompt] = useState<{ title: string; label: string; initial?: string; submit: string; run: (v: string) => void }>();
  const [picking, setPicking] = useState<number>();
  const save = useMutation({
    mutationFn: (body: SideMenu) => unwrap(api.PUT('/communities/{slug}/side-menu', { params: { path: { slug: c.slug } }, body: { ...body, sectionTitles: body.sectionTitles ?? {} } })),
    onMutate: (body) => {
      queryClient.setQueryData(['side-menu', c.slug], body);
      queryClient.setQueryData<Community>(['community', c.slug], (old) => (old ? { ...old, sections: [...body.sections], sectionTitles: { ...body.sectionTitles } } : old));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['side-menu', c.slug] });
      void queryClient.invalidateQueries({ queryKey: ['community', c.slug] });
    },
  });
  const data: SideMenu = menu.data ?? { sections: c.sections ?? Object.keys(SECTION_INFO), sectionTitles: c.sectionTitles ?? {}, groups: [] };
  const titles = data.sectionTitles ?? {};
  const update = (patch: Partial<SideMenu>) => save.mutate({ ...data, sectionTitles: titles, ...patch });
  const setGroups = (groups: Group[]) => update({ groups });
  const ask = (p: NonNullable<typeof prompt>) => {
    onDialog(true);
    setPrompt(p);
  };
  const closeDialogs = () => {
    onDialog(false);
    setPrompt(undefined);
    setPicking(undefined);
  };
  const go = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      <CommunityCover name={c.name} coverKey={c.coverKey} height={130}>
        <View style={styles.coverTop}>
          <View style={styles.flex} />
          <IconButton icon={X} label="Fechar menu" tone="onImage" size={34} onPress={onClose} />
        </View>
      </CommunityCover>
      <View style={styles.identity}>
        <View style={styles.icon}>
          <Avatar name={c.name} imageKey={c.iconKey} size={64} shape="rounded" />
        </View>
        <Text style={styles.name} numberOfLines={2}>{c.name}</Text>
        <Pressable accessibilityRole="link" onPress={() => go(() => openSection('members'))} style={({ hovered }) => [styles.members, hovered && styles.membersHover]}>
          <Users size={14} color={colors.brand} />
          <Text style={styles.membersText}>{`${c.memberCount} ${c.memberCount === 1 ? 'membro' : 'membros'}`}</Text>
        </Pressable>
        <View style={styles.actions}>
          <Button title="Compartilhar" icon={Share2} size="sm" variant="secondary" onPress={() => void copyLink(`/c/${c.slug}`)} />
          <Button title="Página da comunidade" icon={ExternalLink} size="sm" variant="ghost" onPress={() => go(() => openSection('overview'))} />
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Páginas</Text>
        {canEdit ? (
          <Pressable accessibilityRole="button" onPress={() => setEditing(!editing)} style={({ hovered }) => [styles.editToggle, (hovered || editing) && styles.editToggleOn]}>
            {editing ? <Check size={14} color={colors.brandSoftText} /> : <Pencil size={14} color={colors.textMuted} />}
            <Text style={[styles.editText, editing && styles.editTextOn]}>{editing ? 'Concluir' : 'Editar menu'}</Text>
          </Pressable>
        ) : null}
      </View>
      {editing ? (
        <SortableList
          items={data.sections.filter((k) => SECTION_INFO[k])}
          keyOf={(k) => k}
          onReorder={(sections) => update({ sections })}
          renderItem={(key) => {
            const info = SECTION_INFO[key];
            const items: MenuItem[] = [
              { label: 'Renomear', icon: PencilLine, onPress: () => ask({ title: 'Renomear página', label: 'Nome', initial: sectionTitle({ sectionTitles: titles }, key), submit: 'Salvar', run: (v) => update({ sectionTitles: { ...titles, [key]: v } }) }) },
              { label: 'Voltar ao nome padrão', icon: RotateCcw, hidden: !titles[key], onPress: () => update({ sectionTitles: Object.fromEntries(Object.entries(titles).filter(([k]) => k !== key)) }) },
            ];
            return (
              <View style={styles.pageRow}>
                <View style={styles.pageIcon}><info.icon size={18} color={colors.brandSoftText} /></View>
                <Text style={styles.pageText} numberOfLines={1}>{sectionTitle({ sectionTitles: titles }, key)}</Text>
                <MoreButton items={items} title={info.label} size={30} />
              </View>
            );
          }}
        />
      ) : (
        data.sections.filter((k) => SECTION_INFO[k]).map((key) => {
          const info = SECTION_INFO[key];
          return (
            <Pressable key={key} accessibilityRole="link" onPress={() => go(() => openSection(key))} style={({ hovered }) => [styles.pageRow, styles.pageButton, hovered && styles.pageHover]}>
              <View style={styles.pageIcon}><info.icon size={18} color={colors.brandSoftText} /></View>
              <Text style={styles.pageText} numberOfLines={1}>{sectionTitle({ sectionTitles: titles }, key)}</Text>
            </Pressable>
          );
        })
      )}

      {data.groups.map((g, gi) => {
        const groupMenu: MenuItem[] = [
          { label: 'Adicionar link', icon: Link2, onPress: () => { onDialog(true); setPicking(gi); } },
          { label: 'Renomear grupo', icon: PencilLine, onPress: () => ask({ title: 'Renomear grupo', label: 'Nome do grupo', initial: g.title, submit: 'Salvar', run: (v) => setGroups(data.groups.map((x, i) => (i === gi ? { ...x, title: v } : x))) }) },
          'separator',
          { label: 'Apagar grupo', icon: Trash2, danger: true, onPress: () => setGroups(data.groups.filter((_, i) => i !== gi)) },
        ];
        return (
          <View key={`${g.title}-${gi}`} style={styles.group}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel} numberOfLines={1}>{g.title}</Text>
              {editing ? <MoreButton items={groupMenu} title={g.title} size={28} /> : null}
            </View>
            {editing ? (
              <SortableList
                items={g.links}
                keyOf={(l) => l.target + l.label}
                onReorder={(links) => setGroups(data.groups.map((x, i) => (i === gi ? { ...x, links } : x)))}
                renderItem={(l) => (
                  <View style={styles.linkRow}>
                    <Link2 size={14} color={colors.textSubtle} />
                    <Text style={styles.linkText} numberOfLines={1}>{l.label}</Text>
                    <IconButton icon={Trash2} label={`Remover ${l.label}`} size={28} onPress={() => setGroups(data.groups.map((x, i) => (i === gi ? { ...x, links: x.links.filter((y) => y !== l) } : x)))} />
                  </View>
                )}
              />
            ) : g.links.length ? (
              g.links.map((l) => (
                <Pressable key={l.target + l.label} accessibilityRole="link" onPress={() => go(() => openTarget(l.target))} style={({ hovered }) => [styles.linkRow, hovered && styles.pageHover]}>
                  <Link2 size={14} color={colors.brand} />
                  <Text style={styles.linkText} numberOfLines={1}>{l.label}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyGroup}>Nenhum link ainda.</Text>
            )}
            {editing ? <Button title="Adicionar link" icon={Plus} size="sm" variant="ghost" onPress={() => { onDialog(true); setPicking(gi); }} /> : null}
          </View>
        );
      })}
      {editing ? (
        <View style={styles.newGroup}>
          <Button title="Novo grupo de links" icon={FolderPlus} size="sm" variant="secondary" onPress={() => ask({ title: 'Novo grupo', label: 'Nome do grupo (ex.: Guias, Eventos)', submit: 'Criar', run: (v) => setGroups([...data.groups, { title: v, links: [] }]) })} />
          <Text style={styles.hint}>Arraste pela alça para reordenar. Os links podem apontar para qualquer coisa da comunidade.</Text>
        </View>
      ) : null}

      {prompt ? (
        <PromptModal
          title={prompt.title}
          label={prompt.label}
          initial={prompt.initial}
          submitLabel={prompt.submit}
          onClose={closeDialogs}
          onSubmit={async (v) => {
            if (v.length > 40) return 'Use até 40 caracteres.';
            prompt.run(v);
          }}
        />
      ) : null}
      {picking !== undefined ? (
        <LinkPickerModal
          slug={c.slug}
          onClose={closeDialogs}
          onPick={(label, target) => {
            setGroups(data.groups.map((x, i) => (i === picking ? { ...x, links: [...x.links, { label: label.slice(0, 60), target }] } : x)));
            closeDialogs();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  fill: { flex: 1 },
  edge: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 14, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  edgeGrip: { width: 4, height: 72, borderRadius: 2, backgroundColor: colors.brand, opacity: 0.35, ...(Platform.OS === 'web' ? ({ transition: 'opacity 200ms ease, height 200ms ease' } as object) : null) },
  scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay, zIndex: 44 },
  drawer: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 340, backgroundColor: colors.surface, borderLeftWidth: 1, borderLeftColor: colors.border, zIndex: 45, ...shadow(colors, 3) },
  content: { paddingBottom: 40 },
  coverTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row' },
  identity: { paddingHorizontal: 18, gap: 6, marginTop: -34 },
  icon: { alignSelf: 'flex-start', borderRadius: 22, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surface },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  members: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2, borderRadius: radius.sm },
  membersHover: { opacity: 0.75 },
  membersText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 },
  sectionLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.7 },
  editToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  editToggleOn: { backgroundColor: colors.brandSoft },
  editText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  editTextOn: { color: colors.brandSoftText },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 9 },
  pageButton: { marginHorizontal: 8, paddingHorizontal: 10, borderRadius: radius.md },
  pageHover: { backgroundColor: colors.surfaceAlt },
  pageIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  pageText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  group: { gap: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm },
  linkText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  emptyGroup: { fontSize: 13, color: colors.textSubtle, paddingHorizontal: 20 },
  newGroup: { paddingHorizontal: 18, paddingTop: 16, gap: 8, alignItems: 'flex-start' },
  hint: { fontSize: 12, color: colors.textSubtle, lineHeight: 17 },
}));
