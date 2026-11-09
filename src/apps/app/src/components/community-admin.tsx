import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, BookMarked, Clapperboard, ImagePlus, LayoutList, NotebookPen, Paintbrush, Trash2, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { pickAndUploadImage } from '@/lib/files';
import { makeStyles, radius, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { CommunityCover } from './community';
import { Section } from './layout';
import { Button, IconButton, Notice } from './ui';

type Community = components['schemas']['CommunityDetail'];

export const SECTION_INFO: Record<string, { label: string; icon: LucideIcon }> = {
  scenes: { label: 'Cenas', icon: Clapperboard },
  chapters: { label: 'Capítulos', icon: NotebookPen },
  encyclopedia: { label: 'Enciclopédia', icon: BookMarked },
  characters: { label: 'Personagens', icon: UserRound },
  members: { label: 'Membros', icon: Users },
};

/** Staff: community icon and cover. */
export function AppearanceAdmin({ community: c }: { community: Community }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'icon' | 'cover'>();
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: (body: { iconKey: string | null; coverKey: string | null }) => unwrap(api.PUT('/communities/{slug}/appearance', { params: { path: { slug: c.slug } }, body })),
    onSuccess: (data) => {
      queryClient.setQueryData(['community', c.slug], data);
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
    onError: (e) => setError(e.message),
  });

  async function pick(kind: 'icon' | 'cover') {
    setError(undefined);
    setBusy(kind);
    try {
      const key = await pickAndUploadImage();
      if (key) save.mutate({ iconKey: kind === 'icon' ? key : (c.iconKey ?? null), coverKey: kind === 'cover' ? key : (c.coverKey ?? null) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Section title="Aparência" icon={Paintbrush}>
      <CommunityCover name={c.name} coverKey={c.coverKey} height={120} />
      <View style={styles.appearance}>
        <View style={styles.iconSlot}>
          <Avatar name={c.name} imageKey={c.iconKey} size={64} shape="rounded" />
        </View>
        <View style={styles.buttons}>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <View style={styles.inline}>
            <Button title="Trocar ícone" icon={ImagePlus} size="sm" variant="secondary" loading={busy === 'icon'} onPress={() => pick('icon')} />
            <Button title="Trocar capa" icon={ImagePlus} size="sm" variant="secondary" loading={busy === 'cover'} onPress={() => pick('cover')} />
            {c.iconKey || c.coverKey ? <Button title="Remover imagens" icon={Trash2} size="sm" variant="ghost" onPress={() => save.mutate({ iconKey: null, coverKey: null })} /> : null}
          </View>
          <Text style={styles.hint}>Sem imagem, a comunidade usa um gradiente gerado a partir do nome.</Text>
        </View>
      </View>
    </Section>
  );
}

/** Owner (or whoever has ArrangeSections): order of the sections members see, like in Amino. */
export function SectionsAdmin({ community: c }: { community: Community }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const order = c.sections ?? Object.keys(SECTION_INFO);
  const save = useMutation({
    mutationFn: (sections: string[]) => unwrap(api.PUT('/communities/{slug}/sections', { params: { path: { slug: c.slug } }, body: { sections } })),
    onMutate: (sections) => queryClient.setQueryData<Community>(['community', c.slug], (old) => (old ? { ...old, sections } : old)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['community', c.slug] }),
  });
  const move = (i: number, delta: number) => {
    const next = [...order];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    save.mutate(next);
  };

  return (
    <Section title="Ordem das seções" icon={LayoutList}>
      {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
      {order.map((key, i) => {
        const info = SECTION_INFO[key];
        if (!info) return null;
        return (
          <View key={key} style={styles.sectionRow}>
            <Text style={styles.position}>{i + 1}</Text>
            <View style={styles.sectionIcon}>
              <info.icon size={18} color={colors.brandSoftText} />
            </View>
            <Text style={styles.sectionLabel}>{info.label}</Text>
            <IconButton icon={ArrowUp} label={`Subir ${info.label}`} size={34} onPress={() => i > 0 && move(i, -1)} />
            <IconButton icon={ArrowDown} label={`Descer ${info.label}`} size={34} onPress={() => i < order.length - 1 && move(i, 1)} />
          </View>
        );
      })}
      <Text style={[styles.hint, styles.padded]}>É a ordem das abas na página da comunidade. A primeira abre por padrão.</Text>
    </Section>
  );
}

const useStyles = makeStyles((colors) => ({
  appearance: { flexDirection: 'row', gap: 14, padding: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  iconSlot: { marginTop: -44, borderRadius: 22, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surface },
  buttons: { flex: 1, minWidth: 220, gap: 8 },
  inline: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hint: { fontSize: 13, color: colors.textSubtle },
  padded: { padding: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  position: { width: 18, fontSize: 13, fontWeight: '700', color: colors.textSubtle, textAlign: 'center' },
  sectionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
}));
