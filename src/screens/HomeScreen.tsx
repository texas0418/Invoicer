// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as db from '../db';
import {
  effectiveStatus,
  formatCents,
  formatDate,
  Invoice,
  totalCents,
} from '../models';
import { sharePdf } from '../pdf';
import {
  canCreateInvoice,
  cancelReminder,
  FREE_INVOICES_PER_MONTH,
  getBusinessProfile,
  scheduleDueReminder,
  setPro,
} from '../services';
import { statusColor, T } from '../theme';

const FILTERS = ['all', 'draft', 'sent', 'paid', 'overdue'] as const;
type Filter = (typeof FILTERS)[number];

interface Props {
  onNewInvoice: () => void;
  onManage: () => void;
  onSettings: () => void;
}

export default function HomeScreen({ onNewInvoice, onManage, onSettings }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setInvoices(await db.listInvoices());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible =
    filter === 'all'
      ? invoices
      : invoices.filter((i) => effectiveStatus(i) === filter);

  const handleNew = async () => {
    if (await canCreateInvoice()) {
      onNewInvoice();
      return;
    }
    Alert.alert(
      'Free limit reached',
      `You've created ${FREE_INVOICES_PER_MONTH} invoices this month. ` +
        'Upgrade to Pro for unlimited invoices. One-time purchase — no subscription.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: async () => {
            // TODO: replace with RevenueCat purchase flow before launch.
            await setPro(true);
            onNewInvoice();
          },
        },
      ],
    );
  };

  const share = async (inv: Invoice) => {
    const biz = await getBusinessProfile();
    await sharePdf(inv, biz);
    if (inv.status === 'draft' && inv.id != null) {
      await db.setInvoiceStatus(inv.id, 'sent');
      const notifId = await scheduleDueReminder(inv);
      await db.setInvoiceNotificationId(inv.id, notifId);
    }
    setSelected(null);
    load();
  };

  const markPaid = async (inv: Invoice) => {
    if (inv.id == null) return;
    await db.setInvoiceStatus(inv.id, 'paid');
    await cancelReminder(inv.notificationId);
    setSelected(null);
    load();
  };

  const remove = async (inv: Invoice) => {
    if (inv.id == null) return;
    await db.deleteInvoice(inv.id);
    await cancelReminder(inv.notificationId);
    setSelected(null);
    load();
  };

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <Text style={s.title}>Invoices</Text>
        <View style={s.topActions}>
          <Pressable onPress={onManage} hitSlop={8}>
            <Text style={s.topAction}>Clients</Text>
          </Pressable>
          <Pressable onPress={onSettings} hitSlop={8}>
            <Text style={s.topAction}>Settings</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[s.chip, filter === f && s.chipOn]}
          >
            <Text style={[s.chipText, filter === f && s.chipTextOn]}>
              {f[0].toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(i) => String(i.id)}
        ListEmptyComponent={
          <Text style={s.empty}>No invoices yet.{'\n'}Tap “New invoice” to start.</Text>
        }
        renderItem={({ item }) => {
          const st = effectiveStatus(item);
          return (
            <Pressable style={s.row} onPress={() => setSelected(item)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>
                  {item.number} · {item.clientName}
                </Text>
                <Text style={s.rowSub}>Due {formatDate(item.dueDateMs)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.rowAmount}>
                  {formatCents(totalCents(item), item.currencySymbol)}
                </Text>
                <Text style={[s.rowStatus, { color: statusColor(st) }]}>{st}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={s.fab} onPress={handleNew}>
        <Text style={s.fabText}>＋ New invoice</Text>
      </Pressable>

      <Modal
        visible={selected != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={s.sheetBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            {selected && (
              <>
                <Text style={s.sheetTitle}>
                  {selected.number} · {selected.clientName}
                </Text>
                <Text style={s.sheetSub}>
                  {formatCents(totalCents(selected), selected.currencySymbol)}
                </Text>
                <Pressable style={s.sheetBtn} onPress={() => share(selected)}>
                  <Text style={s.sheetBtnText}>Share PDF</Text>
                </Pressable>
                {selected.status !== 'paid' && (
                  <Pressable style={s.sheetBtn} onPress={() => markPaid(selected)}>
                    <Text style={s.sheetBtnText}>Mark as paid</Text>
                  </Pressable>
                )}
                <Pressable style={s.sheetBtn} onPress={() => remove(selected)}>
                  <Text style={[s.sheetBtnText, { color: T.danger }]}>Delete</Text>
                </Pressable>
              </>
            )}
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
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '700', color: T.ink },
  topActions: { flexDirection: 'row', gap: 16 },
  topAction: { color: T.accent, fontSize: 15, fontWeight: '600' },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: T.faint,
  },
  chipOn: { backgroundColor: T.accent },
  chipText: { color: T.ink, fontSize: 13 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: T.muted, marginTop: 64, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
    alignItems: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: T.ink },
  rowSub: { fontSize: 13, color: T.muted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: T.ink },
  rowStatus: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: T.accent,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: T.ink },
  sheetSub: { fontSize: 14, color: T.muted, marginTop: 2, marginBottom: 12 },
  sheetBtn: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.rule,
  },
  sheetBtnText: { fontSize: 16, color: T.accent, fontWeight: '600' },
});
