import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useI18n } from "@/i18n/locale";
import { colors } from "@/constants/theme";

function TabGlyph({
  glyph,
  color,
  focused
}: {
  glyph: string;
  color: string;
  focused: boolean;
}) {
  return (
    <Text
      style={{
        color,
        fontSize: 18,
        lineHeight: 22,
        fontWeight: focused ? "800" : "500"
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
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginBottom: 4 },
        tabBarStyle: {
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.surface
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navHome"),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph glyph="◈" color={color} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("navTasks"),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph glyph="✓" color={color} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: t("navRewards"),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph glyph="✦" color={color} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t("navWallet"),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph glyph="▣" color={color} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("navProfile"),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph glyph="◎" color={color} focused={focused} />
          )
        }}
      />
    </Tabs>
  );
}
