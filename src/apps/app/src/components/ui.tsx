import { AlertCircle, BookOpen, CheckCircle2, Info, type LucideIcon } from 'lucide-react-native';
import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { makeStyles, radius, shadow, useTheme } from '@/theme';

/** Account screens: logo, tagline and the form card on a calm neutral background. */
export function AuthScreen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <BookOpen size={22} color={colors.brandText} strokeWidth={2.4} />
          </View>
          <Text style={styles.brand}>Bookollab</Text>
        </View>
        <Text style={styles.tagline}>Histórias que se escrevem juntas.</Text>
        <Animated.View entering={FadeInDown.duration(350)} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Field({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSubtle}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[styles.input, input.multiline && styles.inputMultiline, focused && styles.inputFocused, error ? styles.inputError : null]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Pressable with a small spring "press" animation. Base for buttons and tappable cards. */
export function PressableScale({ children, onPress, disabled, style, accessibilityLabel, accessibilityRole = 'button' }: PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  style?: object | (object | false | undefined | null)[];
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab';
}>) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  // The pressable itself carries the layout style, so it behaves as a normal flex/grid item.
  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => scale.set(withSpring(0.97, { damping: 20, stiffness: 400 }))}
      onPressOut={() => scale.set(withSpring(1, { damping: 15, stiffness: 300 }))}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  loading,
  disabled,
  icon: Icon,
  variant = 'primary',
  size = 'md',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fg = { primary: colors.brandText, secondary: colors.brandSoftText, ghost: colors.textMuted, danger: colors.danger }[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading || disabled}
      style={[styles.button, size === 'sm' && styles.buttonSm, styles[`button_${variant}`], (loading || disabled) && styles.disabled]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={size === 'sm' ? 16 : 18} color={fg} strokeWidth={2.2} /> : null}
          <Text style={[styles.buttonText, size === 'sm' && styles.buttonTextSm, { color: fg }]}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

/** Round icon-only button (toolbar, header). */
export function IconButton({ icon: Icon, label, onPress, tone = 'default', size = 40, badge }: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'brand' | 'onImage';
  size?: number;
  badge?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = tone === 'brand' ? colors.brandText : tone === 'onImage' ? '#FFFFFF' : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.iconButton, { width: size, height: size }, tone === 'brand' && styles.iconButtonBrand, tone === 'onImage' && styles.iconButtonOnImage]}>
      <Icon size={Math.round(size * 0.5)} color={color} strokeWidth={2} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

export function Notice({ kind, children }: PropsWithChildren<{ kind: 'error' | 'success' | 'info' }>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [bg, fg, Icon] = {
    error: [colors.dangerBg, colors.danger, AlertCircle],
    success: [colors.successBg, colors.success, CheckCircle2],
    info: [colors.brandSoft, colors.brandSoftText, Info],
  }[kind] as [string, string, LucideIcon];
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Icon size={18} color={fg} strokeWidth={2.2} />
      <Text style={[styles.noticeText, { color: fg }]}>{children}</Text>
    </Animated.View>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  screen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: colors.textMuted, marginBottom: 20 },
  card: { width: '100%', maxWidth: 440, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 28, borderWidth: 1, borderColor: colors.border, ...shadow(colors, 2) },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, lineHeight: 21 },
  body: { marginTop: 22, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top', lineHeight: 22 },
  inputFocused: { borderColor: colors.brand },
  inputError: { borderColor: colors.danger },
  fieldError: { fontSize: 13, color: colors.danger },
  hint: { fontSize: 13, color: colors.textSubtle },
  button: { flexDirection: 'row', gap: 8, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  buttonSm: { paddingVertical: 7, paddingHorizontal: 12, minHeight: 34, borderRadius: radius.sm + 2 },
  button_primary: { backgroundColor: colors.brand, ...shadow(colors, 1) },
  button_secondary: { backgroundColor: colors.brandSoft },
  button_ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  button_danger: { backgroundColor: colors.dangerBg },
  buttonText: { fontSize: 15, fontWeight: '600' },
  buttonTextSm: { fontSize: 13 },
  disabled: { opacity: 0.55 },
  iconButton: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  iconButtonBrand: { backgroundColor: colors.brand },
  iconButtonOnImage: { backgroundColor: 'rgba(0,0,0,0.35)' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: radius.md, padding: 12 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: colors.brand },
}));
