import { Tabs } from 'expo-router';
import { useLocale } from '@/context/LocaleContext';

export default function TabsLayout() {
  const { t } = useLocale();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="wallet"
        options={{ title: t.tabs_wallet, tabBarLabel: t.tabs_wallet }}
      />
      <Tabs.Screen
        name="profit"
        options={{ title: t.tabs_profit, tabBarLabel: t.tabs_profit }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t.tabs_history, tabBarLabel: t.tabs_history }}
      />
    </Tabs>
  );
}
