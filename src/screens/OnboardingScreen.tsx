// src/screens/OnboardingScreen.tsx
// First-run setup: 30 seconds, three things, skippable. The goal is that the
// user's first invoice carries their real name, logo, and tax rate.

import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  saveBusinessProfile,
  setDefaultTaxRate,
  setLogoUri,
  setOnboarded,
} from '../services';
import { shadow, T } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tax, setTax] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickLogo = async () => {
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
    setLogo(dest);
  };

  const finish = async (skip: boolean) => {
    setSaving(true);
    if (!skip) {
      if (name.trim() || email.trim()) {
        await saveBusinessProfile({
          name: name.trim() || 'Your Business',
          address: '',
          email: email.trim(),
          phone: '',
        });
      }
      const taxNum = parseFloat(tax);
      if (!isNaN(taxNum) && taxNum >= 0) await setDefaultTaxRate(taxNum / 100);
      if (logo) await setLogoUri(logo);
    }
    await setOnboarded();
    onDone();
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: 48 + insets.top, paddingBottom: 48 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={s.kicker}>WELCOME</Text>
        <Text style={s.title}>Let's set up your invoices</Text>
        <Text style={s.sub}>
          Three quick things — they appear on every invoice you send. You can
          change any of this later in Settings.
        </Text>

        <View style={[s.card, shadow]}>
          <Text style={s.label}>Business or your name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rivera Design Studio"
            placeholderTextColor={T.muted}
          />

          <Text style={s.label}>Email (shown to clients)</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={T.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={s.label}>Default tax rate — leave blank if none</Text>
          <TextInput
            style={s.input}
            value={tax}
            onChangeText={setTax}
            placeholder="e.g. 12.5"
            placeholderTextColor={T.muted}
            keyboardType="decimal-pad"
          />

          <Text style={s.label}>Logo (optional)</Text>
          {logo ? (
            <View style={s.logoRow}>
              <Image source={{ uri: logo }} style={s.logoPreview} resizeMode="contain" />
              <Pressable onPress={() => setLogo(null)} hitSlop={8}>
                <Text style={{ color: T.danger, fontWeight: '600' }}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={s.logoBtn} onPress={pickLogo}>
              <Text style={s.logoBtnText}>Choose a logo…</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[s.primary, shadow]}
          disabled={saving}
          onPress={() => finish(false)}
        >
          <Text style={s.primaryText}>Start invoicing</Text>
        </Pressable>
        <Pressable onPress={() => finish(true)} disabled={saving} hitSlop={8}>
          <Text style={s.skip}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.ink },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  kicker: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 8 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  card: {
    backgroundColor: T.card,
    borderRadius: T.rLg,
    padding: 18,
    marginTop: 24,
  },
  label: { fontSize: 12, color: T.muted, marginTop: 14, marginBottom: 4 },
  input: {
    backgroundColor: T.faint,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: T.ink,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  logoPreview: { width: 120, height: 56, backgroundColor: T.faint, borderRadius: 8 },
  logoBtn: {
    backgroundColor: T.faint,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoBtnText: { color: T.accent, fontWeight: '600', fontSize: 14.5 },
  primary: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skip: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 18,
    fontSize: 14,
    fontWeight: '600',
  },
});
