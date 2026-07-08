// src/screens/ManageScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as db from '../db';
import { CatalogItem, Client, formatCents } from '../models';
import { T } from '../theme';

interface Props {
  onDone: () => void;
}

type Tab = 'clients' | 'items';

export default function ManageScreen({ onDone }: Props) {
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // dialog fields
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [f3, setF3] = useState('');

  const load = useCallback(async () => {
    setClients(await db.listClients());
    setItems(await db.listItems());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openClient = (c: Client | null) => {
    setF1(c?.name ?? '');
    setF2(c?.address ?? '');
    setF3(c?.email ?? '');
    setEditingClient(c ?? { name: '', address: '', email: '' });
  };

  const openItem = (i: CatalogItem | null) => {
    setF1(i?.description ?? '');
    setF2(i ? (i.unitPriceCents / 100).toFixed(2) : '');
    setEditingItem(i ?? { description: '', unitPriceCents: 0 });
  };

  const saveClient = async () => {
    if (!f1.trim()) return;
    await db.upsertClient({
      id: editingClient?.id,
      name: f1.trim(),
      address: f2.trim(),
      email: f3.trim(),
    });
    setEditingClient(null);
    load();
  };

  const saveItem = async () => {
    if (!f1.trim()) return;
    await db.upsertItem({
      id: editingItem?.id,
      description: f1.trim(),
      unitPriceCents: Math.round((parseFloat(f2) || 0) * 100),
    });
    setEditingItem(null);
    load();
  };

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={s.topAction}>‹ Back</Text>
        </Pressable>
        <Text style={s.title}>Clients & items</Text>
        <Pressable
          onPress={() => (tab === 'clients' ? openClient(null) : openItem(null))}
          hitSlop={8}
        >
          <Text style={s.topAction}>＋ Add</Text>
        </Pressable>
      </View>

      <View style={s.tabs}>
        {(['clients', 'items'] as Tab[]).map((t) => (
          <Pressable key={t} style={[s.tab, tab === t && s.tabOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextOn]}>
              {t === 'clients' ? 'Clients' : 'Saved items'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'clients' ? (
        <FlatList
          data={clients}
          keyExtractor={(c) => String(c.id)}
          ListEmptyComponent={<Text style={s.empty}>No clients yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => openClient(item)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{item.name}</Text>
                {!!item.email && <Text style={s.rowSub}>{item.email}</Text>}
              </View>
              <Pressable
                hitSlop={8}
                onPress={async () => {
                  if (item.id != null) {
                    await db.deleteClient(item.id);
                    load();
                  }
                }}
              >
                <Text style={s.delete}>✕</Text>
              </Pressable>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          ListEmptyComponent={<Text style={s.empty}>No saved items yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => openItem(item)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{item.description}</Text>
                <Text style={s.rowSub}>{formatCents(item.unitPriceCents, '$')}</Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={async () => {
                  if (item.id != null) {
                    await db.deleteItem(item.id);
                    load();
                  }
                }}
              >
                <Text style={s.delete}>✕</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {/* Client dialog */}
      <Modal visible={editingClient != null} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setEditingClient(null)}>
          <Pressable style={s.dialog} onPress={() => {}}>
            <Text style={s.dialogTitle}>
              {editingClient?.id != null ? 'Edit client' : 'New client'}
            </Text>
            <TextInput style={s.input} placeholder="Name" value={f1} onChangeText={setF1} />
            <TextInput
              style={[s.input, { height: 56 }]}
              placeholder="Address"
              value={f2}
              onChangeText={setF2}
              multiline
            />
            <TextInput
              style={s.input}
              placeholder="Email"
              value={f3}
              onChangeText={setF3}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Pressable style={s.primaryBtn} onPress={saveClient}>
              <Text style={s.primaryBtnText}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Item dialog */}
      <Modal visible={editingItem != null} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setEditingItem(null)}>
          <Pressable style={s.dialog} onPress={() => {}}>
            <Text style={s.dialogTitle}>
              {editingItem?.id != null ? 'Edit item' : 'New item'}
            </Text>
            <TextInput
              style={s.input}
              placeholder="Description"
              value={f1}
              onChangeText={setF1}
            />
            <TextInput
              style={s.input}
              placeholder="Unit price"
              value={f2}
              onChangeText={setF2}
              keyboardType="decimal-pad"
            />
            <Pressable style={s.primaryBtn} onPress={saveItem}>
              <Text style={s.primaryBtnText}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
  },
  title: { fontSize: 17, fontWeight: '700', color: T.ink },
  topAction: { color: T.accent, fontSize: 15, fontWeight: '600' },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: T.faint,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: T.accent },
  tabText: { color: T.ink, fontWeight: '600', fontSize: 14 },
  tabTextOn: { color: '#fff' },
  empty: { textAlign: 'center', color: T.muted, marginTop: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: T.ink },
  rowSub: { fontSize: 13, color: T.muted, marginTop: 2 },
  delete: { color: T.danger, fontSize: 16, paddingHorizontal: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: T.bg, borderRadius: 14, padding: 18 },
  dialogTitle: { fontSize: 16, fontWeight: '700', color: T.ink, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: T.ink,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
