import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Backpack, ImagePlus, Link2, Minus, Pencil, Plus, Save, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { fileUrl, pickAndUploadImage } from '@/lib/files';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { LinkPickerModal } from './link-picker';
import { NameChip } from './links';
import { BackgroundLayer, BackgroundPicker, type PageBackground } from './page-background';
import { imageMarkup, RichText } from './rich-text';
import { Button, Field, Notice } from './ui';

type Page = components['schemas']['PageDto'];
const IMAGE_LINE = /!\[[^\]]*\]\(([^)\s]+)\)/g;

/** Every image of a sheet: the main one plus those placed in its text (they rotate in the header). */
export function sheetImages(mainKey: string | null | undefined, content: string | null | undefined): string[] {
  const keys = [...(content ?? '').matchAll(IMAGE_LINE)].map((m) => m[1]);
  return [...new Set([mainKey, ...keys].filter((k): k is string => !!k))];
}

/**
 * Header of a sheet: a slideshow of all its images behind (crossfade every 8 s), the main image centered
 * on top, then the name and kind.
 */
export function SheetHero({ name, kind, imageKey, images, actions }: { name: string; kind: string; imageKey?: string | null; images: string[]; actions?: ReactNode }) {
  const styles = useStyles();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), 8000);
    return () => clearInterval(t);
  }, [images.length]);
  const current = images[index % Math.max(1, images.length)];
  return (
    <View style={styles.hero}>
      <View style={styles.slides}>
        {current ? (
          <Animated.View key={current} entering={FadeIn.duration(1200).easing(Easing.inOut(Easing.quad))} exiting={FadeOut.duration(1200)} style={StyleSheet.absoluteFill}>
            <Image source={{ uri: fileUrl(current) }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={6} />
          </Animated.View>
        ) : null}
        <View style={styles.slidesShade} />
        {images.length > 1 ? (
          <View style={styles.slideDots}>
            {images.map((k, i) => (
              <View key={k} style={[styles.slideDot, i === index % images.length && styles.slideDotOn]} />
            ))}
          </View>
        ) : null}
        {actions ? <View style={styles.heroActions}>{actions}</View> : null}
      </View>
      <View style={styles.portrait}>
        <Avatar name={name} imageKey={imageKey} size={156} shape="rounded" />
      </View>
      <Text style={styles.kind}>{kind}</Text>
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}

/** The sheet's data as a receipt-like header: label … value lines, then the text below. */
export function ReceiptFields({ fields }: { fields: { label: string; value?: string | null; long?: boolean }[] }) {
  const styles = useStyles();
  const short = fields.filter((f) => !f.long);
  const long = fields.filter((f) => f.long && f.value);
  if (!fields.length) return null;
  return (
    <View style={styles.receipt}>
      {short.map((f) => (
        <View key={f.label} style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>{f.label}</Text>
          <View style={styles.receiptLeader} />
          <Text style={[styles.receiptValue, !f.value && styles.receiptEmpty]} numberOfLines={2}>{f.value || '—'}</Text>
        </View>
      ))}
      {long.map((f) => (
        <View key={f.label} style={styles.receiptLong}>
          <Text style={styles.receiptLabel}>{f.label}</Text>
          <Text style={styles.receiptLongValue}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Page body (like a post): read it, or edit the text, inline images and background (owner/moderation). */
export function SheetContent({ page, slug, onSave, children }: { page: Page; slug: string; onSave: (p: { content: string; background: PageBackground }) => Promise<void>; children?: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(page.content ?? '');
  const [background, setBackground] = useState<PageBackground>({ imageKey: page.backgroundKey ?? null, color: page.backgroundColor ?? null, blur: page.backgroundBlur ?? 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function insertImage() {
    const key = await pickAndUploadImage({ aspect: 16 / 9, title: 'Ajustar imagem' });
    if (key) setContent((t) => `${t.trimEnd()}${t ? '\n\n' : ''}${imageMarkup(key)}\n\n`);
  }
  if (editing)
    return (
      <View style={styles.paper}>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <View style={styles.editBar}>
          <Button title="Imagem no texto" icon={ImagePlus} size="sm" variant="ghost" onPress={() => void insertImage()} />
          <Text style={styles.editHint}>As imagens do texto também passam no topo da ficha.</Text>
        </View>
        <TextInput value={content} onChangeText={setContent} multiline placeholder="A história, a descrição, os segredos…" placeholderTextColor={colors.textSubtle} style={styles.editor} accessibilityLabel="Texto da ficha" />
        <Text style={styles.editLabel}>Fundo da página</Text>
        <BackgroundPicker value={background} onChange={setBackground} />
        <View style={styles.editActions}>
          <Button title="Cancelar" icon={X} size="sm" variant="ghost" onPress={() => setEditing(false)} />
          <Button
            title="Salvar"
            icon={Save}
            size="sm"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(undefined);
              try {
                await onSave({ content, background });
                setEditing(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      </View>
    );
  return (
    <View style={styles.paper}>
      {children}
      {page.content ? (
        <RichText content={page.content} textStyle={styles.body} slug={slug} />
      ) : (
        <Text style={styles.emptyText}>{page.canEdit ? 'Esta ficha ainda não tem texto. Conte a história dela.' : 'Esta ficha ainda não tem texto.'}</Text>
      )}
      {page.canEdit ? (
        <View style={styles.editRow}>
          <Button title={page.content ? 'Editar texto e fundo' : 'Escrever o texto'} icon={Pencil} size="sm" variant="secondary" onPress={() => setEditing(true)} />
        </View>
      ) : null}
    </View>
  );
}

/** Wraps a sheet screen with its page background (image with blur, or color). */
export function SheetBackdrop({ page, children }: { page?: Page | null; children: ReactNode }) {
  const styles = useStyles();
  const has = !!page?.backgroundKey || !!page?.backgroundColor;
  return has ? (
    <View style={styles.flex}>
      <BackgroundLayer value={{ imageKey: page!.backgroundKey ?? null, color: page!.backgroundColor ?? null, blur: page!.backgroundBlur ?? 0 }} />
      {children}
    </View>
  ) : (
    <>{children}</>
  );
}

/** Footer of a sheet: community and author, quietly at the bottom. */
export function SheetFooter({ slug, communityName, ownerUserName }: { slug: string; communityName: string; ownerUserName: string }) {
  const styles = useStyles();
  return (
    <View style={styles.footer}>
      <NameChip label={communityName} href={{ pathname: '/c/[slug]', params: { slug } }} />
      <Text style={styles.footerText}>{'criada por '}</Text>
      <NameChip label={`@${ownerUserName}`} href={{ pathname: '/c/[slug]/membros/[userName]', params: { slug, userName: ownerUserName } }} />
    </View>
  );
}

/**
 * Inventory as a chest: closed by default; opening shakes the chest and spills the items. Items can be
 * linked to encyclopedia sheets. The moderation (ManageCharacters) gives and takes items.
 */
export function InventoryChest({ characterId, slug, label }: { characterId: string; slug: string; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = ['character-mechanics', characterId];
  const data = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/characters/{id}/mechanics', { params: { path: { id: characterId } } })) });
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [linked, setLinked] = useState<{ id: string; label: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const shake = useSharedValue(0);
  const lid = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.get()}deg` }] }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: () => unwrap(api.POST('/characters/{id}/inventory', { params: { path: { id: characterId } }, body: { name: name.trim() || linked?.label || '', quantity: Number(quantity) || 1, description: null, linkedSheetId: linked?.id ?? null } })),
    onSuccess: () => {
      setName('');
      setQuantity('1');
      setLinked(null);
      setAdding(false);
      void refresh();
    },
  });
  const change = useMutation({
    mutationFn: (i: { id: string; name: string; quantity: number; description?: string | null; linkedSheetId?: string | null }) =>
      i.quantity <= 0
        ? unwrap(api.DELETE('/inventory-items/{id}', { params: { path: { id: i.id } } }))
        : unwrap(api.PUT('/inventory-items/{id}', { params: { path: { id: i.id } }, body: { name: i.name, quantity: i.quantity, description: i.description ?? null, linkedSheetId: i.linkedSheetId ?? null } })),
    onSuccess: () => void refresh(),
  });
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    shake.set(withSequence(withTiming(-14, { duration: 90 }), withTiming(12, { duration: 110 }), withTiming(-6, { duration: 100 }), withSpring(0, { damping: 8 })));
  }, [open, shake]);
  const d = data.data;
  if (!d?.mechanics.inventoryEnabled) return null;
  const count = d.inventory.reduce((n, i) => n + i.quantity, 0);
  return (
    <View style={styles.chest}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={({ hovered }) => [styles.chestHead, hovered && styles.chestHeadHover]}>
        <Animated.View style={[styles.chestIcon, open && styles.chestIconOpen, lid]}>
          <Backpack size={26} color={open ? colors.brandText : colors.brand} strokeWidth={2.2} />
        </Animated.View>
        <View style={styles.flex}>
          <Text style={styles.chestTitle}>{label}</Text>
          <Text style={styles.chestHint}>{open ? 'Clique para guardar' : count ? `${count} ${count === 1 ? 'item' : 'itens'} · clique para abrir` : 'Vazio · clique para abrir'}</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.items}>
          {d.inventory.length === 0 ? <Text style={styles.emptyText}>Nada aqui ainda.</Text> : null}
          {d.inventory.map((i, n) => (
            <Animated.View key={i.id} entering={FadeInDown.delay(n * 60).springify().damping(15)} style={styles.item}>
              <Pressable disabled={!i.linkedSheetId} onPress={() => i.linkedSheetId && router.push({ pathname: '/fichas/[id]', params: { id: i.linkedSheetId } })} style={styles.itemMain}>
                {i.linkedSheetId ? <Avatar name={i.linkedSheetName ?? i.name} imageKey={i.linkedSheetImageKey} size={38} shape="rounded" /> : <View style={styles.itemIcon}><Backpack size={16} color={colors.textMuted} /></View>}
                <View style={styles.flex}>
                  <Text style={styles.itemName}>{`${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`}</Text>
                  {i.linkedSheetId ? <Text style={styles.itemLink}>{`Ficha: ${i.linkedSheetName}`}</Text> : null}
                </View>
              </Pressable>
              {d.canManageInventory ? (
                <View style={styles.stepper}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Tirar um ${i.name}`} onPress={() => change.mutate({ ...i, quantity: i.quantity - 1 })} style={styles.step}><Minus size={14} color={colors.text} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Dar mais um ${i.name}`} onPress={() => change.mutate({ ...i, quantity: i.quantity + 1 })} style={styles.step}><Plus size={14} color={colors.text} /></Pressable>
                </View>
              ) : null}
            </Animated.View>
          ))}
          {d.canManageInventory ? (
            adding ? (
              <View style={styles.addBox}>
                {add.isError ? <Notice kind="error">{add.error.message}</Notice> : null}
                <Field label="Item" value={name} onChangeText={setName} placeholder={linked?.label ?? 'Ex.: Poção de cura'} />
                <Field label="Quantidade" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
                <Button title={linked ? `Ficha: ${linked.label}` : 'Ligar a uma ficha (opcional)'} icon={Link2} size="sm" variant="ghost" onPress={() => setPicking(true)} />
                <View style={styles.editActions}>
                  <Button title="Cancelar" size="sm" variant="ghost" onPress={() => setAdding(false)} />
                  <Button title="Guardar no inventário" size="sm" loading={add.isPending} disabled={!name.trim() && !linked} onPress={() => add.mutate()} />
                </View>
              </View>
            ) : (
              <Button title="Dar um item" icon={Plus} size="sm" variant="secondary" onPress={() => setAdding(true)} />
            )
          ) : null}
        </View>
      ) : null}
      {picking ? (
        <LinkPickerModal
          slug={slug}
          title="Ligar a uma ficha"
          onClose={() => setPicking(false)}
          onPick={(label, target) => {
            if (target.startsWith('sheet:')) setLinked({ id: target.slice(6), label });
            setPicking(false);
          }}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  hero: { alignItems: 'center', marginBottom: 8 },
  slides: { width: '100%', height: 260, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.brand },
  slidesShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' },
  slideDots: { position: 'absolute', bottom: 12, right: 16, flexDirection: 'row', gap: 5 },
  slideDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  slideDotOn: { width: 16, backgroundColor: '#FFFFFF' },
  heroActions: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', gap: 8 },
  portrait: { marginTop: -96, borderRadius: 48, borderWidth: 5, borderColor: colors.background, backgroundColor: colors.background, ...shadow(colors, 3) },
  kind: { marginTop: 12, fontSize: 12, fontWeight: '800', color: colors.brand, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontSize: 34, lineHeight: 40, color: colors.text, fontFamily: 'Literata_600SemiBold', textAlign: 'center' },
  receipt: { alignSelf: 'center', width: '100%', maxWidth: 560, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, paddingHorizontal: 22, paddingVertical: 16, gap: 8 },
  receiptRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  receiptLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  receiptLeader: { flex: 1, borderBottomWidth: 1.5, borderStyle: 'dotted', borderColor: colors.borderStrong, marginBottom: 4 },
  receiptValue: { maxWidth: '60%', fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'right' },
  receiptEmpty: { color: colors.textSubtle },
  receiptLong: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: colors.border },
  receiptLongValue: { fontSize: 15, color: colors.text, lineHeight: 22 },
  paper: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 28, paddingHorizontal: 32, gap: 16 },
  body: { fontSize: 18, lineHeight: 31, color: colors.text, fontFamily: 'Literata_400Regular' },
  emptyText: { fontSize: 15, color: colors.textSubtle },
  editRow: { flexDirection: 'row' },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  editHint: { fontSize: 12, color: colors.textSubtle },
  editor: { minHeight: 320, fontSize: 17, lineHeight: 29, color: colors.text, fontFamily: 'Literata_400Regular', textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14 },
  editLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { fontSize: 12, color: colors.textSubtle },
  chest: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  chestHead: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  chestHeadHover: { backgroundColor: colors.surfaceAlt },
  chestIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  chestIconOpen: { backgroundColor: colors.brand },
  chestTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chestHint: { fontSize: 13, color: colors.textMuted },
  items: { padding: 14, paddingTop: 0, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemLink: { fontSize: 12, color: colors.brand },
  stepper: { flexDirection: 'row', gap: 6 },
  step: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  addBox: { gap: 8, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
}));
