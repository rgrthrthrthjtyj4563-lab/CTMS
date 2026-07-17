import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="workbench" options={{ title: '工作台' }} />
      <Tabs.Screen name="todo" options={{ title: '待办' }} />
      <Tabs.Screen name="hours" options={{ title: '我的' }} />
    </Tabs>
  );
}
