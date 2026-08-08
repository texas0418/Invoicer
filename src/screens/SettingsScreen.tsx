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
import { FREE_TEMPLATE_ID, TemplateDef, TEMPLATES } from '../invoiceHtml';
import { exportBackup, restoreBackup } from '../backup';
import { previewTemplate } from '../pdf';
import { purchasePro, restorePurchases, subscribeProStatus } from '../purchases';
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

// Templates grouped by structural layout: the picker shows one card per layout
// family (with a mini-preview of the structure) and colour chips for its
// themes, so users choose by what the invoice actually looks like.
const LAYOUT_ORDER = ['classic', 'minimal', 'bold', 'band', 'ledger'] as const;
const LAYOUT_LABEL: Record<string, string> = {
  classic: 'Classic',
  minimal: 'Minimal',
  bold: 'Bold',
  band: 'Banner',
  ledger: 'Ledger',
};
const FAMILIES = LAYOUT_ORDER.map((layout) => ({
  layout,
  variants: TEMPLATES.filter((t) => t.layout === layout),
})).filter((f) => f.variants.length > 0);

const GREY = '#e2e5ea';
const HEAD = '#cbd0d8';

/** A tiny stylised rendering of a layout's structure, coloured by the given
 *  template's theme. Purely decorative — no real invoice data. */
