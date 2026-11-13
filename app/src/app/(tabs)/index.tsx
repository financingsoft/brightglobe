import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { EarthBackground } from "@/components/earth/EarthBackground";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

export default function HomeScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const isHomeFocused = useIsFocused();
  const { isAuthenticated } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [pointsTotal, setPointsTotal] = useState(122.90001);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const requireHomeLogin = (action: () => void) => {
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }
    action();
  };
  const openPoints = () => requireHomeLogin(() => router.push("/points-record"));
  const openForce = () => requireHomeLogin(() => router.push("/force-record"));
  const claimDailyReward = () => requireHomeLogin(() => {
    if (!claimed) {
      setClaimed(true);
      setPointsTotal((current) => Number((current + 0.05904).toFixed(5)));
    }
  });
  const activityItems = [
    { key: "shopping", category: "shopping", title: t("淘宝黑钻店", "Taobao rewards"), description: t("淘宝919免单日", "Taobao shopping event") },
    { key: "games", category: "games", title: t("游戏黑钻店", "Game rewards"), description: t("凡人飞仙传", "Featured game") }
  ];

  return (
    <AppScreen>
      <View style={styles.statBar}>
        <Pressable accessibilityRole="button" onPress={openPoints} style={styles.statPill}>
          <Text style={styles.statIcon}>♢</Text>
          <Text style={styles.statLabel}>{t("黑钻", "Points")}</Text>
          <Text style={styles.statValue}>{pointsTotal.toFixed(5)}</Text>
          <Text style={styles.statArrow}>›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={openForce} style={styles.statPill}>
          <Text style={styles.forceIcon}>◯</Text>
          <Text style={styles.statLabel}>{t("原力", "Power")}</Text>
          <Text style={styles.statValue}>500</Text>
          <Text style={styles.statArrow}>›</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={() => requireHomeLogin(() => router.push("/announcements"))} style={styles.noticeBar}>
        <Text style={styles.noticeIcon}>◖</Text>
        <Text numberOfLines={1} style={styles.noticeText}>
          {t("星球秉持共建精神中，欢迎试用并留下宝贵建议", "BrightGlobe community announcement — share your feedback")}
        </Text>
        <Text style={styles.noticeMore}>{t("更多", "More")} ›</Text>
      </Pressable>

      <View style={styles.productionStage}>
        <EarthBackground active={isHomeFocused} />
        <View pointerEvents="none" style={styles.earthEyebrow}>
          <Text style={styles.earthEyebrowTitle}>{t("我们的星球", "OUR PLANET")}</Text>
          <View style={styles.earthEyebrowMeta}>
            <View style={styles.earthLiveDot} />
            <Text style={styles.earthEyebrowText}>{t("真实地球 · 昼夜光照", "LIVE EARTH · DAY / NIGHT")}</Text>
          </View>
        </View>
        <Pressable onPress={() => requireHomeLogin(() => router.push({ pathname: "/category", params: { category: "treasure" } }))} style={styles.mineEntry}>
          <View style={styles.mineOrb}><View style={styles.mineGem} /></View>
          <Text style={styles.mineLabel}>{t("黑钻挖宝", "Point mining")}</Text>
        </Pressable>

        {isAuthenticated && claimed ? (
          <View style={styles.growingValues}>
            <View style={[styles.growingValue, styles.valueOne]}><Text style={styles.smallGem}>♢</Text><Text style={styles.smallValue}>0.05904</Text></View>
            <View style={[styles.growingValue, styles.valueTwo]}><Text style={styles.smallGem}>♢</Text><Text style={styles.smallValue}>0.012333</Text></View>
            <View style={[styles.growingValue, styles.valueThree]}><Text style={styles.smallGem}>♢</Text><Text style={styles.smallValue}>0.05939</Text></View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={claimDailyReward}
            style={styles.growthEntry}
          >
            <Text style={styles.growthGem}>♢</Text>
            <Text style={styles.growthLabel}>
              {isAuthenticated ? t("正在生长中", "Growing") : t("登录后领取", "Sign in to collect")}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityRail}>
        {activityItems.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => requireHomeLogin(() => router.push({ pathname: "/category", params: { category: item.category } }))}
            style={styles.activityTile}
          >
            <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.activityIconCircle}><View style={styles.activityIconInner} /></View>
            <Text style={styles.activityDescription} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.activityLink}>{t("查看", "View")}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => requireHomeLogin(() => router.push("/rewards"))} style={styles.activityMore}>
          <Text style={styles.activityMoreGlyph}>···</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showLoginPrompt} transparent animationType="fade" onRequestClose={() => setShowLoginPrompt(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.loginDialog}>
            <Text style={styles.dialogTitle}>{t("请先登录", "Sign in required")}</Text>
            <Text style={styles.dialogCopy}>
              {t("登录后即可查看并领取每日产生的黑钻。当前为 BrightGlobe 本地预览，不会连接真实账户。", "Sign in to view and collect daily rewards. This BrightGlobe preview is not connected to a live account.")}
            </Text>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setShowLoginPrompt(false)} style={styles.dialogSecondary}>
                <Text style={styles.dialogSecondaryText}>{t("暂不登录", "Not now")}</Text>
              </Pressable>
              <Pressable onPress={() => { setShowLoginPrompt(false); router.push("/login"); }} style={styles.dialogPrimary}>
                <Text style={styles.dialogPrimaryText}>{t("了解账户", "Account info")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  statBar: { flexDirection: "row", gap: 7, marginTop: 10, marginBottom: 16 },
  statPill: { flex: 1, height: 31, borderRadius: 15, borderWidth: 1, borderColor: "#D6D6D6", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 5 },
  statIcon: { color: "#444444", fontSize: 14 },
  forceIcon: { color: "#555555", fontSize: 12 },
  statLabel: { color: "#666666", fontSize: 10 },
  statValue: { color: "#333333", fontSize: 11, fontWeight: "600", flex: 1 },
  statArrow: { color: "#999999", fontSize: 14 },
  noticeBar: { height: 29, borderRadius: 14, borderWidth: 1, borderColor: "#DCDCDC", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 6 },
  noticeIcon: { color: "#777777", fontSize: 12 },
  noticeText: { flex: 1, color: "#777777", fontSize: 9 },
  noticeMore: { color: "#444444", fontSize: 9 },
  productionStage: { height: 316, position: "relative", backgroundColor: "#030C1A", borderRadius: 12, overflow: "hidden", marginTop: 10, marginBottom: 10 },
  earthEyebrow: { position: "absolute", left: 16, top: 17, zIndex: 2, gap: 5 },
  earthEyebrowTitle: { color: "#E3F1FF", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  earthEyebrowMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  earthLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#61D9FF" },
  earthEyebrowText: { color: "#8FAFCF", fontSize: 7, fontWeight: "800", letterSpacing: 1.1 },
  mineEntry: { position: "absolute", left: 16, top: 78, width: 96, alignItems: "flex-start", zIndex: 3 },
  mineOrb: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "rgba(157, 205, 255, 0.9)", backgroundColor: "rgba(10, 31, 54, 0.94)", alignItems: "center", justifyContent: "center", shadowColor: "#4A9CFF", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  mineGem: { width: 11, height: 11, borderWidth: 2, borderColor: "#EAF6FF", transform: [{ rotate: "45deg" }] },
  mineLabel: { color: "#EAF4FF", fontSize: 10, fontWeight: "700", marginTop: 7 },
  growthEntry: { position: "absolute", top: 166, left: 13, width: 116, minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: "rgba(138, 190, 244, 0.3)", backgroundColor: "rgba(5, 19, 36, 0.78)", alignItems: "center", justifyContent: "center", zIndex: 3 },
  growthGem: { color: "#D9EEFF", fontSize: 25, lineHeight: 27 },
  growthLabel: { color: "#C5D9EE", fontSize: 9, fontWeight: "700", marginTop: 2 },
  growingValues: { position: "absolute", left: 12, right: 12, top: 164, bottom: 8, zIndex: 3 },
  growingValue: { position: "absolute", alignItems: "center", gap: 1, minWidth: 66, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 9, borderWidth: 1, borderColor: "rgba(138, 190, 244, 0.25)", backgroundColor: "rgba(5, 19, 36, 0.76)" },
  valueOne: { left: 0, top: 0 },
  valueTwo: { left: 0, top: 43 },
  valueThree: { left: 0, top: 86 },
  smallGem: { color: "#D9EEFF", fontSize: 16, lineHeight: 18 },
  smallValue: { color: "#EAF4FF", fontSize: 7, fontWeight: "700" },
  activityRail: { gap: 15, paddingHorizontal: 8, paddingBottom: 4, alignItems: "flex-start" },
  activityTile: { width: 128, height: 135, backgroundColor: "#F0F0F0", borderRadius: 8, padding: 8, alignItems: "center", justifyContent: "space-around" },
  activityIconCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: "#777777", alignItems: "center", justifyContent: "center" },
  activityIconInner: { width: 22, height: 22, borderRadius: 11, borderWidth: 5, borderColor: "#777777" },
  activityMore: { width: 25, height: 135, alignItems: "center", justifyContent: "center" },
  activityMoreGlyph: { color: "#888888", fontSize: 20, letterSpacing: 1 },
  activityTitle: { color: "#444444", fontSize: 10, fontWeight: "600", textAlign: "center" },
  activityDescription: { color: "#888888", fontSize: 8, textAlign: "center" },
  activityLink: { color: "#555555", fontSize: 9 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.40)", alignItems: "center", justifyContent: "center", padding: 28 },
  loginDialog: { width: "100%", maxWidth: 320, borderRadius: 8, backgroundColor: "#FFFFFF", padding: 20, alignItems: "center" },
  dialogTitle: { color: "#333333", fontSize: 15, fontWeight: "700" },
  dialogCopy: { color: "#777777", fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 12 },
  dialogActions: { flexDirection: "row", gap: 9, width: "100%", marginTop: 18 },
  dialogSecondary: { flex: 1, height: 34, borderRadius: 18, borderWidth: 1, borderColor: "#BDBDBD", justifyContent: "center", alignItems: "center" },
  dialogSecondaryText: { color: "#777777", fontSize: 9 },
  dialogPrimary: { flex: 1, height: 34, borderRadius: 18, backgroundColor: "#5C5C5C", justifyContent: "center", alignItems: "center" },
  dialogPrimaryText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" }
});
