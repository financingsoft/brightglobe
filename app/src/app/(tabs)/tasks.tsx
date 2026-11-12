import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

type CategoryId = "shopping" | "games" | "entertainment" | "finance" | "wellness";

function CategoryGlyph({ category, small = false }: { category: CategoryId; small?: boolean }) {
  if (category === "shopping") {
    return <View style={[styles.cart, small && styles.smallGlyph]}><View style={styles.cartHandle} /><View style={styles.cartBasket} /><View style={styles.cartWheelLeft} /><View style={styles.cartWheelRight} /></View>;
  }
  if (category === "games") {
    return <View style={[styles.gamepad, small && styles.smallGlyph]}><View style={styles.gamepadCrossH} /><View style={styles.gamepadCrossV} /><View style={styles.gamepadDotOne} /><View style={styles.gamepadDotTwo} /></View>;
  }
  if (category === "entertainment") {
    return <View style={[styles.mic, small && styles.smallGlyph]}><View style={styles.micHead} /><View style={styles.micArc} /><View style={styles.micStand} /></View>;
  }
  if (category === "finance") {
    return <View style={[styles.moneyIcon, small && styles.smallGlyph]}><Text style={styles.moneyGlyph}>$</Text></View>;
  }
  return <Text style={[styles.heartGlyph, small && styles.smallGlyph]}>♥</Text>;
}

type MissionId = "shopping" | "games" | "reading" | "news" | "invite" | "follow";

type Mission = {
  id: MissionId;
  title: string;
  hint: string;
  reward: string;
};

function MissionGlyph({ id }: { id: MissionId }) {
  if (id === "shopping") return <CategoryGlyph category="shopping" small />;
  if (id === "games") return <CategoryGlyph category="games" small />;
  if (id === "reading") {
    return (
      <View style={styles.bookIcon}>
        <View style={styles.bookPageLeft}><View style={styles.bookLine} /><View style={styles.bookLine} /></View>
        <View style={styles.bookPageRight}><View style={styles.bookLine} /><View style={styles.bookLine} /></View>
      </View>
    );
  }
  if (id === "news") {
    return (
      <View style={styles.globeIcon}>
        <View style={styles.globeEquator} />
        <View style={styles.globeMeridian} />
      </View>
    );
  }
  if (id === "invite") {
    return (
      <View style={styles.inviteIcon}>
        <View style={styles.inviteHead} />
        <View style={styles.inviteBody} />
        <View style={styles.invitePlusHorizontal} />
        <View style={styles.invitePlusVertical} />
      </View>
    );
  }
  return (
    <View style={styles.chatIcon}>
      <View style={styles.chatMain}><View style={styles.chatDot} /><View style={styles.chatDot} /><View style={styles.chatDot} /></View>
      <View style={styles.chatSecond} />
    </View>
  );
}

