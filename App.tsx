// App.tsx — root with minimal hand-rolled navigation (4 screens; avoids
// pulling in react-navigation to keep the dependency surface small).
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import EditorScreen from './src/screens/EditorScreen';
import ManageScreen from './src/screens/ManageScreen';
import SettingsScreen from './src/screens/SettingsScreen';

type Screen = 'home' | 'editor' | 'manage' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  // Key forces Home to remount (and reload data) each time we return to it.
  const [homeKey, setHomeKey] = useState(0);

  const goHome = () => {
    setHomeKey((k) => k + 1);
    setScreen('home');
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {screen === 'home' && (
        <HomeScreen
          key={homeKey}
          onNewInvoice={() => setScreen('editor')}
          onManage={() => setScreen('manage')}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'editor' && <EditorScreen onDone={goHome} />}
      {screen === 'manage' && <ManageScreen onDone={goHome} />}
      {screen === 'settings' && <SettingsScreen onDone={goHome} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
});