function LayoutThumb({ def }: { def: TemplateDef }) {
  const accent = def.theme.accent;
  const band = def.theme.band ?? def.theme.ink;
  const tint = accent + '22'; // 8-digit hex = ~13% alpha

  if (def.layout === 'minimal') {
    return (
      <View style={s.thumb}>
        <View style={s.thumbPad}>
          <View style={{ width: 20, height: 5, backgroundColor: HEAD, borderRadius: 2 }} />
          <View style={{ height: 1.5, backgroundColor: accent, marginTop: 7 }} />
          <View style={{ height: 2.5, width: '70%', backgroundColor: GREY, borderRadius: 1.5, marginTop: 14 }} />
          <View style={{ height: 2.5, width: '88%', backgroundColor: GREY, borderRadius: 1.5, marginTop: 7 }} />
          <View style={{ height: 2.5, width: '50%', backgroundColor: GREY, borderRadius: 1.5, marginTop: 7 }} />
        </View>
      </View>
    );
  }

  if (def.layout === 'bold') {
    return (
      <View style={s.thumb}>
        <View style={{ height: 24, backgroundColor: band, paddingHorizontal: 7, justifyContent: 'center' }}>
          <View style={{ width: 12, height: 6, backgroundColor: accent, borderRadius: 2, alignSelf: 'flex-end' }} />
        </View>
        <View style={s.thumbPadTight}>
          <View style={{ height: 12, backgroundColor: tint, borderRadius: 3 }} />
          <View style={{ height: 3, backgroundColor: GREY, borderRadius: 1.5, marginTop: 7 }} />
          <View style={{ height: 3, backgroundColor: GREY, borderRadius: 1.5, marginTop: 5 }} />
          <View style={{ height: 3, width: '60%', backgroundColor: GREY, borderRadius: 1.5, marginTop: 5 }} />
        </View>
      </View>
    );
  }

  if (def.layout === 'band') {
    return (
      <View style={s.thumb}>
        <View style={{ height: 20, backgroundColor: band, justifyContent: 'center', paddingHorizontal: 7 }}>
          <View style={{ width: 22, height: 6, backgroundColor: '#ffffffcc', borderRadius: 2 }} />
        </View>
        <View style={s.thumbPadTight}>
          <View style={{ height: 9, backgroundColor: tint, borderLeftWidth: 3, borderLeftColor: accent }} />
          <View style={{ height: 7, backgroundColor: GREY, marginTop: 6 }} />
          <View style={{ height: 7, backgroundColor: '#fff' }} />
          <View style={{ height: 7, backgroundColor: GREY }} />
        </View>
      </View>
    );
  }

  if (def.layout === 'ledger') {
    const cell = { flex: 1, height: 10, borderWidth: 1, borderColor: GREY } as const;
    return (
      <View style={s.thumb}>
        <View style={s.thumbPad}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: accent, paddingBottom: 4 }}>
            <View style={{ width: 16, height: 5, backgroundColor: HEAD, borderRadius: 2 }} />
            <View style={{ width: 10, height: 5, backgroundColor: accent, borderRadius: 2 }} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <View style={cell} />
            <View style={[cell, { borderLeftWidth: 0 }]} />
            <View style={[cell, { borderLeftWidth: 0 }]} />
          </View>
          <View style={{ height: 6, backgroundColor: accent, marginTop: 6 }} />
          <View style={{ borderWidth: 1, borderColor: GREY, borderTopWidth: 0, height: 20 }}>
            <View style={{ height: 1, backgroundColor: GREY, marginTop: 6 }} />
            <View style={{ height: 1, backgroundColor: GREY, marginTop: 5 }} />
          </View>
        </View>
      </View>
    );
  }

  // classic
  return (
    <View style={s.thumb}>
      <View style={s.thumbPad}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ width: 18, height: 5, backgroundColor: HEAD, borderRadius: 2 }} />
          <View style={{ width: 12, height: 6, backgroundColor: accent, borderRadius: 2 }} />
        </View>
        <View style={{ height: 15, backgroundColor: tint, borderRadius: 3, marginTop: 7 }} />
        <View style={{ height: 2, backgroundColor: accent, marginTop: 8 }} />
        <View style={{ height: 3, backgroundColor: GREY, borderRadius: 1.5, marginTop: 6 }} />
        <View style={{ height: 3, backgroundColor: GREY, borderRadius: 1.5, marginTop: 5 }} />
        <View style={{ height: 3, width: '60%', backgroundColor: GREY, borderRadius: 1.5, marginTop: 5 }} />
      </View>
    </View>
  );
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
    // Flip the Upgrade button live when RevenueCat confirms the entitlement —
    // e.g. a purchase whose receipt syncs a few seconds later on weak wifi.
    const unsub = subscribeProStatus((entitled) => {
      if (entitled) setProState(true);
    });
    return unsub;
  }, []);

  const requirePro = (then: () => void, previewId?: string) => {
    if (pro) {
      then();
      return;
    }
    Alert.alert(
      'Pro template',
      'Preview any template. Unlock all 17 with Billowe Pro — $19.99 once, no subscription.',
      [
        { text: 'Not now', style: 'cancel' },
        ...(previewId
          ? [
              {
                text: 'Preview',
                onPress: () => {
                  previewTemplate(previewId).catch(() => {});
                },
              },
            ]
          : []),
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
            if ('pending' in res) {
              Alert.alert('Purchase received', 'Unlocking Pro… this can take a moment on a slow connection.');
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
    }, id);
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
        <View style={{ gap: 8, marginTop: 6 }}>
          {FAMILIES.map(({ layout, variants }) => {
            const active = variants.find((v) => v.id === template) ?? variants[0];
            const selectedHere = variants.some((v) => v.id === template);
            const current = variants.find((v) => v.id === template);
            return (
              <View
                key={layout}
                style={[s.familyCard, selectedHere && s.familyCardOn]}
              >
                <LayoutThumb def={active} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.familyName}>{LAYOUT_LABEL[layout]}</Text>
                  <Text style={s.familyBlurb} numberOfLines={1}>
                    {current ? current.name : `${variants.length} colours`}
                  </Text>
                  <View style={s.chipRow}>
                    {variants.map((v) => {
                      const on = v.id === template;
                      const locked = v.id !== FREE_TEMPLATE_ID && !pro;
                      return (
                        <Pressable
                          key={v.id}
                          onPress={() => chooseTemplate(v.id)}
                          hitSlop={6}
                          style={[s.chip, on && s.chipOn]}
                        >
                          <View style={[s.chipDot, { backgroundColor: v.swatch[0] }]} />
                          {locked && <Text style={s.chipLock}>✦</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        <Pressable
          style={s.logoBtn}
          onPress={() => previewTemplate(template).catch(() => {})}
        >
          <Text style={s.logoBtnText}>Preview selected template</Text>
        </Pressable>
        <Text style={s.hint}>Opens a sample invoice with your business details.</Text>

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
              if ('pending' in res) {
                Alert.alert('Purchase received', 'Unlocking Pro… this can take a moment on a slow connection. It will unlock automatically.');
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
  familyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  familyCardOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
  familyName: { fontSize: 14, fontWeight: '700', color: T.ink },
  familyBlurb: { fontSize: 11, color: T.muted, marginTop: 1 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipOn: { borderColor: T.accent },
  chipDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#00000010' },
  chipLock: { position: 'absolute', top: -3, right: -3, fontSize: 9, color: T.warn },
  thumb: {
    width: 74,
    height: 92,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.rule,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  thumbPad: { flex: 1, padding: 7 },
  thumbPadTight: { flex: 1, paddingHorizontal: 7, paddingTop: 6 },
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