export default function TasksScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const requireLogin = (action: () => void) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    action();
  };

  const categories: { id: CategoryId; label: string }[] = [
    { id: "shopping", label: t("购物", "Shopping") },
    { id: "games", label: t("游戏", "Games") },
    { id: "entertainment", label: t("娱乐", "Entertainment") },
    { id: "finance", label: t("来钱", "Finance") },
    { id: "wellness", label: t("健康", "Health") }
  ];

  const missions: Mission[] = [
    { id: "shopping", title: t("购物任务", "Shopping missions"), hint: t("完成指定任务获取原力", "Complete selected missions to earn Power"), reward: t("每日1~5原力", "1–5 Power daily") },
    { id: "games", title: t("游戏任务", "Game missions"), hint: t("参与游戏活动获取原力", "Join game activities to earn Power"), reward: t("每日3~8原力", "3–8 Power daily") },
    { id: "reading", title: t("小说阅读", "Read selected novels"), hint: t("浏览精选小说内容", "Explore selected novels"), reward: t("每日3~8原力", "3–8 Power daily") },
    { id: "news", title: t("看新闻", "Read the news"), hint: t("了解最新时事动态", "Keep up with current topics"), reward: t("每日1~3原力", "1–3 Power daily") },
    { id: "invite", title: t("邀请好友", "Invite friends"), hint: t("+10原力/被邀请人", "+10 Power per accepted invite"), reward: t("+10~500原力", "+10–500 Power") },
    { id: "follow", title: t("关注微信公众号", "Follow the official account"), hint: t("关注获取最新动态", "Follow official updates"), reward: t("+2原力", "+2 Power") }
  ];

  return (
    <AppScreen>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t("发现原力", "Discover Power")}</Text>
        <Pressable accessibilityRole="button" onPress={() => requireLogin(() => router.push("/help"))} style={styles.helpButton}>
          <Text style={styles.helpGlyph}>?</Text>
        </Pressable>
      </View>
      <Text style={styles.pageSubtitle}>
        {t("贡献越多原力越多，黑钻生长越快", "The more you contribute, the faster your rewards grow")}
      </Text>

      <View style={styles.campaignBanner}>
        <View style={styles.campaignPlanet} />
        <Text style={styles.campaignTitle}>{t("赶紧收取原力，加速获取黑钻", "Collect Contribution Power and accelerate your rewards")}</Text>
        <View style={styles.campaignPill}>
          <Text style={styles.campaignPillText}>{t("原力越多，获取的黑钻会越多", "More Power means more community rewards")}</Text>
        </View>
      </View>

      <View style={styles.forceSummary}>
        <View>
          <View style={styles.forceValueLine}>
            <Text style={styles.forceValue}>534</Text>
            <Text style={styles.forceUnit}>{t("原力值", "Power")}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => requireLogin(() => setShowCheckin(true))}
          style={({ pressed }) => [styles.checkinButton, checkedIn && styles.checkinButtonDone, pressed && styles.pressed]}
        >
          <Text style={[styles.checkinText, checkedIn && styles.checkinTextDone]}>
            {checkedIn ? t("已签到", "Checked in") : t("签到", "Check in")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("原力分类", "Power categories")}</Text>
      </View>
      <View style={styles.categoryGrid}>
        {categories.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => requireLogin(() => router.push({ pathname: "/category", params: { category: item.id } }))}
            style={styles.categoryItem}
          >
            <CategoryGlyph category={item.id} />
            <Text style={styles.categoryLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("推荐原力", "Recommended Power")}</Text>
      </View>
      <View style={styles.missionList}>
        {missions.map((mission, index) => (
          <View key={mission.id} style={[styles.missionRow, index < missions.length - 1 && styles.missionDivider]}>
            <View style={styles.missionIcon}>
              <MissionGlyph id={mission.id} />
            </View>
            <Pressable
              onPress={() => requireLogin(() => {
                if (mission.id === "invite") {
                  router.push("/invite");
                } else if (mission.id === "follow") {
                  router.push("/official-follow");
                } else {
                  router.push({ pathname: "/category", params: { category: mission.id } });
                }
              })}
              style={styles.missionCopy}
            >
              <Text style={styles.missionTitle}>{mission.title}</Text>
              <Text style={styles.missionHint}>{mission.hint}</Text>
            </Pressable>
            <Text style={styles.missionReward}>{mission.reward}</Text>
            <Pressable accessibilityRole="button" onPress={() => requireLogin(() => setSelectedMission(mission))} style={styles.infoButton}>
              <Text style={styles.infoGlyph}>i</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.bottomNote}>{t("我是有底线的", "You've reached the end")}</Text>

      <Modal visible={showCheckin} transparent animationType="fade" onRequestClose={() => setShowCheckin(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.checkinDialog}>
            <Pressable onPress={() => setShowCheckin(false)} style={styles.closeButton}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
            <Text style={styles.dialogTitle}>{t("签到成功", "Check-in complete")}</Text>
            <Text style={styles.dialogReward}>+3 {t("魔法原力", "Magic Power")}</Text>
            <View style={styles.dialogPicture}>
              <View style={styles.pictureSun} />
              <View style={styles.pictureMountainBack} />
              <View style={styles.pictureMountainFront} />
            </View>
            <Text style={styles.dialogDescription}>
              {t("送你1次宇宙探索的机会", "You have one chance to explore the universe")}
            </Text>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => { setCheckedIn(true); setShowCheckin(false); }} style={styles.dialogButton}>
                <Text style={styles.dialogButtonText}>{t("不用了", "Not now")}</Text>
              </Pressable>
              <Pressable onPress={() => { setCheckedIn(true); setShowCheckin(false); router.push({ pathname: "/category", params: { category: "games" } }); }} style={styles.dialogButton}>
                <Text style={styles.dialogButtonText}>{t("去探索", "Explore")}</Text>
              </Pressable>
            </View>
            <Text style={styles.previewNote}>{t("本地预览状态，不会增加真实账户数值", "Local preview only; no live account value is credited")}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedMission !== null} transparent animationType="fade" onRequestClose={() => setSelectedMission(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.infoDialog}>
            <Pressable onPress={() => setSelectedMission(null)} style={styles.closeButton}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
            <Text style={styles.dialogTitle}>{selectedMission?.title}</Text>
            <Text style={styles.dialogDescription}>{selectedMission?.hint}</Text>
            <Text style={styles.infoReward}>{selectedMission?.reward}</Text>
            <Text style={styles.previewNote}>{t("任务服务尚未连接，当前仅展示交互结构。", "Task service is not connected; this is a UI preview.")}</Text>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 35, marginTop: 9 },
  pageTitle: { color: "#333333", fontSize: 16, fontWeight: "700" },
  helpButton: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: "#999999", alignItems: "center", justifyContent: "center" },
  helpGlyph: { color: "#777777", fontSize: 11, fontWeight: "700", lineHeight: 13 },
  pageSubtitle: { color: "#999999", fontSize: 10, marginTop: 1, marginBottom: 9 },
  campaignBanner: { height: 92, backgroundColor: "#683BB7", overflow: "hidden", justifyContent: "center", paddingHorizontal: 14, gap: 9, marginBottom: 9, borderRadius: 3 },
  campaignPlanet: { position: "absolute", width: 142, height: 142, borderRadius: 71, right: -35, top: 6, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  campaignTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: 0.2 },
  campaignPill: { alignSelf: "flex-start", minHeight: 24, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.20)" },
  campaignPillText: { color: "#FFFFFF", fontSize: 9 },
  forceSummary: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DCDCDC", paddingBottom: 8 },
  forceValueLine: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  forceValue: { color: "#333333", fontSize: 18, fontWeight: "700" },
  forceUnit: { color: "#777777", fontSize: 9 },
  checkinButton: { minWidth: 54, height: 27, borderRadius: 15, borderWidth: 1, borderColor: "#8B6CC7", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  checkinButtonDone: { borderColor: "#CCCCCC", backgroundColor: "#F5F5F5" },
  checkinText: { color: "#7044BF", fontSize: 9 },
  checkinTextDone: { color: "#999999" },
  sectionHeader: { minHeight: 32, justifyContent: "center", borderBottomWidth: 1, borderColor: "#E0E0E0" },
  sectionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" },
  categoryGrid: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderColor: "#E0E0E0" },
  categoryItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 49 },
  cart: { width: 30, height: 27, alignItems: "flex-end", justifyContent: "flex-start" },
  cartHandle: { position: "absolute", top: 3, left: 1, width: 8, height: 2, backgroundColor: "#7044BF", transform: [{ rotate: "25deg" }] },
  cartBasket: { position: "absolute", top: 6, left: 8, width: 19, height: 12, backgroundColor: "transparent", borderWidth: 2, borderColor: "#7044BF", borderRadius: 1, transform: [{ skewX: "-12deg" }] },
  cartWheelLeft: { position: "absolute", bottom: 1, left: 11, width: 4, height: 4, borderRadius: 2, backgroundColor: "#7044BF" },
  cartWheelRight: { position: "absolute", bottom: 1, right: 1, width: 4, height: 4, borderRadius: 2, backgroundColor: "#7044BF" },
  gamepad: { width: 30, height: 20, borderRadius: 7, backgroundColor: "transparent", borderWidth: 2, borderColor: "#7044BF", position: "relative" },
  gamepadCrossH: { position: "absolute", left: 5, top: 8, width: 8, height: 2, backgroundColor: "#7044BF" },
  gamepadCrossV: { position: "absolute", left: 8, top: 5, width: 2, height: 8, backgroundColor: "#7044BF" },
  gamepadDotOne: { position: "absolute", right: 6, top: 5, width: 3, height: 3, borderRadius: 2, backgroundColor: "#7044BF" },
  gamepadDotTwo: { position: "absolute", right: 3, top: 9, width: 3, height: 3, borderRadius: 2, backgroundColor: "#7044BF" },
  mic: { width: 27, height: 27, alignItems: "center", position: "relative" },
  micHead: { width: 11, height: 16, borderRadius: 6, borderWidth: 2, borderColor: "#7044BF", backgroundColor: "transparent" },
  micArc: { width: 18, height: 9, borderBottomWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: "#7044BF", borderBottomLeftRadius: 9, borderBottomRightRadius: 9, marginTop: -3 },
  micStand: { width: 2, height: 5, backgroundColor: "#7044BF", marginTop: 0 },
  moneyIcon: { width: 28, height: 20, borderRadius: 2, borderWidth: 2, borderColor: "#7044BF", backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  moneyGlyph: { color: "#7044BF", fontSize: 12, fontWeight: "800", lineHeight: 14 },
  heartGlyph: { color: "#7044BF", fontSize: 25, lineHeight: 27 },
  smallGlyph: { transform: [{ scale: 0.78 }] },
  categoryLabel: { color: "#444444", fontSize: 10 },
  missionList: { borderTopWidth: 1, borderColor: "#E0E0E0" },
  missionRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  missionDivider: { borderBottomWidth: 1, borderColor: "#E8E8E8" },
  missionIcon: { width: 27, alignItems: "center", justifyContent: "center" },
  bookIcon: { width: 25, height: 22, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  bookPageLeft: { width: 12, height: 19, borderWidth: 2, borderColor: "#7044BF", borderTopLeftRadius: 3, borderBottomLeftRadius: 3, paddingTop: 4, paddingHorizontal: 2, gap: 3 },
  bookPageRight: { width: 12, height: 19, borderWidth: 2, borderColor: "#7044BF", borderTopRightRadius: 3, borderBottomRightRadius: 3, paddingTop: 4, paddingHorizontal: 2, gap: 3 },
  bookLine: { height: 1, backgroundColor: "#7044BF" },
  globeIcon: { width: 22, height: 22, borderWidth: 2, borderColor: "#7044BF", borderRadius: 11, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  globeEquator: { width: 18, height: 7, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#7044BF", borderRadius: 5 },
  globeMeridian: { position: "absolute", height: 18, width: 8, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#7044BF", borderRadius: 6 },
  inviteIcon: { width: 25, height: 24, position: "relative", alignItems: "center" },
  inviteHead: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7044BF", position: "absolute", left: 2, top: 1 },
  inviteBody: { width: 15, height: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: "#7044BF", position: "absolute", left: 0, bottom: 1 },
  invitePlusHorizontal: { width: 10, height: 2, backgroundColor: "#7044BF", position: "absolute", right: 0, top: 8 },
  invitePlusVertical: { width: 2, height: 10, backgroundColor: "#7044BF", position: "absolute", right: 4, top: 4 },
  chatIcon: { width: 26, height: 22, position: "relative" },
  chatMain: { width: 18, height: 15, borderRadius: 8, backgroundColor: "#7044BF", position: "absolute", left: 0, top: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  chatDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: "#FFFFFF" },
  chatSecond: { width: 9, height: 8, borderRadius: 4, backgroundColor: "#7044BF", position: "absolute", right: 0, bottom: 1, borderWidth: 1, borderColor: "#FFFFFF" },

  missionCopy: { flex: 1, gap: 3 },
  missionTitle: { color: "#3D3D3D", fontSize: 10, fontWeight: "600" },
  missionHint: { color: "#999999", fontSize: 8 },
  missionReward: { color: "#7044BF", fontSize: 9, fontWeight: "600", marginRight: 1 },
  infoButton: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "#9A86C5", alignItems: "center", justifyContent: "center", marginHorizontal: 2 },
  infoGlyph: { color: "#7044BF", fontSize: 9, fontWeight: "600" },
  bottomNote: { alignSelf: "center", color: "#AAAAAA", fontSize: 8, paddingVertical: 5 },
  pressed: { opacity: 0.7 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center", padding: 28 },
  checkinDialog: { width: "100%", maxWidth: 300, backgroundColor: "#FFFFFF", borderRadius: 8, padding: 18, paddingTop: 23, alignItems: "center" },
  closeButton: { position: "absolute", top: 5, right: 8, width: 23, height: 23, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: "#444444", fontSize: 23, lineHeight: 25 },
  dialogTitle: { color: "#333333", fontSize: 13, fontWeight: "700" },
  dialogReward: { color: "#777777", fontSize: 10, marginTop: 4 },
  dialogPicture: { width: 79, height: 48, backgroundColor: "#EEEEEE", marginTop: 9, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  pictureSun: { position: "absolute", top: 4, right: 13, width: 8, height: 8, borderRadius: 4, backgroundColor: "#B7DDEB" },
  pictureMountainBack: { position: "absolute", bottom: -6, left: -6, width: 58, height: 39, backgroundColor: "#65AFD2", transform: [{ rotate: "23deg" }] },
  pictureMountainFront: { position: "absolute", bottom: -10, right: -9, width: 62, height: 39, backgroundColor: "#318CBF", transform: [{ rotate: "-24deg" }] },
  dialogDescription: { color: "#555555", fontSize: 9, textAlign: "center", marginTop: 8 },
  dialogActions: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 12 },
  dialogButton: { minWidth: 74, height: 28, borderRadius: 15, borderWidth: 1, borderColor: "#AAAAAA", alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  dialogButtonText: { color: "#444444", fontSize: 8 },
  previewNote: { color: "#AAAAAA", fontSize: 7, textAlign: "center", marginTop: 11 },
  infoDialog: { width: "100%", maxWidth: 300, backgroundColor: "#FFFFFF", borderRadius: 8, padding: 20, alignItems: "center", gap: 9 },
  infoReward: { color: "#777777", fontSize: 10, fontWeight: "700" }
});
