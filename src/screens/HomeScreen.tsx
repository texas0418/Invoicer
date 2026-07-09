// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as db from '../db';
import {
  balanceCents,
  collectedInYear,
  duplicateInvoice,
  effectiveStatus,
  estimateToInvoice,
  formatCents,
  formatDate,
  Invoice,
  paidCents,
  totalCents,
} from '../models';
import { emailPdf, sharePdf } from '../pdf';
import {
  canCreateInvoice,
  cancelReminder,
  FREE_INVOICES_PER_MONTH,
  getBusinessProfile,
  isPro,
  nextInvoiceNumber,
  scheduleDueReminder,
  setPro,
} from '../services';
import { shadow, statusTint, T } from '../theme';

const INVOICE_FILTERS = ['all', 'draft', 'sent', 'paid', 'overdue'] as const;
const ESTIMATE_FILTERS = ['all', 'draft', 'sent', 'accepted', 'declined'] as const;
type Filter = string;

interface Props {
  onNewInvoice: () => void;
  onNewEstimate: () => void;
  onEditInvoice: (inv: Invoice) => void;
  onManage: () => void;
  onSettings: () => void;
}

export default function HomeScreen({ onNewInvoice, onNewEstimate, onEditInvoice, onManage, onSettings }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [mode, setMode] = useState<'invoice' | 'estimate'>('invoice');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [payingFor, setPayingFor] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  const load = useCallback(async () => {
    setInvoices(await db.listInvoices());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const docs = invoices.filter((i) => i.kind === mode);
  const visible =
    filter === 'all' ? docs : docs.filter((i) => effectiveStatus(i) === filter);
  const FILTERS = mode === 'invoice' ? INVOICE_FILTERS : ESTIMATE_FILTERS;

  const headOpen =
    mode === 'invoice'
      ? docs.filter((i) => i.status !== 'paid')
      : docs.filter((i) => i.status === 'draft' || i.status === 'sent');
  const outstanding = headOpen.reduce(
    (s, i) => s + (mode === 'invoice' ? balanceCents(i) : totalCents(i)),
    0,
  );
  const openCount = headOpen.length;
  const symbol = docs[0]?.currencySymbol ?? invoices[0]?.currencySymbol ?? '$';
  const year = new Date().getFullYear();
  const collectedYtd = collectedInYear(invoices, year);

  const handleNew = async () => {
    if (mode === 'estimate') {
      if (await isPro()) {
        onNewEstimate();
        return;
      }
      Alert.alert(
        'Estimates are a Pro feature',
        'Send professional quotes and convert accepted ones to invoices in one tap. One-time purchase — no subscription.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Upgrade',
            onPress: async () => {
              // TODO: replace with RevenueCat purchase flow before launch.
              await setPro(true);
              onNewEstimate();
            },
          },
        ],
      );
      return;
    }
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

  const markSentAndRemind = async (inv: Invoice) => {
    if (inv.status === 'draft' && inv.id != null) {
      await db.setInvoiceStatus(inv.id, 'sent');
      const notifId = await scheduleDueReminder(inv);
      await db.setInvoiceNotificationId(inv.id, notifId);
    }
  };

  const share = async (inv: Invoice) => {
    const biz = await getBusinessProfile();
    await sharePdf(inv, biz);
    await markSentAndRemind(inv);
    setSelected(null);
    load();
  };

  const email = async (inv: Invoice) => {
    const biz = await getBusinessProfile();
    const sentViaMail = await emailPdf(inv, biz);
    if (!sentViaMail) {
      Alert.alert(
        'No mail account',
        'No email account is set up on this device, so the share sheet will open instead.',
        [{ text: 'OK', onPress: () => share(inv) }],
      );
      return;
    }
    await markSentAndRemind(inv);
    setSelected(null);
    load();
  };

  const recordPayment = async (inv: Invoice, amountCents: number, note: string) => {
    if (inv.id == null || amountCents <= 0) return;
    const newStatus = await db.addPayment(
      inv.id,
      amountCents,
      note,
      totalCents(inv),
      inv.status,
    );
    if (newStatus === 'paid') await cancelReminder(inv.notificationId);
    setPayingFor(null);
    setSelected(null);
    load();
  };

  const markPaid = async (inv: Invoice) => {
    await recordPayment(inv, balanceCents(inv), 'Paid in full');
  };

  const openPaymentDialog = (inv: Invoice) => {
    setPayAmount((balanceCents(inv) / 100).toFixed(2));
    setPayNote('');
    setPayingFor(inv);
    setSelected(null);
  };

  const removePayment = async (inv: Invoice, paymentId: number) => {
    if (inv.id == null) return;
    await db.deletePayment(paymentId, inv.id, totalCents(inv));
    setSelected(null);
    load();
  };

  const duplicate = async (inv: Invoice) => {
    if (inv.kind === 'invoice' && !(await canCreateInvoice())) {
      setSelected(null);
      handleNew(); // reuses the paywall dialog
      return;
    }
    const { nextEstimateNumber } = await import('../services');
    const num =
      inv.kind === 'estimate' ? await nextEstimateNumber() : await nextInvoiceNumber();
    const copy = duplicateInvoice(inv, num, Date.now());
    await db.insertInvoice(copy);
    setSelected(null);
    load();
  };

  const convert = async (est: Invoice) => {
    if (!(await canCreateInvoice())) {
      setSelected(null);
      handleNew();
      return;
    }
    const inv = estimateToInvoice(est, await nextInvoiceNumber(), Date.now());
    await db.insertInvoice(inv);
    if (est.id != null) await db.setInvoiceStatus(est.id, 'accepted');
    setSelected(null);
    setMode('invoice');
    setFilter('all');
    load();
  };

  const setStatus = async (inv: Invoice, status: 'accepted' | 'declined') => {
    if (inv.id == null) return;
    await db.setInvoiceStatus(inv.id, status);
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
      {/* Ledger header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.eyebrow}>
            {mode === 'invoice' ? 'OUTSTANDING' : 'OPEN ESTIMATES'}
          </Text>
          <View style={s.headerActions}>
            <Pressable onPress={onManage} hitSlop={8}>
              <Text style={s.headerAction}>Clients</Text>
            </Pressable>
            <Pressable onPress={onSettings} hitSlop={8}>
              <Text style={s.headerAction}>Settings</Text>
            </Pressable>
          </View>
        </View>
        <Text style={s.headline}>{formatCents(outstanding, symbol)}</Text>
        <Text style={s.subline}>
          {openCount === 0
            ? mode === 'invoice'
              ? 'All settled — nothing owed to you'
              : 'No estimates awaiting an answer'
            : `across ${openCount} open ${
                mode === 'invoice'
                  ? openCount === 1 ? 'invoice' : 'invoices'
                  : openCount === 1 ? 'estimate' : 'estimates'
              }`}
        </Text>
        {mode === 'invoice' && (
          <View style={s.ytdRow}>
            <Text style={s.ytdLabel}>Collected in {year}</Text>
            <Text style={s.ytdValue}>{formatCents(collectedYtd, symbol)}</Text>
          </View>
        )}
        <View style={s.modeRow}>
          {(['invoice', 'estimate'] as const).map((mm) => (
            <Pressable
              key={mm}
              style={[s.modeBtn, mode === mm && s.modeBtnOn]}
              onPress={() => {
                setMode(mm);
                setFilter('all');
              }}
            >
              <Text style={[s.modeText, mode === mm && s.modeTextOn]}>
                {mm === 'invoice' ? 'Invoices' : 'Estimates'}
              </Text>
            </Pressable>
          ))}
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
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>
              {mode === 'invoice' ? 'No invoices here yet' : 'No estimates here yet'}
            </Text>
            <Text style={s.emptyBody}>
              {mode === 'invoice'
                ? 'Tap “New invoice” to bill your first client.'
                : 'Tap “New estimate” to quote your next job.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = effectiveStatus(item);
          const tint = statusTint(st);
          return (
            <Pressable style={[s.card, shadow]} onPress={() => setSelected(item)}>
              <View style={s.cardTop}>
                <Text style={s.cardClient} numberOfLines={1}>
                  {item.clientName}
                </Text>
                <View style={[s.pill, { backgroundColor: tint.bg }]}>
                  <Text style={[s.pillText, { color: tint.fg }]}>{st}</Text>
                </View>
              </View>
              <Text style={s.cardAmount}>
                {formatCents(
                  paidCents(item) > 0 && item.status !== 'paid'
                    ? balanceCents(item)
                    : totalCents(item),
                  item.currencySymbol,
                )}
              </Text>
              {paidCents(item) > 0 && item.status !== 'paid' && (
                <Text style={s.cardMeta}>
                  of {formatCents(totalCents(item), item.currencySymbol)} —{' '}
                  {formatCents(paidCents(item), item.currencySymbol)} paid
                </Text>
              )}
              <Text style={s.cardMeta}>
                {item.number} ·{' '}
                {item.kind === 'estimate' ? 'valid until' : 'due'}{' '}
                {formatDate(item.dueDateMs)}
              </Text>
            </Pressable>
          );
        }}
      />

      <Pressable style={[s.fab, shadow]} onPress={handleNew}>
        <Text style={s.fabText}>
          ＋ {mode === 'invoice' ? 'New invoice' : 'New estimate'}
        </Text>
      </Pressable>

      <Modal
        visible={selected != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={s.sheetBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.grabber} />
            {selected && (
              <>
                <Text style={s.sheetTitle}>{selected.clientName}</Text>
                <Text style={s.sheetSub}>
                  {selected.number} ·{' '}
                  {paidCents(selected) > 0 && selected.status !== 'paid'
                    ? `${formatCents(balanceCents(selected), selected.currencySymbol)} remaining of ${formatCents(totalCents(selected), selected.currencySymbol)}`
                    : formatCents(totalCents(selected), selected.currencySymbol)}
                </Text>
                <Pressable style={s.sheetPrimary} onPress={() => email(selected)}>
                  <Text style={s.sheetPrimaryText}>Email to client</Text>
                </Pressable>
                <Pressable style={s.sheetBtn} onPress={() => share(selected)}>
                  <Text style={s.sheetBtnText}>Share PDF…</Text>
                </Pressable>
                {selected.status !== 'paid' &&
                  selected.status !== 'accepted' &&
                  selected.status !== 'declined' && (
                    <Pressable
                      style={s.sheetBtn}
                      onPress={() => {
                        setSelected(null);
                        onEditInvoice(selected);
                      }}
                    >
                      <Text style={s.sheetBtnText}>Edit</Text>
                    </Pressable>
                  )}
                <Pressable style={s.sheetBtn} onPress={() => duplicate(selected)}>
                  <Text style={s.sheetBtnText}>Duplicate</Text>
                </Pressable>
                {selected.kind === 'estimate' &&
                  selected.status !== 'accepted' &&
                  selected.status !== 'declined' && (
                    <>
                      <Pressable style={s.sheetBtn} onPress={() => convert(selected)}>
                        <Text style={s.sheetBtnText}>Convert to invoice</Text>
                      </Pressable>
                      <Pressable
                        style={s.sheetBtn}
                        onPress={() => setStatus(selected, 'declined')}
                      >
                        <Text style={s.sheetBtnText}>Mark declined</Text>
                      </Pressable>
                    </>
                  )}
                {selected.kind === 'invoice' && selected.status !== 'paid' && (
                  <>
                    <Pressable
                      style={s.sheetBtn}
                      onPress={() => openPaymentDialog(selected)}
                    >
                      <Text style={s.sheetBtnText}>Record payment…</Text>
                    </Pressable>
                    <Pressable style={s.sheetBtn} onPress={() => markPaid(selected)}>
                      <Text style={s.sheetBtnText}>Mark as paid</Text>
                    </Pressable>
                  </>
                )}
                {selected.kind === 'invoice' && selected.payments.length > 0 && (
                  <View style={s.history}>
                    <Text style={s.historyTitle}>PAYMENTS</Text>
                    {selected.payments.map((p) => (
                      <View key={p.id} style={s.historyRow}>
                        <Text style={s.historyText}>
                          {formatDate(p.paidAtMs)} ·{' '}
                          {formatCents(p.amountCents, selected.currencySymbol)}
                          {p.note ? ` — ${p.note}` : ''}
                        </Text>
                        <Pressable
                          hitSlop={8}
                          onPress={() => p.id != null && removePayment(selected, p.id)}
                        >
                          <Text style={{ color: T.danger, fontSize: 15 }}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <Pressable style={s.sheetBtn} onPress={() => remove(selected)}>
                  <Text style={[s.sheetBtnText, { color: T.danger }]}>
                    Delete invoice
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Record payment dialog */}
      <Modal visible={payingFor != null} transparent animationType="fade">
        <Pressable style={s.payBackdrop} onPress={() => setPayingFor(null)}>
          <Pressable style={s.payDialog} onPress={() => {}}>
            {payingFor && (
              <>
                <Text style={s.payTitle}>Record payment</Text>
                <Text style={s.paySub}>
                  {payingFor.number} —{' '}
                  {formatCents(balanceCents(payingFor), payingFor.currencySymbol)}{' '}
                  outstanding
                </Text>
                <TextInput
                  style={s.payInput}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="decimal-pad"
                  placeholder="Amount"
                  placeholderTextColor={T.muted}
                />
                <TextInput
                  style={s.payInput}
                  value={payNote}
                  onChangeText={setPayNote}
                  placeholder="Note (optional, e.g. bank transfer)"
                  placeholderTextColor={T.muted}
                />
                <Pressable
                  style={s.payBtn}
                  onPress={() =>
                    recordPayment(
                      payingFor,
                      Math.round((parseFloat(payAmount) || 0) * 100),
                      payNote.trim(),
                    )
                  }
                >
                  <Text style={s.payBtnText}>Save payment</Text>
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
  header: {
    backgroundColor: T.ink,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    borderBottomLeftRadius: T.rLg,
    borderBottomRightRadius: T.rLg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  headerActions: { flexDirection: 'row', gap: 18 },
  headerAction: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  headline: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  subline: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 },
  ytdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  ytdLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5 },
  ytdValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modeRow: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  modeBtnOn: { backgroundColor: '#fff' },
  modeText: { color: 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: '600' },
  modeTextOn: { color: T.ink },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: T.card,
  },
  chipOn: { backgroundColor: T.ink },
  chipText: { color: T.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  emptyWrap: { alignItems: 'center', marginTop: 56 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: T.ink },
  emptyBody: { fontSize: 13, color: T.muted, marginTop: 6 },
  card: {
    backgroundColor: T.card,
    borderRadius: T.rMd,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardClient: { fontSize: 15, fontWeight: '700', color: T.ink, flex: 1, marginRight: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: T.ink,
    marginTop: 8,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  cardMeta: { fontSize: 12.5, color: T.muted, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: T.accent,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 15,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,19,34,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: T.rLg,
    borderTopRightRadius: T.rLg,
    padding: 20,
    paddingBottom: 40,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.rule,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: T.ink },
  sheetSub: { fontSize: 13.5, color: T.muted, marginTop: 3, marginBottom: 16 },
  sheetPrimary: {
    backgroundColor: T.accent,
    borderRadius: T.rMd,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetPrimaryText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  sheetBtn: {
    paddingVertical: 14,
    borderRadius: T.rMd,
    alignItems: 'center',
  },
  sheetBtnText: { fontSize: 15.5, color: T.accent, fontWeight: '600' },
  history: { marginTop: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule },
  historyTitle: { fontSize: 10, letterSpacing: 1.5, color: T.muted, fontWeight: '700', marginBottom: 6 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  historyText: { fontSize: 13.5, color: T.ink, flex: 1, marginRight: 10 },
  payBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,19,34,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  payDialog: { backgroundColor: T.card, borderRadius: 18, padding: 20 },
  payTitle: { fontSize: 17, fontWeight: '700', color: T.ink },
  paySub: { fontSize: 13, color: T.muted, marginTop: 3, marginBottom: 14 },
  payInput: {
    backgroundColor: T.faint,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: T.ink,
    marginBottom: 10,
  },
  payBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
