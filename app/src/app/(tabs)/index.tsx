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
  const [claimed, setClaimed] = useState(false);
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
  const activityItems = [
    { key: "shopping", category: "shopping", glyph: "▣", title: t("淘宝购物", "Shopping"), description: t("精选购物任务", "Featured offers") },
    { key: "games", category: "games", glyph: "▤", title: t("游戏中心", "Games"), description: t("游戏任务与活动", "Game missions") },
    { key: "reading", category: "reading", glyph: "▥", title: t("小说阅读", "Reading"), description: t("精选小说内容", "Selected novels") },
    { key: "news", category: "news", glyph: "◉", title: t("新闻资讯", "News"), description: t("热点与社区资讯", "News and insights") },
    { key: "comics", category: "comics", glyph: "▧", title: t("精品漫画", "Comics"), description: t("漫画与连载作品", "Comics and series") },
    { key: "bidding", category: "bidding", glyph: "◇", title: t("社区竞猜", "Challenges"), description: t("互动挑战活动", "Community challenges") },
    { key: "treasure", category: "treasure", glyph: "♢", title: t("黑钻挖宝", "Treasure hunt"), description: t("探索活动入口", "Explore activities") },
    { key: "benefits", type: "rewards" as const, glyph: "✦", title: t("黑钻活动", "Member benefits"), description: t("活动与专属权益", "Events and benefits") }
  ];

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
        <Pressable onPress={() => requireHomeLogin(() => router.push({ pathname: "/category", params: { category: "treasure" } }))} style={styles.mineEntry}>
          <View style={styles.mineOrb}>
            <Text style={styles.mineGlyph}>◇</Text>
          </View>
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
            onPress={() => requireHomeLogin(() => setClaimed(true))}
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
            onPress={() => requireHomeLogin(() => {
              if ("type" in item && item.type === "rewards") {
                router.push("/rewards");
              } else if ("category" in item) {
                router.push({ pathname: "/category", params: { category: item.category } });
              }
            })}
            style={styles.activityTile}
          >
            <View style={styles.activityCover}>
              <View style={styles.activitySun} />
              <View style={styles.activityMountainBack} />
              <View style={styles.activityMountainFront} />
              <Text style={styles.activityCoverGlyph}>{item.glyph}</Text>
            </View>
            <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.activityDescription} numberOfLines={1}>{item.description}</Text>
            <Text style={styles.activityLink}>{t("查看", "View")} ›</Text>
          </Pressable>
        ))}
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
  mineEntry: { position: "absolute", right: 27, top: 32, width: 62, alignItems: "center" },
  mineOrb: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#777777", alignItems: "center", justifyContent: "center" },
  mineGlyph: { color: "#FFFFFF", fontSize: 20 },
  mineLabel: { color: "#333333", fontSize: 8, marginTop: 4 },
  growthEntry: { position: "absolute", top: 92, left: "40%", alignItems: "center", justifyContent: "center" },
  growthGem: { color: "#4A4A4A", fontSize: 22, lineHeight: 24 },
  growthLabel: { color: "#555555", fontSize: 8, marginTop: 2 },
  growingValues: { position: "absolute", left: 0, right: 0, top: 64, bottom: 24 },
  growingValue: { position: "absolute", alignItems: "center", gap: 1 },
  valueOne: { left: "20%", top: 4 },
  valueTwo: { left: "61%", top: 43 },
  valueThree: { left: "39%", top: 104 },
  smallGem: { color: "#555555", fontSize: 17, lineHeight: 19 },
  smallValue: { color: "#555555", fontSize: 7 },
  activityRail: { gap: 7, paddingBottom: 4, alignItems: "flex-start" },
  activityTile: { width: 106, height: 105, backgroundColor: "#F2F2F2", borderRadius: 3, padding: 6, alignItems: "center", justifyContent: "space-between" },
  activityCover: { width: "100%", height: 43, backgroundColor: "#E6E9EC", overflow: "hidden", position: "relative", alignItems: "center", justifyContent: "center" },
  activitySun: { position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: "#C5C5C5", top: 6, right: 13 },
  activityMountainBack: { position: "absolute", bottom: -12, left: -9, width: 0, height: 0, borderLeftWidth: 34, borderRightWidth: 34, borderBottomWidth: 36, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#AABBC7" },
  activityMountainFront: { position: "absolute", bottom: -14, right: -7, width: 0, height: 0, borderLeftWidth: 39, borderRightWidth: 39, borderBottomWidth: 33, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#7F9BAB" },
  activityCoverGlyph: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
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
