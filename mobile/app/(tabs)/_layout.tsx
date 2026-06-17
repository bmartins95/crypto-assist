import { Tabs } from 'expo-router';

export default function TabsLayout() {
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
        options={{ title: 'Carteira', tabBarLabel: 'Carteira' }}
      />
      <Tabs.Screen
        name="profit"
        options={{ title: 'Lucro', tabBarLabel: 'Lucro' }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Histórico', tabBarLabel: 'Histórico' }}
      />
    </Tabs>
  );
}
