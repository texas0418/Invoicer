// src/screens/EditorScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as db from '../db';
import {
  CatalogItem,
  Client,
  formatCents,
  formatDate,
  Invoice,
  LineItem,
  lineAmountCents,
} from '../models';
import {
  getCurrencySymbol,
  getDefaultPaymentLink,
  getDefaultTaxRate,
  nextInvoiceNumber,
} from '../services';
import { T } from '../theme';

interface Props {
  onDone: (saved: boolean) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function EditorScreen({ onDone }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [dueDays, setDueDays] = useState('14');
  const [taxPct, setTaxPct] = useState('0');
  const [discount, setDiscount] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('$');
  const [pickerOpen, setPickerOpen] = useState<'client' | 'line' | null>(null);
  const [saving, setSaving] = useState(false);

  // line dialog fields
  const [lDesc, setLDesc] = useState('');
  const [lQty, setLQty] = useState('1');
  const [lPrice, setLPrice] = useState('');

  useEffect(() => {
    (async () => {
      setClients(await db.listClients());
      setCatalog(await db.listItems());
      setTaxPct(((await getDefaultTaxRate()) * 100).toString());
      setPaymentLink(await getDefaultPaymentLink());
      setCurrency(await getCurrencySymbol());
    })();
  }, []);

  const taxRate = (parseFloat(taxPct) || 0) / 100;
  const discountCents = Math.round((parseFloat(discount) || 0) * 100);
  const subtotal = lines.reduce((s, l) => s + lineAmountCents(l), 0);
  const tax = Math.round((subtotal - discountCents) * taxRate);
  const total = subtotal - discountCents + tax;
  const dueDateMs =
    Date.now() + (parseInt(dueDays, 10) > 0 ? parseInt(dueDays, 10) : 14) * DAY_MS;

  const addLine = () => {
    const qty = parseFloat(lQty) || 0;
    const price = Math.round((parseFloat(lPrice) || 0) * 100);
    if (!lDesc.trim() || qty <= 0 || price < 0) return;
    setLines([
      ...lines,
      { description: lDesc.trim(), quantity: qty, unitPriceCents: price },
    ]);
    setLDesc('');
    setLQty('1');
    setLPrice('');
    setPickerOpen(null);
  };

  const save = async () => {
    if (!client || lines.length === 0) {
      Alert.alert('Missing details', 'Pick a client and add at least one line item.');
      return;
    }
    setSaving(true);
    const inv: Invoice = {
      number: await nextInvoiceNumber(),
      issueDateMs: Date.now(),
      dueDateMs,
      clientName: client.name,
      clientAddress: client.address,
      clientEmail: client.email,
      taxRate,
      discountCents,
      currencySymbol: currency,
      paymentLink: paymentLink.trim(),
      notes: notes.trim(),
      status: 'draft',
      notificationId: null,
      items: lines,
    };
    await db.insertInvoice(inv);
    onDone(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.topBar}>
        <Pressable onPress={() => onDone(false)} hitSlop={8}>
          <Text style={s.topAction}>Cancel</Text>
        </Pressable>
        <Text style={s.title}>New invoice</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={8}>
          <Text style={[s.topAction, { fontWeight: '700' }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 64 }}>
        <Text style={s.label}>Client</Text>
        <Pressable style={s.select} onPress={() => setPickerOpen('client')}>
          <Text style={client ? s.selectText : s.selectPlaceholder}>
            {client ? client.name : 'Choose a client…'}
          </Text>
        </Pressable>
        {clients.length === 0 && (
          <Text style={s.hint}>No clients yet — add one under Clients first.</Text>
        )}

        <Text style={s.label}>Due in (days)</Text>
        <TextInput
          style={s.input}
          value={dueDays}
          onChangeText={setDueDays}
          keyboardType="number-pad"
        />
        <Text style={s.hint}>Due date: {formatDate(dueDateMs)}</Text>

        <View style={s.rowBetween}>
          <Text style={s.sectionTitle}>Line items</Text>
          <Pressable onPress={() => setPickerOpen('line')} hitSlop={8}>
            <Text style={s.topAction}>＋ Add</Text>
          </Pressable>
        </View>
        {lines.map((l, idx) => (
          <View key={idx} style={s.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.lineTitle}>{l.description}</Text>
              <Text style={s.hint}>
                {l.quantity} × {formatCents(l.unitPriceCents, currency)}
              </Text>
            </View>
            <Text style={s.lineAmount}>
              {formatCents(lineAmountCents(l), currency)}
            </Text>
            <Pressable
              onPress={() => setLines(lines.filter((_, i) => i !== idx))}
              hitSlop={8}
            >
              <Text style={{ color: T.danger, fontSize: 18, marginLeft: 12 }}>✕</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Tax %</Text>
            <TextInput
              style={s.input}
              value={taxPct}
              onChangeText={setTaxPct}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Discount</Text>
            <TextInput
              style={s.input}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
        </View>

        <Text style={s.label}>Payment link (Stripe/PayPal URL)</Text>
        <TextInput
          style={s.input}
          value={paymentLink}
          onChangeText={setPaymentLink}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={s.label}>Notes</Text>
        <TextInput
          style={[s.input, { height: 64 }]}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={s.totalsCard}>
          <Row l="Subtotal" v={formatCents(subtotal, currency)} />
          {discountCents > 0 && (
            <Row l="Discount" v={`-${formatCents(discountCents, currency)}`} />
          )}
          {taxRate > 0 && (
            <Row l={`Tax (${(taxRate * 100).toFixed(1)}%)`} v={formatCents(tax, currency)} />
          )}
          <View style={s.divider} />
          <Row l="Total" v={formatCents(total, currency)} bold />
        </View>
      </ScrollView>

      {/* Client picker */}
      <Modal visible={pickerOpen === 'client'} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setPickerOpen(null)}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>Choose client</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {clients.map((c) => (
                <Pressable
                  key={c.id}
                  style={s.dialogRow}
                  onPress={() => {
                    setClient(c);
                    setPickerOpen(null);
                  }}
                >
                  <Text style={s.selectText}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Line item dialog */}
      <Modal visible={pickerOpen === 'line'} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setPickerOpen(null)}>
          <Pressable style={s.dialog} onPress={() => {}}>
            <Text style={s.dialogTitle}>Add line item</Text>
            {catalog.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {catalog.map((ci) => (
                  <Pressable
                    key={ci.id}
                    style={s.chip}
                    onPress={() => {
                      setLDesc(ci.description);
                      setLPrice((ci.unitPriceCents / 100).toFixed(2));
                    }}
                  >
                    <Text style={s.chipText}>{ci.description}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <TextInput
              style={s.input}
              placeholder="Description"
              value={lDesc}
              onChangeText={setLDesc}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Qty"
                value={lQty}
                onChangeText={setLQty}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Unit price"
                value={lPrice}
                onChangeText={setLPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable style={s.primaryBtn} onPress={addLine}>
              <Text style={s.primaryBtnText}>Add</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <View style={s.rowBetween}>
      <Text style={[s.totLabel, bold && s.bold]}>{l}</Text>
      <Text style={[s.totValue, bold && s.bold]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
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
  label: { fontSize: 12, color: T.muted, marginTop: 14, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: T.ink,
    marginBottom: 4,
  },
  select: {
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectText: { fontSize: 15, color: T.ink },
  selectPlaceholder: { fontSize: 15, color: T.muted },
  hint: { fontSize: 12, color: T.muted, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: T.ink },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
  },
  lineTitle: { fontSize: 14, color: T.ink },
  lineAmount: { fontSize: 14, fontWeight: '600', color: T.ink },
  totalsCard: {
    backgroundColor: T.faint,
    borderRadius: 10,
    padding: 16,
    marginTop: 24,
  },
  totLabel: { color: T.muted, fontSize: 13 },
  totValue: { color: T.ink, fontSize: 13 },
  bold: { fontWeight: '700', fontSize: 15, color: T.ink },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.rule, marginTop: 10 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: T.bg, borderRadius: 14, padding: 18 },
  dialogTitle: { fontSize: 16, fontWeight: '700', color: T.ink, marginBottom: 10 },
  dialogRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: T.faint,
    marginRight: 8,
  },
  chipText: { color: T.ink, fontSize: 13 },
  primaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
