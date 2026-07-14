import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../src/theme";

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 12, color: focused ? colors.primary : colors.muted, fontWeight: focused ? "600" : "400" }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: "600", color: colors.text },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: "今日任务",
          tabBarLabel: ({ focused }) => <TabLabel label="任务" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="symptom"
        options={{
          title: "症状上报",
          tabBarLabel: ({ focused }) => <TabLabel label="症状" focused={focused} />,
        }}
      />
    </Tabs>
  );
}