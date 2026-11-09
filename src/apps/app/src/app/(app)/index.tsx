import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowDown, ArrowRight, ArrowUp, BookMarked, Compass, Eye, EyeOff, Link2, NotebookPen, Plus, Radio, Reply, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { api } from '@/api/client';
import { labels, unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { CardGrid, CommunityCard } from '@/components/community';
import { useCommunityMenu } from '@/components/community-menu';
import { Carousel, ChapterCard, EntryTile, FeedSection, SceneCard, SeeAllModal } from '@/components/feed';
import { Empty, Page, Skeleton, Tag } from '@/components/layout';
import { useCopyLink, type MenuItem } from '@/components/menu';
import { useQuickSwitcher } from '@/components/quick-switcher';
import { Button, IconButton } from '@/components/ui';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

type Home = components['schemas']['HomeDto'];
type SectionKey = 'chapters' | 'scenes' | 'encyclopedia' | 'communities';

const SECTION_INFO: Record<SectionKey, { title: string; icon: typeof Sparkles; hint: string }> = {
  chapters: { title: 'Últimos capítulos', icon: NotebookPen, hint: 'Carrossel com o que acabou de ser publicado nas suas comunidades' },
  scenes: { title: 'Cenas ao vivo', icon: Radio, hint: 'Cenas abertas agora, para entrar ou acompanhar' },
  encyclopedia: { title: 'Da enciclopédia', icon: BookMarked, hint: 'Miniaturas de fichas e personagens recentes' },
  communities: { title: 'Minhas comunidades', icon: Sparkles, hint: 'Atalhos para as comunidades em que você está' },
};

/** Start screen (Amino/Instagram-like feed): the user picks which sections show up and in what order. */
export default function HomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const openSearch = useQuickSwitcher();
  const copyLink = useCopyLink();
  const communityMenu = useCommunityMenu();
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const home = useQuery({ queryKey: ['home'], queryFn: () => unwrap(api.GET('/me/home', { params: { query: { take: 12 } } })) });
  const all = useQuery({ queryKey: ['home', 'all'], enabled: false, queryFn: () => unwrap(api.GET('/me/home', { params: { query: { take: 60 } } })) });
  const mine = useQuery({ queryKey: ['my-communities'], queryFn: () => unwrap(api.GET('/me/communities')) });
  const [seeAll, setSeeAll] = useState<SectionKey>();
  const [customizing, setCustomizing] = useState(false);
  const firstName = me.data?.displayName.split(' ')[0];

  const openAll = (key: SectionKey) => {
    setSeeAll(key);
    void all.refetch();
  };

  const chapterMenu = (c: Home['chapters'][number]): MenuItem[] => [
    { label: 'Ler capítulo', icon: ArrowRight, onPress: () => router.push({ pathname: '/capitulos/[id]', params: { id: c.id } }) },
    { label: 'Responder com um capítulo', icon: Reply, onPress: () => router.push({ pathname: '/c/[slug]/capitulos/novo', params: { slug: c.communitySlug, replyTo: c.id, mention: c.characterId } }) },
    { label: 'Abrir a comunidade', icon: Compass, onPress: () => router.push({ pathname: '/c/[slug]', params: { slug: c.communitySlug } }) },
    'separator',
    { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/capitulos/${c.id}`) },
  ];
  const sceneMenu = (s: Home['scenes'][number]): MenuItem[] => [
    { label: 'Abrir cena', icon: ArrowRight, onPress: () => router.push({ pathname: '/cenas/[id]', params: { id: s.id } }) },
    { label: 'Abrir a comunidade', icon: Compass, onPress: () => router.push({ pathname: '/c/[slug]', params: { slug: s.communitySlug } }) },
    'separator',
    { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/cenas/${s.id}`) },
  ];
  const entryHref = (e: Home['entries'][number]) => (e.isCharacter ? `/personagens/${e.id}` : `/fichas/${e.id}`);
  const openEntry = (e: Home['entries'][number]) =>
    e.isCharacter ? router.push({ pathname: '/personagens/[id]', params: { id: e.id } }) : router.push({ pathname: '/fichas/[id]', params: { id: e.id } });
  const entryMenu = (e: Home['entries'][number]): MenuItem[] => [
    { label: 'Abrir ficha', icon: ArrowRight, onPress: () => openEntry(e) },
    { label: 'Abrir a enciclopédia', icon: BookMarked, onPress: () => router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug: e.communitySlug } }) },
    'separator',
    { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(entryHref(e)) },
  ];

  const chapterCard = (c: Home['chapters'][number]) => (
    <ChapterCard
      chapter={c}
      community={{ name: c.communityName, iconKey: c.communityIconKey }}
      menu={chapterMenu(c)}
      onPress={() => router.push({ pathname: '/capitulos/[id]', params: { id: c.id } })}
    />
  );
  const sceneCard = (s: Home['scenes'][number]) => (
    <SceneCard scene={s} community={{ name: s.communityName, iconKey: s.communityIconKey }} menu={sceneMenu(s)} onPress={() => router.push({ pathname: '/cenas/[id]', params: { id: s.id } })} />
  );
  const entryTile = (e: Home['entries'][number]) => <EntryTile entry={e} menu={entryMenu(e)} onPress={() => openEntry(e)} />;

  const renderSection = (key: SectionKey, data: Home) => {
    const info = SECTION_INFO[key];
    switch (key) {
      case 'chapters':
        return (
          <FeedSection key={key} title={info.title} icon={info.icon} onSeeAll={data.chapters.length ? () => openAll(key) : undefined}>
            {data.chapters.length ? <Carousel itemWidth={290}>{data.chapters.map(chapterCard)}</Carousel> : <Empty icon={NotebookPen}>Nenhum capítulo publicado ainda nas suas comunidades.</Empty>}
          </FeedSection>
        );
      case 'scenes':
        return (
          <FeedSection key={key} title={info.title} icon={info.icon} onSeeAll={data.scenes.length ? () => openAll(key) : undefined}>
            {data.scenes.length ? <Carousel itemWidth={230}>{data.scenes.map(sceneCard)}</Carousel> : <Empty icon={Radio}>Nenhuma cena aberta agora.</Empty>}
          </FeedSection>
        );
      case 'encyclopedia':
        return (
          <FeedSection key={key} title={info.title} icon={info.icon} onSeeAll={data.entries.length ? () => openAll(key) : undefined}>
            {data.entries.length ? <Carousel itemWidth={132}>{data.entries.map(entryTile)}</Carousel> : <Empty icon={BookMarked}>As fichas das suas comunidades aparecem aqui.</Empty>}
          </FeedSection>
        );
      case 'communities':
        return (
          <FeedSection
            key={key}
            title={info.title}
            icon={info.icon}
            actions={
              <View style={styles.inline}>
                <Button title="Criar" icon={Plus} size="sm" variant="secondary" onPress={() => router.push('/comunidades/nova')} />
                <Button title="Descobrir" icon={Compass} size="sm" variant="ghost" onPress={() => router.push('/descobrir')} />
              </View>
            }>
            {(mine.data ?? []).length === 0 ? (
              <Empty icon={Compass}>Você ainda não participa de nenhuma comunidade. Crie a sua ou descubra uma para entrar.</Empty>
            ) : (
              <CardGrid>
                {mine.data!.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    menu={communityMenu(c)}
                    right={c.joinPolicy !== 'Open' ? <Tag label={labels.joinPolicy[c.joinPolicy]} tone="neutral" /> : undefined}
                    onPress={() => router.push({ pathname: '/c/[slug]', params: { slug: c.slug } })}
                  />
                ))}
              </CardGrid>
            )}
          </FeedSection>
        );
    }
  };

  const allData = all.data;
  return (
    <Page
      title={firstName ? `Olá, ${firstName}` : 'Bookollab'}
      subtitle="Para onde a história vai hoje?"
      actions={
        <View style={styles.inline}>
          <IconButton icon={Search} label="Buscar (Ctrl+K)" onPress={openSearch} />
          <IconButton icon={SlidersHorizontal} label="Personalizar a tela inicial" onPress={() => setCustomizing(true)} />
        </View>
      }>
      {home.data ? (
        (home.data.sections as SectionKey[]).map((key) => renderSection(key, home.data!))
      ) : (
        <View style={styles.loading}>
          <Skeleton height={22} width={200} />
          <View style={styles.inline}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={200} width={260} />
            ))}
          </View>
        </View>
      )}

      <SeeAllModal title={seeAll ? SECTION_INFO[seeAll].title : ''} visible={!!seeAll} onClose={() => setSeeAll(undefined)} minItemWidth={seeAll === 'encyclopedia' ? 130 : 260}>
        {!allData
          ? []
          : seeAll === 'chapters'
            ? allData.chapters.map(chapterCard)
            : seeAll === 'scenes'
              ? allData.scenes.map(sceneCard)
              : seeAll === 'encyclopedia'
                ? allData.entries.map(entryTile)
                : []}
      </SeeAllModal>
      {customizing && home.data ? <CustomizeHome current={home.data.sections as SectionKey[]} onClose={() => setCustomizing(false)} /> : null}
    </Page>
  );
}

