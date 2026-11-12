import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useI18n } from "@/i18n/locale";
import { colors } from "@/constants/theme";

function TabGlyph({
  glyph,
  focused
}: {
  glyph: string;
  focused: boolean;
}) {
  return (
    <ViewGlyph glyph={glyph} focused={focused} />
  );
}

function ViewGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? "#FFFFFF" : "#A99AB8",
        fontSize: 18,
        lineHeight: 22,
        fontWeight: focused ? "900" : "500"
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
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#A99AB8",
        tabBarLabelStyle: { fontSize: 9, fontWeight: "800", marginBottom: 3 },
        tabBarStyle: {
          height: 66,
          paddingTop: 7,
          paddingBottom: 7,
          borderTopWidth: 0,
          backgroundColor: colors.purpleNight,
          elevation: 16
        },
        tabBarItemStyle: { paddingTop: 1 }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navHome"),
          tabBarIcon: ({ focused }) => <TabGlyph glyph="◉" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("navDiscover"),
          tabBarIcon: ({ focused }) => <TabGlyph glyph="✣" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: t("navBenefits"),
          tabBarIcon: ({ focused }) => <TabGlyph glyph="✧" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("navMe"),
          tabBarIcon: ({ focused }) => <TabGlyph glyph="◌" focused={focused} />
        }}
      />
    </Tabs>
  );
}
