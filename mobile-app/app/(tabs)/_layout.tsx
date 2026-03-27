import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '@/components/haptic-tab';

// Stats lives inside index.tsx as a modal — no bottom tab needed.
// We keep the Tabs wrapper (required by Expo Router) but hide the tab bar entirely.
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },  // hide the bottom tab bar
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Play'  }} />
      <Tabs.Screen name="explore" options={{ title: 'Stats', href: null }} />
    </Tabs>
  );
}
