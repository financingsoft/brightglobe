import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useI18n } from "@/i18n/locale";

function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? "#222222" : "#B8B8B8",
        fontSize: 24,
        lineHeight: 27,
        fontWeight: focused ? "700" : "400"
      }}
    >
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
        tabBarActiveTintColor: "#222222",
        tabBarInactiveTintColor: "#B8B8B8",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: -1, marginBottom: 2 },
        tabBarStyle: {
          height: 60,
          paddingTop: 3,
          paddingBottom: 5,
          borderTopWidth: 1,
          borderTopColor: "#DCDCDC",
          backgroundColor: "#FFFFFF",
          elevation: 0
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("navHome"), tabBarIcon: ({ focused }) => <TabGlyph glyph="⌂" focused={focused} /> }} />
      <Tabs.Screen name="tasks" options={{ title: t("navDiscover"), tabBarIcon: ({ focused }) => <TabGlyph glyph="▤" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("navMe"), tabBarIcon: ({ focused }) => <TabGlyph glyph="♙" focused={focused} /> }} />

      <Tabs.Screen name="rewards" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="wallet" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="force-record" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="announcements" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="invite" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="passport" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="base" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="settings" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="category" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="activity" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="help" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
