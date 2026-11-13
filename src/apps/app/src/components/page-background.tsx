import { Image } from 'expo-image';
import { Droplet, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fileUrl, pickAndUploadImage } from '@/lib/files';
import { makeStyles, radius, useTheme } from '@/theme';

import { Slider } from './slider';
import { Button, Notice } from './ui';

export type PageBackground = { imageKey: string | null; color: string | null; blur: number };

export const BACKGROUND_COLORS = ['#F6EFE2', '#E8F1EC', '#E6EEF7', '#F3E8F1', '#FBEAD9', '#EDEDED', '#2B2433', '#1E2A36', '#2D2A20', '#101418'];

/** Paints a page background behind its content: image (with blur) or a solid color. Nothing when empty. */
export function BackgroundLayer({ value }: { value: PageBackground }) {
  const url = fileUrl(value.imageKey);
  if (url) return <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={value.blur} transition={200} />;
  if (value.color) return <View style={[StyleSheet.absoluteFill, { backgroundColor: value.color }]} />;
  return null;
}

/**
 * Background chooser: a solid color, or an image cropped to the screen and blurred with a dial (0 = sharp).
 */
export function BackgroundPicker({ value, onChange, aspect = 16 / 9 }: { value: PageBackground; onChange: (v: PageBackground) => void; aspect?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const url = fileUrl(value.imageKey);
  async function pick() {
    setError(undefined);
    setBusy(true);
    try {
      const key = await pickAndUploadImage({ aspect, title: 'Ajustar fundo' });
      if (key) onChange({ ...value, imageKey: key });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.wrap}>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={styles.preview}>
        <BackgroundLayer value={value} />
        {!url && !value.color ? <Text style={styles.empty}>Sem fundo</Text> : null}
      </View>
      <Text style={styles.label}>Cor</Text>
      <View style={styles.swatches}>
        {BACKGROUND_COLORS.map((c) => (
          <Pressable key={c} accessibilityRole="radio" accessibilityLabel={c} accessibilityState={{ checked: value.color === c && !value.imageKey }} onPress={() => onChange({ imageKey: null, color: c, blur: value.blur })} style={[styles.swatch, { backgroundColor: c }, value.color === c && !value.imageKey && styles.swatchOn]} />
        ))}
      </View>
      <View style={styles.inline}>
        <Button title={url ? 'Trocar imagem' : 'Usar uma imagem'} icon={ImagePlus} size="sm" variant="secondary" loading={busy} onPress={() => void pick()} />
        {url || value.color ? <Button title="Tirar fundo" icon={Trash2} size="sm" variant="ghost" onPress={() => onChange({ imageKey: null, color: null, blur: 0 })} /> : null}
      </View>
      {url ? (
        <View style={styles.blur}>
          <View style={styles.blurHead}>
            <Droplet size={14} color={colors.textMuted} />
            <Text style={styles.label}>{`Desfoque: ${value.blur === 0 ? 'nítido' : `${value.blur}px`}`}</Text>
          </View>
          <Slider value={value.blur / 40} onChange={(v) => onChange({ ...value, blur: Math.round(v * 40) })} label="Desfoque do fundo" ticks={9} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: 10 },
  preview: { height: 120, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: colors.textSubtle },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
  swatchOn: { borderWidth: 3, borderColor: colors.brand },
  inline: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  blur: { gap: 4 },
  blurHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
