// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FREE_TEMPLATE_ID, TEMPLATES } from '../invoiceHtml';
import { exportBackup, restoreBackup } from '../backup';
// TEMP (screenshots): remove this import and the Developer block below to delete.
import { clearSampleData, seedSampleData } from '../devSeed';
import { purchasePro, restorePurchases } from '../purchases';
import { FREE_INVOICES_PER_MONTH, hasProAccess } from '../proAccess';
import {
  getBusinessProfile,
  getCurrencySymbol,
  getDefaultPaymentLink,
  getDefaultTaxRate,
  getLogoUri,
  getTemplate,
  isPro,
  saveBusinessProfile,
  setLogoUri,
  setPro,
  setTemplate,
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
  const [template, setTemplateState] = useState('classic');
  const [logo, setLogoState] = useState<string | null>(null);

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
      setProState(await hasProAccess());
      setTemplateState(await getTemplate());
      setLogoState(await getLogoUri());
    })();
  }, []);

  const requirePro = (then: () => void) => {
    if (pro) {
      then();
      return;
    }
    Alert.alert(
      'Pro feature',
      'All 17 templates are part of Pro. $19.99 once — no subscription.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: async () => {
            const res = await purchasePro();
            if (res.ok) {
              setProState(true);
              then();
              return;
            }
            if ('cancelled' in res) return;
            if ('unavailable' in res) {
              if (__DEV__) {
                await setPro(true);
                setProState(true);
                then();
                return;
              }
              Alert.alert('Purchases unavailable', 'Please try again later.');
              return;
            }
            Alert.alert('Purchase failed', res.error);
          },
        },
      ],
    );
  };

  const chooseTemplate = (id: string) => {
    if (id === FREE_TEMPLATE_ID) {
      setTemplateState(id);
      setTemplate(id);
      return;
    }
    requirePro(() => {
      setTemplateState(id);
      setTemplate(id);
    });
  };

  const pickLogo = async () => {
    {
      const ImagePicker = await import('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (res.canceled || res.assets.length === 0) return;
      const src = res.assets[0].uri;
      const FileSystem = await import('expo-file-system/legacy');
      const ext = src.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
      const dest = `${FileSystem.documentDirectory}logo.${ext}`;
      await FileSystem.copyAsync({ from: src, to: dest });
      await setLogoUri(dest);
      setLogoState(dest);
    }
  };

  const removeLogo = async () => {
    await setLogoUri(null);
    setLogoState(null);
  };

  const doExport = async () => {
    try {
      await exportBackup();
    } catch {
      Alert.alert('Export failed', 'Could not create the backup file. Please try again.');
    }
  };

  const doRestore = () => {
    Alert.alert(
      'Restore from backup?',
      'This replaces ALL current data — invoices, clients, items, and settings — with the contents of the backup file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace everything',
          style: 'destructive',
          onPress: async () => {
            const res = await restoreBackup();
            if (res.ok) {
              Alert.alert(
                'Restore complete',
                `Restored ${res.counts.invoices} invoices, ${res.counts.clients} clients, and ${res.counts.items} saved items.`,
              );
              onDone(); // back to Home, which reloads
            } else if (!('cancelled' in res)) {
              Alert.alert('Restore failed', res.error);
            }
          },
        },
      ],
    );
  };

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

        <Text style={s.section}>Invoice template</Text>
        <View style={s.templateGrid}>
          {TEMPLATES.map((t) => (
            <Pressable
              key={t.id}
              style={[s.templateCard, template === t.id && s.templateCardOn]}
              onPress={() => chooseTemplate(t.id)}
            >
              <View style={s.swatchRow}>
                <View style={[s.swatch, { backgroundColor: t.swatch[0] }]} />
                <View
                  style={[
                    s.swatch,
                    { backgroundColor: t.swatch[1], borderWidth: 1, borderColor: T.rule },
                  ]}
                />
              </View>
              <Text
                style={[s.templateName, template === t.id && s.templateNameOn]}
                numberOfLines={1}
              >
                {t.name}
                {t.id !== FREE_TEMPLATE_ID && !pro ? ' ✦' : ''}
              </Text>
              <Text style={s.templateBlurb} numberOfLines={1}>{t.blurb}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.section}>Logo</Text>
        {logo ? (
          <View style={s.logoRow}>
            <Image source={{ uri: logo }} style={s.logoPreview} resizeMode="contain" />
            <Pressable onPress={removeLogo} hitSlop={8}>
              <Text style={{ color: T.danger, fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.logoBtn} onPress={pickLogo}>
            <Text style={s.logoBtnText}>Choose a logo…</Text>
          </Pressable>
        )}
        <Text style={s.hint}>Appears at the top of every invoice PDF.</Text>

        <Text style={s.section}>Backup</Text>
        <Text style={s.hint}>
          Your data lives only on this device. Export a backup regularly and
          keep it somewhere safe.
        </Text>
        <Pressable style={s.logoBtn} onPress={doExport}>
          <Text style={s.logoBtnText}>Export backup…</Text>
        </Pressable>
        <Pressable style={[s.logoBtn, { marginTop: 8 }]} onPress={doRestore}>
          <Text style={[s.logoBtnText, { color: T.danger }]}>Restore from backup…</Text>
        </Pressable>

        <Text style={s.section}>Plan</Text>
        {!pro && (
          <Pressable
            style={s.upgradeBtn}
            onPress={async () => {
              const res = await purchasePro();
              if (res.ok) {
                setProState(true);
                Alert.alert('Welcome to Pro', 'Everything is unlocked. Thank you!');
                return;
              }
              if ('cancelled' in res) return;
              if ('unavailable' in res) {
                if (__DEV__) {
                  await setPro(true);
                  setProState(true);
                  return;
                }
                Alert.alert('Purchases unavailable', 'Please try again later.');
                return;
              }
              Alert.alert('Purchase failed', res.error);
            }}
          >
            <Text style={s.upgradeBtnText}>Upgrade to Billowe Pro — $19.99</Text>
            <Text style={s.upgradeBtnSub}>
              Unlimited invoices · 16 more templates · estimates · one-time
            </Text>
          </Pressable>
        )}
        {!pro && (
          <Pressable
            style={s.logoBtn}
            onPress={async () => {
              const res = await restorePurchases();
              if (res.ok) {
                setProState(true);
                Alert.alert('Restored', 'Pro is unlocked on this device.');
              } else if ('error' in res) {
                Alert.alert('Restore', res.error);
              } else if ('unavailable' in res) {
                Alert.alert('Restore', 'Purchases are unavailable in this build.');
              }
            }}
          >
            <Text style={s.logoBtnText}>Restore Purchases</Text>
          </Pressable>
        )}
        <Text style={s.plan}>
          {pro
            ? 'Pro — unlimited invoices'
            : `Free — ${FREE_INVOICES_PER_MONTH} invoices/month`}
        </Text>

        {/* TEMP (screenshots) — dev-only; never ships in release builds. */}
        {__DEV__ && (
          <>
            <Text style={s.section}>Developer</Text>
            <Pressable
              style={s.logoBtn}
              onPress={() =>
                Alert.alert(
                  'Seed sample data?',
                  'This REPLACES all current data with a sample set for screenshots.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Seed',
                      style: 'destructive',
                      onPress: async () => {
                        await seedSampleData();
                        Alert.alert('Done', 'Sample data loaded.', [
                          { text: 'OK', onPress: onDone },
                        ]);
                      },
                    },
                  ],
                )
              }
            >
              <Text style={s.logoBtnText}>Seed sample data</Text>
            </Pressable>
            <Pressable
              style={[s.logoBtn, { marginTop: 8 }]}
              onPress={() =>
                Alert.alert('Clear all data?', 'Deletes every invoice, estimate, client, and item.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      await clearSampleData();
                      Alert.alert('Cleared', 'All data removed.', [
                        { text: 'OK', onPress: onDone },
                      ]);
                    },
                  },
                ])
              }
            >
              <Text style={[s.logoBtnText, { color: T.danger }]}>Clear all data</Text>
            </Pressable>
          </>
        )}
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
    borderWidth: 0,
    backgroundColor: T.faint,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: T.ink,
  },
  plan: { fontSize: 14, color: T.muted, marginTop: 6 },
  upgradeBtn: {
    backgroundColor: T.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  upgradeBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: 3 },
  hint: { fontSize: 12, color: T.muted, marginTop: 6 },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  templateCard: {
    width: '31%',
    backgroundColor: T.faint,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  templateCardOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
  templateName: { fontSize: 12, fontWeight: '700', color: T.ink },
  templateNameOn: { color: T.accent },
  templateBlurb: { fontSize: 9.5, color: T.muted, marginTop: 2 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  logoPreview: { width: 120, height: 56, backgroundColor: T.faint, borderRadius: 8 },
  logoBtn: {
    backgroundColor: T.faint,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  logoBtnText: { color: T.accent, fontWeight: '600', fontSize: 14.5 },
});
