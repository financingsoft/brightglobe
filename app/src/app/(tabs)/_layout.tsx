import { Tabs } from "expo-router";
import { View } from "react-native";
import { useI18n } from "@/i18n/locale";

function TabGlyph({ type, focused }: { type: "home" | "tasks" | "me"; focused: boolean }) {
  const color = focused ? "#555555" : "#C4C4C4";
  if (type === "home") {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.roofLeft, { backgroundColor: color }]} />
        <View style={[styles.roofRight, { backgroundColor: color }]} />
        <View style={[styles.houseBody, { borderColor: color, backgroundColor: focused ? color : "transparent" }]}>
          <View style={[styles.houseDoor, { backgroundColor: focused ? "#FFFFFF" : color }]} />
        </View>
      </View>
    );
  }
  if (type === "tasks") {
    return (
      <View style={[styles.taskIcon, { borderColor: color, backgroundColor: focused ? color : "#FFFFFF" }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.taskLineRow}>
            <View style={[styles.taskBullet, { backgroundColor: focused ? "#FFFFFF" : color }]} />
            <View style={[styles.taskLine, { backgroundColor: focused ? "#FFFFFF" : color }]} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.personIcon}>
      <View style={[styles.personHead, { borderColor: color, backgroundColor: focused ? color : "transparent" }]} />
      <View style={[styles.personShoulders, { borderColor: color, backgroundColor: focused ? color : "transparent" }]} />
    </View>
  );
}

export default function TabLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#555555",
        tabBarInactiveTintColor: "#C4C4C4",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: 0, marginBottom: 1 },
        tabBarStyle: {
          height: 60,
          width: "100%",
          maxWidth: 390,
          alignSelf: "center",
          paddingTop: 3,
          paddingBottom: 3,
          borderTopWidth: 1,
          borderTopColor: "#D5D5D5",
          backgroundColor: "#FFFFFF",
          elevation: 0
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("navHome"), tabBarIcon: ({ focused }) => <TabGlyph type="home" focused={focused} /> }} />
      <Tabs.Screen name="tasks" options={{ title: t("navDiscover"), tabBarIcon: ({ focused }) => <TabGlyph type="tasks" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("navMe"), tabBarIcon: ({ focused }) => <TabGlyph type="me" focused={focused} /> }} />

      <Tabs.Screen name="rewards" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="wallet" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="force-record" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="announcements" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="announcement-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
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

const styles = {
  iconBox: { width: 32, height: 29, alignItems: "center" as const, position: "relative" as const },
  roofLeft: { position: "absolute" as const, top: 4, left: 4, width: 17, height: 3, transform: [{ rotate: "-42deg" }] },
  roofRight: { position: "absolute" as const, top: 4, right: 4, width: 17, height: 3, transform: [{ rotate: "42deg" }] },
  houseBody: { position: "absolute" as const, top: 11, width: 22, height: 16, borderWidth: 2, alignItems: "center" as const, justifyContent: "flex-end" as const },
  houseDoor: { width: 6, height: 8 },
  taskIcon: { width: 26, height: 24, borderWidth: 2, borderRadius: 2, paddingHorizontal: 3, justifyContent: "center" as const, gap: 3 },
  taskLineRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
  taskBullet: { width: 3, height: 3, borderRadius: 1.5 },
  taskLine: { flex: 1, height: 2, borderRadius: 1 },
  personIcon: { width: 29, height: 28, alignItems: "center" as const, justifyContent: "flex-end" as const, gap: 1 },
  personHead: { width: 11, height: 11, borderWidth: 2, borderRadius: 5 },
  personShoulders: { width: 25, height: 13, borderWidth: 2, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 0 }
};
