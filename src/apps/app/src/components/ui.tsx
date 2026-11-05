import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

/** Temporary palette until the visual identity is defined (see docs/visao-produto.md). */
export const colors = {
  brand: '#02534E',
  brandText: '#FFFFFF',
  text: '#1F2A28',
  textMuted: '#6B7472',
  border: '#C9D1CF',
  surface: '#FFFFFF',
  background: '#F2FAF9',
  danger: '#B42318',
  dangerBg: '#FEF3F2',
  success: '#067647',
  successBg: '#ECFDF3',
};

/** Centered card layout used by the account screens. */
export function AuthScreen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Bookollab</Text>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Field({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...input}
        style={[styles.input, error ? styles.inputError : null]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary ? styles.buttonPrimary : styles.buttonSecondary, (pressed || loading) && styles.pressed]}>
      {loading ? (
        <ActivityIndicator color={primary ? colors.brandText : colors.brand} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? colors.brandText : colors.brand }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Notice({ kind, children }: PropsWithChildren<{ kind: 'error' | 'success' | 'info' }>) {
  const palette = {
    error: [colors.dangerBg, colors.danger],
    success: [colors.successBg, colors.success],
    info: [colors.background, colors.text],
  }[kind];
  return (
    <View style={[styles.notice, { backgroundColor: palette[0] }]} accessibilityRole="alert">
      <Text style={[styles.noticeText, { color: palette[1] }]}>{children}</Text>
    </View>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  screen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  brand: { fontSize: 28, fontWeight: '700', color: colors.brand },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6 },
  body: { marginTop: 20, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { fontSize: 13, color: colors.danger },
  hint: { fontSize: 13, color: colors.textMuted },
  button: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand },
  buttonText: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  notice: { borderRadius: 10, padding: 12 },
  noticeText: { fontSize: 14 },
  link: { fontSize: 14, color: colors.brand, fontWeight: '600', textAlign: 'center' },
});
