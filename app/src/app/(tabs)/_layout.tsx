import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useI18n } from "@/i18n/locale";
import { colors } from "@/constants/theme";

function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{
      color: focused ? "#FFFFFF" : "#9B93A4",
      fontSize: 18,
      lineHeight: 22,
      fontWeight: focused ? "900" : "500"
    }}>
      {glyph}
    </Text>
  );
}

export default function TabLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#9B93A4",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginBottom: 3 },
        tabBarStyle: {
          height: 61,
          paddingTop: 5,
          paddingBottom: 6,
          borderTopWidth: 0,
          backgroundColor: colors.purpleNight,
          elevation: 12
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("navHome"), tabBarIcon: ({ focused }) => <TabGlyph glyph="⌂" focused={focused} /> }} />
      <Tabs.Screen name="tasks" options={{ title: t("navTasks"), tabBarIcon: ({ focused }) => <TabGlyph glyph="▤" focused={focused} /> }} />
      <Tabs.Screen name="rewards" options={{ title: t("navRewards"), tabBarIcon: ({ focused }) => <TabGlyph glyph="◆" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("navProfile"), tabBarIcon: ({ focused }) => <TabGlyph glyph="♙" focused={focused} /> }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
    </Tabs>
  );
}
