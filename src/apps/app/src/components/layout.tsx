import { useRouter } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { colors, Notice } from './ui';

/** Standard page for the logged-in area: scrollable, centered column, optional back button. */
export function Page({ title, subtitle, back, actions, children }: PropsWithChildren<{ title: string; subtitle?: string; back?: boolean; actions?: ReactNode }>) {
  const router = useRouter();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.column}>
        {back ? (
          <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={8}>
            <Text style={styles.back}>‹ Voltar</Text>
          </Pressable>
        ) : null}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {actions}
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </ScrollView>
  );
}

export function Section({ title, right, children }: PropsWithChildren<{ title: string; right?: ReactNode }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function Row({ title, subtitle, left, right, onPress }: { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void }) {
  const content = (
    <View style={styles.row}>
      {left}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Empty({ children }: PropsWithChildren) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.rowText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.rowSubtitle}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.brand }} />
    </View>
  );
}

/** Loading / error wrapper for react-query results. */
export function Loadable<T>({ query, children }: { query: { isPending: boolean; isError: boolean; error: Error | null; data: T | undefined }; children: (data: T) => ReactNode }) {
  if (query.isPending) return <ActivityIndicator color={colors.brand} style={styles.loading} />;
  if (query.isError || query.data === undefined) return <Notice kind="error">{query.error?.message ?? 'Algo deu errado.'}</Notice>;
  return <>{children(query.data)}</>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, alignItems: 'center' },
  column: { width: '100%', maxWidth: 720, gap: 12 },
  back: { color: colors.brand, fontSize: 15, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  headerText: { flex: 1, minWidth: 200 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  body: { gap: 20, marginTop: 8 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.background },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
  pressed: { opacity: 0.6 },
  empty: { padding: 16, color: colors.textMuted, fontSize: 14 },
  tag: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.brand },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  loading: { marginTop: 24 },
});
