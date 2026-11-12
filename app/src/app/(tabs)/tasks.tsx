import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

type CategoryId = "shopping" | "games" | "entertainment" | "finance" | "wellness";

export default function TasksScreen() {
  const { locale, t } = useI18n();
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const categories = [
    { id: "shopping" as const, icon: "🛒", label: locale === "zh-CN" ? "购物" : "Shopping" },
    { id: "games" as const, icon: "🎮", label: locale === "zh-CN" ? "游戏" : "Games" },
    { id: "entertainment" as const, icon: "♫", label: locale === "zh-CN" ? "娱乐" : "Entertainment" },
    { id: "finance" as const, icon: "▣", label: locale === "zh-CN" ? "金融" : "Finance" },
    { id: "wellness" as const, icon: "♡", label: locale === "zh-CN" ? "健康" : "Wellness" }
  ];

  const missions = [
    { id: "shop", category: "shopping" as const, icon: "🛒", title: locale === "zh-CN" ? "精选商城每日浏览" : "Browse the featured marketplace", hint: locale === "zh-CN" ? "发现每日精选内容" : "Discover daily highlights", reward: "+5", suffix: t("points") },
    { id: "game", category: "games" as const, icon: "🎮", title: locale === "zh-CN" ? "体验社区小游戏" : "Try a community mini game", hint: locale === "zh-CN" ? "参与游戏互动" : "Join a casual game", reward: "+8", suffix: t("points") },
    { id: "read", category: "entertainment" as const, icon: "▤", title: locale === "zh-CN" ? "阅读一篇精选文章" : "Read a featured article", hint: locale === "zh-CN" ? "了解最新社区动态" : "Catch up on community stories", reward: "+3", suffix: t("points") },
    { id: "invite", category: "shopping" as const, icon: "♙", title: t("inviteMission"), hint: locale === "zh-CN" ? "邀请朋友加入 BrightGlobe" : "Invite a friend to BrightGlobe", reward: "+50", suffix: t("points") },
    { id: "follow", category: "entertainment" as const, icon: "◉", title: locale === "zh-CN" ? "关注 BrightGlobe 社区" : "Follow BrightGlobe community", hint: locale === "zh-CN" ? "关注官方社区动态" : "Follow official community updates", reward: "+2", suffix: t("points") }
  ];

  const [selectedCategory, setSelectedCategory] = useState<CategoryId | "all">("all");
  const visibleMissions = useMemo(
    () => selectedCategory === "all" ? missions : missions.filter((item) => item.category === selectedCategory),
    [selectedCategory, locale]
  );

  const categoryHelp = (id: CategoryId) => {
    const description: Record<CategoryId, string> = {
      shopping: locale === "zh-CN" ? "通过探索精选商城与合作服务获得贡献奖励。" : "Explore featured shops and partner services to earn contribution rewards.",
      games: locale === "zh-CN" ? "参与社区小游戏与互动活动。" : "Take part in community mini games and activities.",
      entertainment: locale === "zh-CN" ? "通过阅读、音乐与内容探索参与社区。" : "Participate through reading, music, and content discovery.",
      finance: locale === "zh-CN" ? "金融类合作服务将在后续版本开放。" : "Financial partner missions may be introduced in a later release.",
      wellness: locale === "zh-CN" ? "健康类任务暂未开放。" : "Wellness missions are not available in this preview."
    };
    Alert.alert(categories.find((item) => item.id === id)?.label, description[id]);
  };

  return (
    <AppScreen>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{locale === "zh-CN" ? "发现原力" : "Discover Force"}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert(locale === "zh-CN" ? "贡献力说明" : "About Contribution Power", t("missionHint"))}
          style={styles.helpButton}
        >
          <Text style={styles.helpGlyph}>?</Text>
        </Pressable>
      </View>
      <Text style={styles.pageSubtitle}>
        {locale === "zh-CN" ? "贡献越多，贡献力越高，获得的社区奖励越丰富" : "Contribute more to grow your power and unlock more community rewards"}
      </Text>

      <View style={styles.forceSummary}>
        <View>
          <Text style={styles.forceCaption}>{t("contributionPower")}</Text>
          <View style={styles.forceValueRow}>
            <Text style={styles.forceValue}>1,280</Text>
            <Text style={styles.forceUnit}>{locale === "zh-CN" ? "贡献力" : "POWER"}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowCheckin(true)}
          style={({ pressed }) => [styles.checkinButton, checkedIn && styles.checkinButtonDone, pressed && styles.pressed]}
        >
          <Text style={[styles.checkinText, checkedIn && styles.checkinTextDone]}>
            {checkedIn ? (locale === "zh-CN" ? "已签到" : "Checked in") : (locale === "zh-CN" ? "签到" : "Check in")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{locale === "zh-CN" ? "原力分类" : "Force categories"}</Text>
      </View>
      <View style={styles.categoryGrid}>
        {categories.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === item.id }}
            onPress={() => {
              setSelectedCategory(selectedCategory === item.id ? "all" : item.id);
              categoryHelp(item.id);
            }}
            style={styles.categoryItem}
          >
            <View style={[styles.categoryIcon, selectedCategory === item.id && styles.categoryIconActive]}>
              <Text style={styles.categoryGlyph}>{item.icon}</Text>
            </View>
            <Text style={[styles.categoryLabel, selectedCategory === item.id && styles.categoryLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{locale === "zh-CN" ? "推荐原力" : "Recommended missions"}</Text>
        {selectedCategory !== "all" ? (
          <Pressable onPress={() => setSelectedCategory("all")}>
            <Text style={styles.clearFilter}>{locale === "zh-CN" ? "显示全部" : "Show all"}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.missionList}>
        {visibleMissions.map((mission, index) => (
          <View key={mission.id} style={[styles.missionRow, index !== visibleMissions.length - 1 && styles.missionDivider]}>
            <View style={styles.missionIcon}>
              <Text style={styles.missionGlyph}>{mission.icon}</Text>
            </View>
            <View style={styles.missionCopy}>
              <Text style={styles.missionTitle}>{mission.title}</Text>
              <Text style={styles.missionHint}>{mission.hint}</Text>
            </View>
            <View style={styles.missionRewardBlock}>
              <Text style={styles.missionReward}>{mission.reward}{mission.suffix}</Text>
              <Text style={styles.missionRewardMeta}>{locale === "zh-CN" ? "任务奖励" : "Reward"}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert(mission.title, locale === "zh-CN" ? "任务预览：暂未接入真实任务服务。" : "Mission preview. The live task service is not connected yet.")}
              style={styles.infoButton}
            >
              <Text style={styles.infoGlyph}>i</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.bottomNote}>{locale === "zh-CN" ? "我是有底线的" : "You've reached the end"}</Text>

      <Modal
        visible={showCheckin}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCheckin(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.checkinDialog}>
            <Pressable onPress={() => setShowCheckin(false)} style={styles.closeButton}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
            <Text style={styles.dialogTitle}>{locale === "zh-CN" ? "签到成功" : "Check-in complete"}</Text>
            <Text style={styles.dialogReward}>+20 {locale === "zh-CN" ? "贡献力" : "Power"}</Text>
            <View style={styles.dialogPlanet}><Text style={styles.dialogPlanetGlyph}>✦</Text></View>
            <Text style={styles.dialogDescription}>
              {locale === "zh-CN" ? "每天参与社区，持续积累你的贡献。" : "Stay active in the community and grow your contribution."}
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => {
                  setCheckedIn(true);
                  setShowCheckin(false);
                }}
                style={styles.dialogSecondary}
              >
                <Text style={styles.dialogSecondaryText}>{locale === "zh-CN" ? "知道了" : "Got it"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setCheckedIn(true);
                  setShowCheckin(false);
                  setSelectedCategory("all");
                }}
                style={styles.dialogPrimary}
              >
                <Text style={styles.dialogPrimaryText}>{locale === "zh-CN" ? "去探索" : "Explore"}</Text>
              </Pressable>
            </View>
            <Text style={styles.dialogPreview}>{locale === "zh-CN" ? "预览交互，不会增加真实账户数值" : "Preview interaction only · No live account value is changed"}</Text>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { color: "#33313A", fontSize: 20, fontWeight: "800" },
  helpButton: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#B8B3BD", alignItems: "center", justifyContent: "center" },
  helpGlyph: { color: "#9D97A3", fontSize: 13, fontWeight: "800" },
  pageSubtitle: { color: "#88828D", fontSize: 11, lineHeight: 17, marginTop: -7 },
  forceSummary: { minHeight: 64, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#EAE7ED", paddingBottom: 12 },
  forceCaption: { color: "#8D8793", fontSize: 10 },
  forceValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 1 },
  forceValue: { color: "#39343D", fontSize: 25, fontWeight: "900" },
  forceUnit: { color: "#99939F", fontSize: 9 },
  checkinButton: { minWidth: 76, height: 32, borderRadius: 17, borderWidth: 1, borderColor: "#B77BE2", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  checkinButtonDone: { borderColor: "#D7D1DC", backgroundColor: "#F6F4F7" },
  checkinText: { color: colors.brand, fontSize: 10, fontWeight: "800" },
  checkinTextDone: { color: "#99939F" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  sectionTitle: { color: "#55505A", fontSize: 13, fontWeight: "800" },
  categoryGrid: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderColor: "#EAE7ED" },
  categoryItem: { alignItems: "center", flex: 1, gap: 5 },
  categoryIcon: { width: 40, height: 36, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  categoryIconActive: { backgroundColor: "#F5EAFB" },
  categoryGlyph: { color: "#26232A", fontSize: 22, fontWeight: "700" },
  categoryLabel: { color: "#615C66", fontSize: 9, fontWeight: "600" },
  categoryLabelActive: { color: colors.brand, fontWeight: "900" },
  clearFilter: { color: colors.brand, fontSize: 9, fontWeight: "700" },
  missionList: { borderTopWidth: 1, borderColor: "#EAE7ED" },
  missionRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 8 },
  missionDivider: { borderBottomWidth: 1, borderColor: "#F0EDF2" },
  missionIcon: { width: 31, height: 31, alignItems: "center", justifyContent: "center" },
  missionGlyph: { fontSize: 20, color: "#2C2931" },
  missionCopy: { flex: 1, gap: 3 },
  missionTitle: { color: "#38343D", fontSize: 10, fontWeight: "800" },
  missionHint: { color: "#9B95A0", fontSize: 8 },
  missionRewardBlock: { alignItems: "flex-end", gap: 3 },
  missionReward: { color: colors.brand, fontSize: 9, fontWeight: "800" },
  missionRewardMeta: { color: "#ABA5B0", fontSize: 7 },
  infoButton: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: "#B2ADB7", alignItems: "center", justifyContent: "center", marginLeft: 2 },
  infoGlyph: { color: "#A29CA7", fontSize: 10, fontWeight: "700" },
  bottomNote: { alignSelf: "center", color: "#B9B3BE", fontSize: 8, paddingVertical: 4 },
  pressed: { opacity: 0.7 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center", padding: 28 },
  checkinDialog: { width: "100%", maxWidth: 330, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", padding: 22, paddingTop: 28 },
  closeButton: { position: "absolute", right: 12, top: 9, width: 25, height: 25, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: "#88818D", fontSize: 24, lineHeight: 26 },
  dialogTitle: { color: "#33313A", fontSize: 15, fontWeight: "900" },
  dialogReward: { color: colors.brand, fontSize: 17, fontWeight: "900", marginTop: 5 },
  dialogPlanet: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#EEDBFC", alignItems: "center", justifyContent: "center", marginTop: 12 },
  dialogPlanetGlyph: { color: colors.brandDark, fontSize: 30 },
  dialogDescription: { color: "#77717D", fontSize: 10, lineHeight: 16, marginTop: 12, textAlign: "center" },
  dialogActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 18 },
  dialogSecondary: { flex: 1, height: 36, borderRadius: 19, borderWidth: 1, borderColor: "#D6CEDD", alignItems: "center", justifyContent: "center" },
  dialogSecondaryText: { color: "#827B89", fontSize: 10, fontWeight: "800" },
  dialogPrimary: { flex: 1, height: 36, borderRadius: 19, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  dialogPrimaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  dialogPreview: { color: "#B2ACB7", fontSize: 7, marginTop: 12 }
});
