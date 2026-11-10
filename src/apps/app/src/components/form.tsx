import { useRouter } from 'expo-router';
import { Check, type LucideIcon } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, radius, shadow, useTheme } from '@/theme';

import { Page } from './layout';
import { Button } from './ui';

/**
 * Create/edit screen: grouped sections that scroll, and a fixed action bar at the bottom
 * (Cancel + main action on the right), like Discord's create dialogs.
 */
export function FormScreen({ title, subtitle, submitLabel, onSubmit, loading, disabled, secondary, children }: PropsWithChildren<{
  title: string;
  subtitle?: string;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Extra action left of the main one (e.g. "Salvar rascunho"). */
  secondary?: { label: string; onPress: () => void; loading?: boolean };
}>) {
  const styles = useStyles();
  return (
    <View style={styles.flex}>
      <Page title={title} subtitle={subtitle} back>
        {children}
        <View style={styles.spacer} />
      </Page>
      <FormFooter submitLabel={submitLabel} onSubmit={onSubmit} loading={loading} disabled={disabled} secondary={secondary} />
    </View>
  );
}

export function FormFooter({ submitLabel, onSubmit, loading, disabled, secondary, onCancel }: {
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: { label: string; onPress: () => void; loading?: boolean };
  onCancel?: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.footerInner}>
        <Button title="Cancelar" variant="ghost" size="sm" onPress={onCancel ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
        <View style={styles.flex} />
        {secondary ? <Button title={secondary.label} variant="secondary" size="sm" onPress={secondary.onPress} loading={secondary.loading} /> : null}
        <Button title={submitLabel} size="sm" onPress={onSubmit} loading={loading} disabled={disabled} />
      </View>
    </View>
  );
}

/** A titled group of fields inside a card. */
export function FormSection({ title, description, icon: Icon, right, children }: PropsWithChildren<{ title: string; description?: string; icon?: LucideIcon; right?: ReactNode }>) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {Icon ? <Icon size={17} color={colors.brand} strokeWidth={2.2} /> : null}
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
        </View>
        {right}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Choice as cards with icon and explanation (Discord's "channel type" picker). */
export function OptionCards<T extends string>({ label, options, value, onChange }: {
  label?: string;
  options: { value: T; label: string; description: string; icon: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {label ? <Text style={styles.optionsLabel}>{label}</Text> : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={({ hovered }) => [styles.option, selected && styles.optionSelected, hovered && !selected && styles.optionHover]}>
            <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
              <o.icon size={18} color={selected ? colors.brandText : colors.textMuted} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.optionTitle}>{o.label}</Text>
              <Text style={styles.optionDescription}>{o.description}</Text>
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <Check size={12} color={colors.brandText} strokeWidth={3} /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  spacer: { height: 24 },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, paddingHorizontal: 20, ...shadow(colors, 2) },
  footerInner: { width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow(colors, 1) },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  sectionBody: { padding: 18, gap: 16 },
  options: { gap: 8 },
  optionsLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  optionHover: { borderColor: colors.borderStrong },
  optionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  optionIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  optionIconSelected: { backgroundColor: colors.brand },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionDescription: { fontSize: 13, color: colors.textMuted, marginTop: 1, lineHeight: 18 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
}));
