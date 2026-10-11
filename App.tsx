// App.tsx — root with minimal hand-rolled navigation (4 screens; avoids
// pulling in react-navigation to keep the dependency surface small).
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
// react-native's own SafeAreaView is iOS-only: on Android it is a plain View
// and applies no insets, which put the header and the Cancel/Save row under
// the status bar. Each screen now reads the real insets from this provider.
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import EditorScreen from './src/screens/EditorScreen';
import ManageScreen from './src/screens/ManageScreen';
import SettingsScreen from './src/screens/SettingsScreen';

import { useEffect } from 'react';
import { Invoice } from './src/models';
import { hasOnboarded } from './src/services';
import { initPurchases } from './src/purchases';
import OnboardingScreen from './src/screens/OnboardingScreen';

type Screen =
  | { name: 'loading' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'editor'; kind: 'invoice' | 'estimate'; invoice: Invoice | null }
  | { name: 'manage' }
  | { name: 'settings' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });

  useEffect(() => {
    initPurchases();
    hasOnboarded().then((done) =>
      setScreen(done ? { name: 'home' } : { name: 'onboarding' }),
    );
  }, []);
  // Key forces Home to remount (and reload data) each time we return to it.
  const [homeKey, setHomeKey] = useState(0);

  const goHome = () => {
    setHomeKey((k) => k + 1);
    setScreen({ name: 'home' });
  };

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {screen.name === 'onboarding' && <OnboardingScreen onDone={goHome} />}
        {screen.name === 'home' && (
          <HomeScreen
            key={homeKey}
            onNewInvoice={() =>
              setScreen({ name: 'editor', kind: 'invoice', invoice: null })
            }
            onNewEstimate={() =>
              setScreen({ name: 'editor', kind: 'estimate', invoice: null })
            }
            onEditInvoice={(inv) =>
              setScreen({ name: 'editor', kind: inv.kind, invoice: inv })
            }
            onManage={() => setScreen({ name: 'manage' })}
            onSettings={() => setScreen({ name: 'settings' })}
          />
        )}
        {screen.name === 'editor' && (
          <EditorScreen kind={screen.kind} existing={screen.invoice} onDone={goHome} />
        )}
        {screen.name === 'manage' && <ManageScreen onDone={goHome} />}
        {screen.name === 'settings' && <SettingsScreen onDone={goHome} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
});
