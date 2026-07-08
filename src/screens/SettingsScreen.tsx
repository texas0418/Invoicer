// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  FREE_INVOICES_PER_MONTH,
  getBusinessProfile,
  getCurrencySymbol,
  getDefaultPaymentLink,
  getDefaultTaxRate,
  isPro,
  saveBusinessProfile,
  setCurrencySymbol,
  setDefaultPaymentLink,
  setDefaultTaxRate,
} from '../services';
import { T } from '../theme';

interface Props {
  onDone: () => void;
}

export default function SettingsScreen({ onDone }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tax, setTax] = useState('0');
  const [link, setLink] = useState('');
  const [currency, setCurrency] = useState('$');
  const [pro, setProState] = useState(false);

  useEffect(() => {
    (async () => {
      const b = await getBusinessProfile();
      setName(b.name);
      setAddress(b.address);
      setEmail(b.email);
      setPhone(b.phone);
      setTax(((await getDefaultTaxRate()) * 100).toString());
      setLink(await getDefaultPaymentLink());
      setCurrency(await getCurrencySymbol());
      setProState(await isPro());
    })();
  }, []);

  const save = async () => {
    await saveBusinessProfile({
      name: name.trim(),
      address: address.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    await setDefaultTaxRate((parseFloat(tax) || 0) / 100);
    await setDefaultPaymentLink(link.trim());
    await setCurrencySymbol(currency.trim());
    onDone();
  };

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={s.topAction}>‹ Back</Text>
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <Pressable onPress={save} hitSlop={8}>
          <Text style={[s.topAction, { fontWeight: '700' }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={s.section}>Business profile</Text>
        <Field label="Business name" value={name} onChange={setName} />
        <Field label="Address" value={address} onChange={setAddress} multiline />
        <Field label="Email" value={email} onChange={setEmail} email />
        <Field label="Phone" value={phone} onChange={setPhone} />

        <Text style={s.section}>Invoice defaults</Text>
        <Field label="Default tax rate (%)" value={tax} onChange={setTax} numeric />
        <Field label="Default payment link" value={link} onChange={setLink} />
        <Field label="Currency symbol" value={currency} onChange={setCurrency} />

        <Text style={s.section}>Plan</Text>
        <Text style={s.plan}>
          {pro
            ? 'Pro — unlimited invoices'
            : `Free — ${FREE_INVOICES_PER_MONTH} invoices/month`}
        </Text>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  numeric,
  email,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  email?: boolean;
}) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { height: 56 }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? 'decimal-pad' : email ? 'email-address' : 'default'}
        autoCapitalize={email ? 'none' : 'sentences'}
      />
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
  section: { fontSize: 15, fontWeight: '700', color: T.ink, marginTop: 20, marginBottom: 4 },
  label: { fontSize: 12, color: T.muted, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: T.ink,
  },
  plan: { fontSize: 14, color: T.muted, marginTop: 6 },
});
