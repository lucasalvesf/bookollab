import { Check, Trash2, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, radius, useTheme } from '@/theme';

/** Selectable chips (e.g. which character to play as). With `segmented`, a single connected control. */
export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  label,
  segmented,
}: {
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T | undefined;
  onChange: (value: T) => void;
  label?: string;
  segmented?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={segmented ? styles.segmented : styles.row} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          const color = selected ? (segmented ? colors.text : colors.brandText) : colors.textMuted;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(o.value)}
              style={({ hovered }) => [
                segmented ? styles.segment : styles.chip,
                selected && (segmented ? styles.segmentSelected : styles.selected),
                hovered && !selected && styles.hovered,
              ]}>
              {o.icon ? <o.icon size={16} color={color} strokeWidth={2.2} /> : !segmented && selected ? <Check size={14} color={color} strokeWidth={3} /> : null}
              <Text style={[styles.text, { color }, selected && styles.selectedText]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Two-step destructive button: first tap asks, second confirms (no native dialogs, works on web and mobile). */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [asking, setAsking] = useState(false);
  return asking ? (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onConfirm} hitSlop={6} style={styles.dangerSolid}>
        <Text style={styles.dangerSolidText}>{confirmLabel}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setAsking(false)} hitSlop={6}>
        <Text style={styles.link}>Cancelar</Text>
      </Pressable>
    </View>
  ) : (
    <Pressable accessibilityRole="button" onPress={() => setAsking(true)} hitSlop={6} style={styles.dangerRow}>
      <Trash2 size={15} color={colors.danger} />
      <Text style={styles.danger}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.brand, borderColor: colors.brand },
  hovered: { borderColor: colors.borderStrong },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4, alignSelf: 'flex-start', flexWrap: 'wrap' },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  segmentSelected: { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  text: { fontSize: 14, fontWeight: '500' },
  selectedText: { fontWeight: '600' },
  danger: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dangerSolid: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  dangerSolidText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
}));
