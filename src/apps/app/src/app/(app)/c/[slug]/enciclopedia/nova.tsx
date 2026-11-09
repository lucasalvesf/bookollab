import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import type { components } from '@/api/schema';
import { Loadable, Page } from '@/components/layout';
import { SheetForm } from '@/components/sheet-form';
import { Notice } from '@/components/ui';
import { makeStyles } from '@/theme';

type Template = components['schemas']['TemplateDto'];
type Choice = { kind: 'template'; template: Template } | { kind: 'free' };

/** New sheet: choose a template (or a free sheet, if the staff allows), then fill it in. */
export default function NewSheetScreen() {
  const styles = useStyles();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<Choice>();
  const encyclopedia = useQuery({
    queryKey: ['encyclopedia', slug, 'all', ''],
    queryFn: () => unwrap(api.GET('/communities/{slug}/encyclopedia', { params: { path: { slug }, query: {} } })),
  });

  return (
    <Page title="Nova ficha" subtitle={choice ? (choice.kind === 'free' ? 'Ficha livre' : `Modelo: ${choice.template.name}`) : 'Escolha um modelo para começar.'} back>
      <Loadable query={encyclopedia}>
        {(e) =>
          !choice ? (
            <View style={styles.options}>
              <Option
                title="Personagem"
                description="Ficha jogável: entra em cenas e escreve capítulos. Segue a ficha de personagem da comunidade."
                onPress={() => router.replace({ pathname: '/c/[slug]/personagens/novo', params: { slug } })}
              />
              {e.templates.map((t) => (
                <Option
                  key={t.id}
                  title={t.name}
                  description={[t.description, `${t.fields.length} ${t.fields.length === 1 ? 'campo' : 'campos'}`].filter(Boolean).join(' · ')}
                  onPress={() => setChoice({ kind: 'template', template: t })}
                />
              ))}
              {e.settings.freeSheetsEnabled ? (
                <Option title="Ficha livre" description="Comece do zero e crie os campos que quiser." onPress={() => setChoice({ kind: 'free' })} />
              ) : (
                <Notice kind="info">Nesta comunidade, as fichas precisam seguir um dos modelos da staff.</Notice>
              )}
              {e.templates.length === 0 && !e.settings.freeSheetsEnabled ? (
                <Notice kind="info">A staff ainda não criou modelos de ficha.</Notice>
              ) : null}
            </View>
          ) : (
            <SheetForm
              baseFields={choice.kind === 'template' ? choice.template.fields : []}
              canAddFields={choice.kind === 'free' || e.settings.templateMode === 'Base'}
              initial={{ name: '', kind: choice.kind === 'template' ? (choice.template.kind ?? null) : null, imageKey: null, values: {}, custom: [] }}
              submitLabel="Criar ficha"
              onSubmit={async (value) => {
                const { data, error } = await api.POST('/communities/{slug}/sheets', {
                  params: { path: { slug } },
                  body: { ...value, templateId: choice.kind === 'template' ? choice.template.id : null },
                });
                if (!data) return { ok: false, problem: error };
                await queryClient.invalidateQueries({ queryKey: ['encyclopedia', slug] });
                router.replace({ pathname: '/fichas/[id]', params: { id: data.id } });
                return { ok: true };
              }}
            />
          )
        }
      </Loadable>
    </Page>
  );
}

function Option({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  options: { gap: 10 },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 4, backgroundColor: colors.surface },
  optionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  optionDescription: { fontSize: 13, color: colors.textMuted },
  pressed: { opacity: 0.6 },
}));
