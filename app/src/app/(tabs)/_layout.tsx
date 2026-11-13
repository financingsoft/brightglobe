import { Tabs } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { useI18n } from "@/i18n/locale";

function TabGlyph({ type, focused }: { type: "home" | "tasks" | "me"; focused: boolean }) {
  const color = focused ? "#EADFFF" : "#7F91B1";
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
      <View style={[styles.taskIcon, { borderColor: color, backgroundColor: focused ? "#7754B8" : "rgba(9, 19, 38, 0.88)" }]}>
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
  const { width, height } = useWindowDimensions();
  const compact = width < 350 || height < 680;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#EADFFF",
        tabBarInactiveTintColor: "#8091AE",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginTop: 0, marginBottom: 1 },
        tabBarStyle: {
          height: compact ? 68 : 76,
          width: "100%",
          maxWidth: 460,
          alignSelf: "center",
          paddingTop: compact ? 3 : 5,
          paddingBottom: compact ? 3 : 5,
          borderTopWidth: 1,
          borderTopColor: "rgba(157, 184, 226, 0.20)",
          backgroundColor: "rgba(4, 11, 27, 0.96)",
          elevation: 0
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("navHome"), tabBarIcon: ({ focused }) => <TabGlyph type="home" focused={focused} /> }} />
      <Tabs.Screen name="tasks" options={{ title: t("navDiscover"), tabBarIcon: ({ focused }) => <TabGlyph type="tasks" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("navMe"), tabBarIcon: ({ focused }) => <TabGlyph type="me" focused={focused} /> }} />

    </Tabs>
  );
}

const styles = {
  iconBox: { width: 44, height: 40, alignItems: "center" as const, position: "relative" as const },
  roofLeft: { position: "absolute" as const, top: 5, left: 5, width: 24, height: 4, transform: [{ rotate: "-42deg" }] },
  roofRight: { position: "absolute" as const, top: 5, right: 5, width: 24, height: 4, transform: [{ rotate: "42deg" }] },
  houseBody: { position: "absolute" as const, top: 15, width: 30, height: 22, borderWidth: 2, alignItems: "center" as const, justifyContent: "flex-end" as const },
  houseDoor: { width: 7, height: 10 },
  taskIcon: { width: 35, height: 32, borderWidth: 2, borderRadius: 2, paddingHorizontal: 4, justifyContent: "center" as const, gap: 3 },
  taskLineRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  taskBullet: { width: 4, height: 4, borderRadius: 1.5 },
  taskLine: { flex: 1, height: 2, borderRadius: 1 },
  personIcon: { width: 40, height: 39, alignItems: "center" as const, justifyContent: "flex-end" as const, gap: 1 },
  personHead: { width: 14, height: 14, borderWidth: 2, borderRadius: 5 },
  personShoulders: { width: 34, height: 18, borderWidth: 2, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 0 }
};