/** Choose and order the start-screen sections (saved on the account, follows the user to other devices). */
function CustomizeHome({ current, onClose }: { current: SectionKey[]; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<SectionKey[]>([...current, ...(Object.keys(SECTION_INFO) as SectionKey[]).filter((k) => !current.includes(k))]);
  const [visible, setVisible] = useState<Set<SectionKey>>(new Set(current));
  const save = useMutation({
    mutationFn: () => unwrap(api.PUT('/me/home-sections', { body: { sections: order.filter((k) => visible.has(k)) } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      onClose();
    },
  });
  const move = (i: number, d: number) => setOrder((o) => {
    const next = [...o];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalLayer}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Personalizar a tela inicial</Text>
            <IconButton icon={X} label="Fechar" size={36} onPress={onClose} />
          </View>
          <Text style={styles.modalHint}>Escolha o que aparece e em que ordem. Vale para a sua conta em qualquer aparelho.</Text>
          {order.map((key, i) => {
            const info = SECTION_INFO[key];
            const on = visible.has(key);
            return (
              <View key={key} style={[styles.option, !on && styles.optionOff]}>
                <info.icon size={18} color={on ? colors.brand : colors.textSubtle} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{info.title}</Text>
                  <Text style={styles.optionHint} numberOfLines={2}>{info.hint}</Text>
                </View>
                <IconButton icon={on ? Eye : EyeOff} label={on ? `Ocultar ${info.title}` : `Mostrar ${info.title}`} size={34} onPress={() => setVisible((v) => {
                  const next = new Set(v);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })} />
                <IconButton icon={ArrowUp} label={`Subir ${info.title}`} size={34} onPress={() => i > 0 && move(i, -1)} />
                <IconButton icon={ArrowDown} label={`Descer ${info.title}`} size={34} onPress={() => i < order.length - 1 && move(i, 1)} />
              </View>
            );
          })}
          <View style={styles.modalActions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} />
            <Button title="Salvar" onPress={() => save.mutate()} loading={save.isPending} disabled={visible.size === 0} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  loading: { gap: 14 },
  modalLayer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  modal: { width: '100%', maxWidth: 520, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 10, ...shadow(colors, 3) },
  modalHeader: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  modalHint: { fontSize: 14, color: colors.textMuted, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  optionOff: { opacity: 0.55 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionHint: { fontSize: 12, color: colors.textSubtle },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
}));
