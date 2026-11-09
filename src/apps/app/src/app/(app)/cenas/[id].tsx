import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageBackground } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PanelLeft, Search, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { IconButton, Notice } from '@/components/ui';
import { Composer } from '@/features/scene/composer';
import { MessageBubble } from '@/features/scene/message-bubble';
import { SceneSidebar } from '@/features/scene/scene-sidebar';
import type { SceneAction } from '@/features/scene/types';
import { resolveBackground } from '@/lib/backgrounds';
import { fileUrl } from '@/lib/files';
import { useSceneRealtime } from '@/realtime/use-scene-realtime';
import { makeStyles, useTheme } from '@/theme';

const WIDE_BREAKPOINT = 860;

/** Scene as a full-screen chat: sidebar (~1/3) with scene info and members, chat (~2/3) with the messages. */
export default function SceneScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [term, setTerm] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);
  const sceneKey = ['scene', id];
  const actionsKey = ['scene-actions', id];

  const scene = useQuery({ queryKey: sceneKey, queryFn: () => unwrap(api.GET('/scenes/{id}', { params: { path: { id } } }), 'Cena não encontrada.') });
  const actions = useQuery({
    queryKey: actionsKey,
    queryFn: () => unwrap(api.GET('/scenes/{id}/actions', { params: { path: { id }, query: { limit: 200 } } })),
  });
  const me = useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
  const slug = scene.data?.communitySlug;
  const myCharacters = useQuery({
    queryKey: ['characters', slug, 'mine'],
    enabled: !!slug,
    queryFn: () => unwrap(api.GET('/communities/{slug}/characters', { params: { path: { slug: slug! }, query: { mine: true } } })),
  });
  const community = useQuery({
    queryKey: ['community', slug],
    enabled: !!slug,
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug: slug! } } })),
  });

  const setActions = (fn: (list: SceneAction[]) => SceneAction[]) => queryClient.setQueryData<SceneAction[]>(actionsKey, (list) => fn(list ?? []));
  const upsert = (a: SceneAction) => setActions((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]));

  const realtime = useSceneRealtime(id, {
    onActionCreated: upsert,
    onActionUpdated: upsert,
    onActionDeleted: (actionId) => setActions((list) => list.map((x) => (x.id === actionId ? { ...x, deleted: true, content: null, attachmentKey: null } : x))),
    onParticipantJoined: () => queryClient.invalidateQueries({ queryKey: sceneKey }),
    onSceneClosed: () => queryClient.invalidateQueries({ queryKey: sceneKey }),
    onSceneUpdated: () => queryClient.invalidateQueries({ queryKey: sceneKey }),
    onTurnChanged: () => queryClient.invalidateQueries({ queryKey: sceneKey }),
  });

  // Keep the newest message in view.
  const count = actions.data?.length ?? 0;
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: count > 0 }), 50);
    return () => clearTimeout(t);
  }, [count]);

  if (scene.isPending) return <ActivityIndicator style={styles.loading} color={colors.brand} />;
  if (scene.isError || !scene.data) {
    return (
      <View style={styles.errorBox}>
        <Notice kind="error">{scene.error?.message ?? 'Cena não encontrada.'}</Notice>
      </View>
    );
  }

  const s = scene.data;
  const bg = resolveBackground(s.background);
  const joinedCharacters = (myCharacters.data ?? []).filter((c) => s.participants.some((p) => p.characterId === c.id));
  const turns = s.writingMode === 'Turns';
  // In turns, only the character whose turn it is can write.
  const writable = turns ? joinedCharacters.filter((c) => c.id === s.currentTurnCharacterId) : joinedCharacters;
  const turnName = s.participants.find((p) => p.characterId === s.currentTurnCharacterId)?.characterName;
  const sidebar = (
    <SceneSidebar scene={s} online={realtime.online} myCharacters={myCharacters.data} myUserId={me.data?.id} onClose={wide ? undefined : () => setDrawerOpen(false)} />
  );

  const all = actions.data ?? [];
  const q = term.trim().toLocaleLowerCase('pt-BR');
  const list = q ? all.filter((a) => !a.deleted && `${a.characterName} ${a.content ?? ''}`.toLocaleLowerCase('pt-BR').includes(q)) : all;
  const chat = (
    <View style={styles.chat}>
      <View style={styles.chatHeader}>
        {!wide ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir painel da cena" onPress={() => setDrawerOpen(true)} hitSlop={8} style={styles.menuButton}>
            <PanelLeft size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.chatTitle} numberOfLines={1}>{s.title}</Text>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            {realtime.connected ? `${realtime.online.length} online · ${s.participants.length} na cena` : 'Conectando…'}
            {turns ? ` · ${turnName ? `vez de ${turnName}` : 'por turnos'}` : ''}
          </Text>
        </View>
        <IconButton
          icon={searching ? X : Search}
          label={searching ? 'Fechar busca' : 'Buscar mensagens'}
          size={36}
          onPress={() => {
            setSearching((v) => !v);
            setTerm('');
          }}
        />
      </View>
      {searching ? (
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSubtle} />
          <TextInput autoFocus value={term} onChangeText={setTerm} placeholder="Buscar nas mensagens da cena" placeholderTextColor={colors.textSubtle} style={styles.searchInput} accessibilityLabel="Buscar nas mensagens" />
          {q ? <Text style={styles.searchCount}>{list.length === 1 ? '1 resultado' : `${list.length} resultados`}</Text> : null}
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {actions.isPending ? <ActivityIndicator color={bg.dark ? '#FFFFFF' : colors.brand} style={styles.loading} /> : null}
        {!actions.isPending && list.length === 0 ? (
          <Text style={[styles.empty, bg.dark && styles.onDark]}>{q ? 'Nenhuma mensagem encontrada.' : 'Nenhuma ação ainda. Comece a história!'}</Text>
        ) : null}
        {list.map((a, i) => (
          <MessageBubble
            key={a.id}
            action={a}
            scene={s}
            mine={a.authorUserId === me.data?.id}
            grouped={i > 0 && list[i - 1].characterId === a.characterId && !list[i - 1].deleted}
            onChanged={upsert}
          />
        ))}
        {realtime.typingNames.length > 0 ? (
          <View style={styles.typing}>
            <Text style={styles.typingText}>
              {realtime.typingNames.join(', ')} {realtime.typingNames.length === 1 ? 'está' : 'estão'} escrevendo…
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {s.status !== 'Open' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Esta cena foi encerrada. As ações ficam salvas para leitura.</Text>
        </View>
      ) : writable.length > 0 ? (
        <Composer
          sceneId={s.id}
          characters={writable}
          onTyping={realtime.notifyTyping}
          onSent={upsert}
          diceEnabled={!!community.data?.mechanics?.diceEnabled}
          attributesEnabled={!!community.data?.mechanics?.attributesEnabled}
        />
      ) : joinedCharacters.length > 0 ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{turnName ? `Aguarde: é a vez de ${turnName}.` : 'Aguardando a ordem dos turnos.'}</Text>
        </View>
      ) : (
        <Pressable style={styles.banner} onPress={() => !wide && setDrawerOpen(true)} accessibilityRole="button">
          <Text style={styles.bannerText}>
            {s.canJoin ? 'Entre na cena com um dos seus personagens (no painel ao lado) para escrever.' : 'Você não pode entrar nesta cena.'}
          </Text>
        </Pressable>
      )}
    </View>
  );

  const background = bg.imageKey ? (
    <ImageBackground source={{ uri: fileUrl(bg.imageKey) }} style={styles.fill} contentFit="cover">
      {chat}
    </ImageBackground>
  ) : (
    <View style={[styles.fill, { backgroundColor: bg.color }]}>{chat}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {wide ? <View style={[styles.sidebarColumn, { width: Math.max(300, Math.min(width * 0.32, 440)) }]}>{sidebar}</View> : null}
      <View style={styles.fill}>{background}</View>
      {!wide && drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <View style={[styles.drawer, { width: Math.min(width * 0.86, 380) }]}>{sidebar}</View>
          <Pressable style={styles.fill} onPress={() => setDrawerOpen(false)} accessibilityLabel="Fechar painel" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.surface },
  fill: { flex: 1 },
  loading: { marginTop: 40 },
  errorBox: { padding: 24 },
  sidebarColumn: { borderRightWidth: 1, borderRightColor: colors.border },
  chat: { flex: 1 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuButton: { padding: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 6 },
  searchCount: { fontSize: 12, fontWeight: '600', color: colors.textSubtle },
  headerText: { flex: 1 },
  chatTitle: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  chatSubtitle: { fontSize: 12, color: colors.textMuted },
  messages: { flex: 1 },
  messagesContent: { paddingVertical: 12, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15, color: colors.textMuted },
  onDark: { color: 'rgba(255,255,255,0.8)' },
  typing: { alignSelf: 'flex-start', marginLeft: 62, marginTop: 10, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  typingText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  banner: { padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  bannerText: { textAlign: 'center', fontSize: 14, color: colors.textMuted },
  drawerOverlay: { ...StyleSheet.absoluteFill, flexDirection: 'row', backgroundColor: colors.overlay },
  drawer: { height: '100%', backgroundColor: colors.surface },
}));
