import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './ui';

/** Horizontal list of selectable chips (e.g. which character to play as). */
export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && styles.selected]}>
              <Text style={[styles.text, selected && styles.selectedText]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Two-step destructive button: first tap asks, second confirms (no native dialogs, works on web and mobile). */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onConfirm} hitSlop={6}>
        <Text style={styles.danger}>{confirmLabel}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setAsking(false)} hitSlop={6}>
        <Text style={styles.link}>Cancelar</Text>
      </Pressable>
    </View>
  ) : (
    <Pressable accessibilityRole="button" onPress={() => setAsking(true)} hitSlop={6}>
      <Text style={styles.danger}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.brand, borderColor: colors.brand },
  text: { fontSize: 14, color: colors.text },
  selectedText: { color: colors.brandText, fontWeight: '600' },
  danger: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  link: { fontSize: 13, color: colors.brand, fontWeight: '600' },
});
