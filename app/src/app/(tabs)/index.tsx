import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

export default function HomeScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const requireHomeLogin = (action: () => void) => {
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }
    action();
  };
  const openPoints = () => requireHomeLogin(() => router.push("/wallet"));
  const openForce = () => requireHomeLogin(() => router.push("/force-record"));

  return (
    <AppScreen>
      <View style={styles.statBar}>
        <Pressable accessibilityRole="button" onPress={openPoints} style={styles.statPill}>
          <Text style={styles.statIcon}>♢</Text>
          <Text style={styles.statLabel}>{t("黑钻", "Points")}</Text>
          <Text style={styles.statValue}>122.90001</Text>
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
        <Pressable onPress={() => requireHomeLogin(() => router.push({ pathname: "/activity", params: { title: t("黑钻挖宝", "Point mining") } }))} style={styles.mineEntry}>
          <View style={styles.mineOrb}>
            <Text style={styles.mineGlyph}>◇</Text>
          </View>
          <Text style={styles.mineLabel}>{t("黑钻挖宝", "Point mining")}</Text>
        </Pressable>

        <Pressable onPress={() => setShowLoginPrompt(true)} style={styles.growthEntry}>
          <Text style={styles.growthGem}>♢</Text>
          <Text style={styles.growthLabel}>
            {t("登录后领取", "Sign in to collect")}
          </Text>
        </Pressable>

        <Pressable onPress={() => setShowLoginPrompt(true)} style={styles.growthState}>
          <Text style={styles.growthStateText}>
            {t("点击黑钻，查看领取状态", "Tap the gem to view its status")}
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityRail}>
        <Pressable onPress={() => requireHomeLogin(() => router.push({ pathname: "/category", params: { category: "shopping" } }))} style={styles.activityTile}>
          <View style={styles.activityIconCircle}><Text style={styles.activityGlyph}>◎</Text></View>
          <Text style={styles.activityTitle}>{t("淘宝得黑钻", "Shopping rewards")}</Text>
          <Text style={styles.activityDescription}>{t("淘宝919年中大促", "Featured shopping event")}</Text>
          <Text style={styles.activityLink}>{t("查看", "View")} ›</Text>
        </Pressable>
        <Pressable onPress={() => requireHomeLogin(() => router.push({ pathname: "/category", params: { category: "games" } }))} style={styles.activityTile}>
          <View style={styles.activityIconCircle}><Text style={styles.activityGlyph}>◉</Text></View>
          <Text style={styles.activityTitle}>{t("游戏得黑钻", "Game rewards")}</Text>
          <Text style={styles.activityDescription}>{t("凡人飞仙传", "Featured game")}</Text>
          <Text style={styles.activityLink}>{t("查看", "View")} ›</Text>
        </Pressable>
        <View style={styles.activityMore}><Text style={styles.activityMoreGlyph}>···</Text></View>
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
  statBar: { flexDirection: "row", gap: 7, marginBottom: 7 },
  statPill: { flex: 1, height: 27, borderRadius: 15, borderWidth: 1, borderColor: "#D6D6D6", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 5 },
  statIcon: { color: "#444444", fontSize: 14 },
  forceIcon: { color: "#555555", fontSize: 12 },
  statLabel: { color: "#666666", fontSize: 9 },
  statValue: { color: "#333333", fontSize: 10, fontWeight: "600", flex: 1 },
  statArrow: { color: "#999999", fontSize: 14 },
  noticeBar: { height: 27, borderRadius: 14, borderWidth: 1, borderColor: "#DCDCDC", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 6 },
  noticeIcon: { color: "#777777", fontSize: 12 },
  noticeText: { flex: 1, color: "#777777", fontSize: 8 },
  noticeMore: { color: "#444444", fontSize: 8 },
  productionStage: { height: 245, position: "relative", backgroundColor: "#FFFFFF" },
  mineEntry: { position: "absolute", right: 24, top: 25, width: 67, alignItems: "center" },
  mineOrb: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#777777", alignItems: "center", justifyContent: "center" },
  mineGlyph: { color: "#FFFFFF", fontSize: 23 },
  mineLabel: { color: "#333333", fontSize: 8, marginTop: 4 },
  growthEntry: { position: "absolute", top: 88, left: "43%", alignItems: "center", justifyContent: "center" },
  growthGem: { color: "#4A4A4A", fontSize: 24, lineHeight: 26 },
  growthLabel: { color: "#555555", fontSize: 8, marginTop: 2 },
  growingValues: { position: "absolute", left: 14, right: 14, top: 165, flexDirection: "row", justifyContent: "space-around" },
  growingValue: { alignItems: "center", gap: 2 },
  smallGem: { color: "#555555", fontSize: 16 },
  smallValue: { color: "#555555", fontSize: 7 },
  growthState: { position: "absolute", left: 0, right: 0, bottom: 15, alignItems: "center", paddingVertical: 7 },
  growthStateText: { color: "#777777", fontSize: 8 },
  activityRail: { gap: 7, paddingBottom: 4, alignItems: "flex-start" },
  activityTile: { width: 106, height: 105, backgroundColor: "#F2F2F2", borderRadius: 4, padding: 8, alignItems: "center", justifyContent: "space-between" },
  activityMore: { width: 17, height: 105, alignItems: "center", justifyContent: "center" },
  activityMoreGlyph: { color: "#999999", fontSize: 20, letterSpacing: 1 },
  activityIconCircle: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: "#999999", alignItems: "center", justifyContent: "center" },
  activityGlyph: { color: "#555555", fontSize: 15 },
  activityTitle: { color: "#444444", fontSize: 9, fontWeight: "600", textAlign: "center" },
  activityDescription: { color: "#888888", fontSize: 7, textAlign: "center" },
  activityLink: { color: "#555555", fontSize: 7 },
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
