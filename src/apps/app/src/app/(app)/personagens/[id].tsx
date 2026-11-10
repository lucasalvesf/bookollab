import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookMarked, Eye, EyeOff, IdCard, Link2, Pencil, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';
import { Avatar } from '@/components/avatar';
import { CharacterForm } from '@/components/character-form';
import { FolderPicker } from '@/components/folder-picker';
import { Empty, Loadable, Page, Section } from '@/components/layout';
import { CharacterMechanics } from '@/components/mechanics';
import { ContextMenu, MoreButton, useCopyLink, type MenuItem } from '@/components/menu';
import { IconButton, Notice } from '@/components/ui';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

/** Character sheet (Amino's character wiki): portrait and identity, the sheet, then mechanics. */
export default function CharacterScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const copyLink = useCopyLink();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const character = useQuery({
    queryKey: ['character', id],
    queryFn: () => unwrap(api.GET('/characters/{id}', { params: { path: { id } } }), 'Personagem não encontrado.'),
  });
  const community = useQuery({
    queryKey: ['community', character.data?.communitySlug],
    enabled: !!character.data,
    queryFn: () => unwrap(api.GET('/communities/{slug}', { params: { path: { slug: character.data!.communitySlug } } })),
  });

  return (
    <Loadable query={character}>
      {(ch) => {
        const startEdit = () => {
          setSaved(false);
          setEditing(true);
        };
        const menu: MenuItem[] = [
          { label: 'Editar personagem', icon: Pencil, hidden: !ch.canEdit, onPress: startEdit },
          { label: 'Ver o jogador', icon: UserRound, onPress: () => router.push({ pathname: '/c/[slug]/membros/[userName]', params: { slug: ch.communitySlug, userName: ch.ownerUserName } }) },
          { label: 'Abrir a enciclopédia', icon: BookMarked, onPress: () => router.push({ pathname: '/c/[slug]/enciclopedia', params: { slug: ch.communitySlug } }) },
          'separator',
          { label: 'Copiar link', icon: Link2, onPress: () => void copyLink(`/personagens/${ch.id}`) },
        ];
        return (
          <Page
            title={editing ? `Editar ${ch.name}` : ch.name}
            back
            actions={
              editing ? undefined : (
                <View style={styles.inline}>
                  {ch.canEdit ? <IconButton icon={Pencil} label="Editar personagem" onPress={startEdit} /> : null}
                  <MoreButton items={menu} title={ch.name} size={40} />
                </View>
              )
            }>
            {saved ? <Notice kind="success">Personagem salvo.</Notice> : null}
            <Loadable query={community}>
              {(c) =>
                editing ? (
                  <CharacterForm
                    fields={c.sheetFields}
                    initial={{ name: ch.name, sheet: ch.sheet, showOnGlobalProfile: ch.showOnGlobalProfile, showCommunityOnProfile: ch.showCommunityOnProfile, avatarKey: ch.avatarKey }}
                    submitLabel="Salvar alterações"
                    onCancel={() => setEditing(false)}
                    onSubmit={async (input) => {
                      const { data, error } = await api.PUT('/characters/{id}', { params: { path: { id } }, body: input });
                      if (!data) return { ok: false, problem: error };
                      queryClient.setQueryData(['character', id], data);
                      await queryClient.invalidateQueries({ queryKey: ['characters', ch.communitySlug] });
                      setEditing(false);
                      setSaved(true);
                      return { ok: true };
                    }}
                  />
                ) : (
                  <>
                    <ContextMenu items={menu} title={ch.name} style={styles.identity}>
                      <Avatar name={ch.name} imageKey={ch.avatarKey} size={120} shape="rounded" />
                      <View style={styles.identityText}>
                        <Text style={styles.kind}>Personagem</Text>
                        <Text style={styles.name}>{ch.name}</Text>
                        <Text style={styles.meta}>{`de @${ch.ownerUserName}${community.data ? ` · ${community.data.name}` : ''}`}</Text>
                        <View style={styles.visibility}>
                          {ch.showOnGlobalProfile ? <Eye size={14} color={colors.textSubtle} /> : <EyeOff size={14} color={colors.textSubtle} />}
                          <Text style={styles.visibilityText}>
                            {ch.showOnGlobalProfile
                              ? `Na vitrine do perfil global${ch.showCommunityOnProfile ? ', com a comunidade' : ''}`
                              : 'Fora do perfil global'}
                          </Text>
                        </View>
                      </View>
                    </ContextMenu>

                    <Section title="Ficha" icon={IdCard}>
                      {c.sheetFields.length === 0 ? (
                        <Empty icon={IdCard}>A comunidade ainda não definiu campos de ficha.</Empty>
                      ) : (
                        c.sheetFields.map((f) => {
                          const value = ch.sheet.find((v) => v.key === f.key)?.value;
                          return (
                            <View key={f.key} style={[styles.field, f.type === 'LongText' && styles.fieldLong]}>
                              <Text style={styles.fieldLabel}>{f.label}</Text>
                              <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>{value || '—'}</Text>
                            </View>
                          );
                        })
                      )}
                    </Section>
                    <CharacterMechanics characterId={ch.id} />
                    <View style={styles.staffBox}>
                      <FolderPicker slug={ch.communitySlug} itemType="Character" itemId={ch.id} folderId={ch.folderId} onMoved={() => queryClient.invalidateQueries({ queryKey: ['character', id] })} />
                    </View>
                  </>
                )
              }
            </Loadable>
          </Page>
        );
      }}
    </Loadable>
  );
}

const useStyles = makeStyles((colors) => ({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow(colors, 1) },
  identityText: { flex: 1, minWidth: 180, gap: 3 },
  kind: { fontSize: 11, fontWeight: '700', color: colors.brand, textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  meta: { fontSize: 14, color: colors.textMuted },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  visibilityText: { fontSize: 12, color: colors.textSubtle },
  field: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  fieldLong: { flexDirection: 'column', gap: 4 },
  fieldLabel: { width: 140, fontSize: 13, fontWeight: '600', color: colors.textSubtle },
  fieldValue: { flex: 1, minWidth: 160, fontSize: 15, color: colors.text, lineHeight: 22 },
  fieldEmpty: { color: colors.textSubtle },
  staffBox: { gap: 6 },
}));
