import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Backpack, Dices, Gauge } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/hooks';

import { Empty, Row, Section, ToggleRow } from './layout';
import { Button, Field, Notice } from './ui';
import { makeStyles } from '@/theme';

/** Staff: turn each RPG mechanic on or off for the community. */
export function MechanicsAdmin({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const mechanics = useQuery({
    queryKey: ['mechanics', slug],
    queryFn: () => unwrap(api.GET('/communities/{slug}/mechanics', { params: { path: { slug } } })),
  });
  const save = useMutation({
    mutationFn: (body: { diceEnabled: boolean; attributesEnabled: boolean; inventoryEnabled: boolean }) =>
      unwrap(api.PUT('/communities/{slug}/mechanics', { params: { path: { slug } }, body })),
    onSuccess: (data) => {
      queryClient.setQueryData(['mechanics', slug], data);
      void queryClient.invalidateQueries({ queryKey: ['community', slug] });
    },
  });
  const m = mechanics.data;
  if (!m) return null;
  return (
    <Section title="Mecânicas de RPG" icon={Dices}>
      {save.isError ? <Notice kind="error">{save.error.message}</Notice> : null}
      <ToggleRow label="Rolagem de dados" hint="Nas cenas: /rolar 1d20+3. O servidor rola e o resultado não pode ser editado." value={m.diceEnabled} onChange={(v) => save.mutate({ ...m, diceEnabled: v })} />
      <ToggleRow label="Atributos na ficha" hint="Os campos numéricos da ficha (ex.: Força) viram atributos e podem entrar nas rolagens: /rolar 1d20+força." value={m.attributesEnabled} onChange={(v) => save.mutate({ ...m, attributesEnabled: v })} />
      <ToggleRow label="Inventário" hint="Itens dos personagens. Só a moderação dá ou tira itens." value={m.inventoryEnabled} onChange={(v) => save.mutate({ ...m, inventoryEnabled: v })} />
    </Section>
  );
}

/** Character screen: attributes and inventory, according to the community toggles. */
export function CharacterMechanics({ characterId }: { characterId: string }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const key = ['character-mechanics', characterId];
  const data = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/characters/{id}/mechanics', { params: { path: { id: characterId } } })) });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/characters/{id}/inventory', { params: { path: { id: characterId } }, body: { name, quantity: Number(quantity) || 0, description: description || null } })),
    onSuccess: () => {
      setName('');
      setQuantity('1');
      setDescription('');
      setAdding(false);
      void refresh();
    },
  });
  const change = useMutation({
    mutationFn: (item: { id: string; name: string; quantity: number; description?: string | null }) =>
      item.quantity <= 0
        ? unwrap(api.DELETE('/inventory-items/{id}', { params: { path: { id: item.id } } }))
        : unwrap(api.PUT('/inventory-items/{id}', { params: { path: { id: item.id } }, body: { name: item.name, quantity: item.quantity, description: item.description ?? null } })),
    onSuccess: () => void refresh(),
  });

  const d = data.data;
  if (!d) return null;
  return (
    <>
      {d.mechanics.attributesEnabled ? (
        <Section title="Atributos" icon={Gauge}>
          {d.attributes.length === 0 ? (
            <Empty>A moderação ainda não criou campos numéricos na ficha.</Empty>
          ) : (
            <View style={styles.attributes}>
              {d.attributes.map((a) => (
                <View key={a.key} style={styles.attribute}>
                  <Text style={styles.attributeValue}>{a.value ?? '—'}</Text>
                  <Text style={styles.attributeLabel}>{a.label}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
      ) : null}
      {d.mechanics.inventoryEnabled ? (
        <Section title="Inventário" icon={Backpack}>
          {change.isError ? <Notice kind="error">{change.error.message}</Notice> : null}
          {d.inventory.length === 0 ? <Empty>Nenhum item.</Empty> : null}
          {d.inventory.map((i) => (
            <Row
              key={i.id}
              title={`${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`}
              subtitle={i.description ?? undefined}
              right={
                d.canManageInventory ? (
                  <View style={styles.stepper}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Tirar um ${i.name}`} onPress={() => change.mutate({ ...i, quantity: i.quantity - 1 })} style={styles.step}>
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Dar mais um ${i.name}`} onPress={() => change.mutate({ ...i, quantity: i.quantity + 1 })} style={styles.step}>
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                ) : undefined
              }
            />
          ))}
          {d.canManageInventory ? (
            <View style={styles.padded}>
              {adding ? (
                <>
                  {add.isError ? <Notice kind="error">{add.error.message}</Notice> : null}
                  <Field label="Item" value={name} onChangeText={setName} placeholder="Ex.: Poção de cura" />
                  <Field label="Quantidade" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
                  <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} />
                  <Button title="Dar item" onPress={() => add.mutate()} loading={add.isPending} />
                  <Button title="Cancelar" variant="secondary" onPress={() => setAdding(false)} />
                </>
              ) : (
                <Button title="Dar um item" variant="secondary" onPress={() => setAdding(true)} />
              )}
            </View>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  attributes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  attribute: { minWidth: 84, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  attributeValue: { fontSize: 22, fontWeight: '800', color: colors.brand },
  attributeLabel: { fontSize: 13, color: colors.textMuted },
  stepper: { flexDirection: 'row', gap: 6 },
  step: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 18, color: colors.text },
  padded: { padding: 16, gap: 10 },
}));
