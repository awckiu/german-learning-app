import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { colors } from '@/constants/theme';

// Android Material Symbols names for each tab.
const tabs = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'lessons', title: 'Lessons', icon: 'menu_book' },
  { name: 'activities', title: 'Activities', icon: 'grid_view' },
  { name: 'review', title: 'Review', icon: 'style' },
  { name: 'you', title: 'You', icon: 'person' },
] as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ android: tab.icon }} tintColor={color} size={26} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
