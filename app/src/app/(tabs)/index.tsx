import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AppScreen, Pill, SectionHeading } from "@/components/ui";
import { colors } from "@/constants/theme";
import { PlanetOrb } from "@/components/earth/PlanetOrb";
import { useI18n } from "@/i18n/locale";

export default function HomeScreen() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [claimed, setClaimed] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const openWallet = () => router.push("/wallet");
  const openTasks = () => router.push("/tasks");

  return (
    <AppScreen>
      <View style={styles.statBar}>
        <Pressable accessibilityRole="button" onPress={openWallet} style={styles.statPill}>
          <Text style={styles.statDiamond}>◆</Text>
          <Text style={styles.statName}>{locale === "zh-CN" ? "社区积分" : "Points"}</Text>
          <Text style={styles.statNumber}>2,480</Text>
          <Text style={styles.statChevron}>›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={openTasks} style={styles.statPill}>
          <Text style={styles.statPower}>◉</Text>
          <Text style={styles.statName}>{t("contributionPower")}</Text>
          <Text style={styles.statNumber}>1,280</Text>
          <Text style={styles.statChevron}>›</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={openTasks} style={styles.noticeBar}>
        <Text style={styles.noticeSpeaker}>◖</Text>
        <Text style={styles.noticeText}>
          {locale === "zh-CN"
            ? "BrightGlobe 社区公告：发现新的贡献任务，参与社区共建"
            : "BrightGlobe bulletin: discover new ways to contribute"}
        </Text>
        <Text style={styles.noticeMore}>{locale === "zh-CN" ? "更多" : "More"} ›</Text>
      </Pressable>

      <View style={styles.planetStage}>
        <PlanetOrb />
        <View style={styles.planetTopLine}>
          <Text style={styles.planetTopTitle}>BRIGHTGLOBE PLANET</Text>
          <Pill label={locale === "zh-CN" ? "预览数据" : "PREVIEW"} tone="gold" />
        </View>
        <View style={styles.planetClaim}>
          <View style={styles.gemBadge}>
            <Text style={styles.gemGlyph}>◆</Text>
          </View>
          <Text style={styles.claimCaption}>{locale === "zh-CN" ? "今日待领取奖励" : "TODAY'S COMMUNITY REWARD"}</Text>
          <Text style={styles.claimValue}>0.0286</Text>
          <Text style={styles.claimUnit}>{locale === "zh-CN" ? "社区积分" : "COMMUNITY POINTS"}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setClaimed(true)}
            style={({ pressed }) => [styles.claimButton, pressed && styles.pressed]}
          >
            <Text style={styles.claimButtonText}>
              {claimed ? (locale === "zh-CN" ? "今日已领取" : "Collected today") : (locale === "zh-CN" ? "领取今日奖励" : "Collect today's reward")}
            </Text>
          </Pressable>
          <Text style={styles.claimFootnote}>
            {claimed
              ? (locale === "zh-CN" ? "演示状态：尚未连接真实奖励服务" : "Preview state only · No real reward credited")
              : (locale === "zh-CN" ? "贡献越多，获得的社区权益越丰富" : "Contribute more to unlock more community benefits")}
          </Text>
        </View>
        <View style={styles.planetStats}>
          <Pressable onPress={openWallet} style={styles.planetStat}>
            <Text style={styles.planetStatLabel}>{locale === "zh-CN" ? "累计积分" : "TOTAL POINTS"}</Text>
            <Text style={styles.planetStatValue}>2,480</Text>
          </Pressable>
          <View style={styles.planetStatDivider} />
          <Pressable onPress={openTasks} style={styles.planetStat}>
            <Text style={styles.planetStatLabel}>{locale === "zh-CN" ? "贡献等级" : "CONTRIBUTION LEVEL"}</Text>
            <Text style={styles.planetStatValue}>{locale === "zh-CN" ? "探索者 Lv.4" : "Explorer Lv.4"}</Text>
          </Pressable>
        </View>
      </View>

      <SectionHeading title={locale === "zh-CN" ? "星球活动" : "Planet activities"} action={t("viewAll")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityRail}>
        <Pressable onPress={openTasks} style={[styles.activityCard, styles.activityCardPurple]}>
          <Text style={styles.activityKicker}>CONTRIBUTION</Text>
          <Text style={styles.activityTitle}>{locale === "zh-CN" ? "发现原力任务" : "Discover missions"}</Text>
          <Text style={styles.activityDescription}>{locale === "zh-CN" ? "完成任务提升贡献力" : "Grow your contribution"}</Text>
          <Text style={styles.activityIcon}>✦</Text>
          <Text style={styles.activityLink}>{locale === "zh-CN" ? "立即探索 ›" : "Explore ›"}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/rewards")} style={[styles.activityCard, styles.activityCardRose]}>
          <Text style={styles.activityKicker}>COMMUNITY</Text>
          <Text style={styles.activityTitle}>{locale === "zh-CN" ? "社区精彩活动" : "Community events"}</Text>
          <Text style={styles.activityDescription}>{locale === "zh-CN" ? "与全球成员一起参与" : "Join members worldwide"}</Text>
          <Text style={styles.activityIcon}>✧</Text>
          <Text style={styles.activityLink}>{locale === "zh-CN" ? "查看活动 ›" : "View events ›"}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/rewards")} style={[styles.activityCard, styles.activityCardGold]}>
          <Text style={styles.activityKicker}>BENEFITS</Text>
          <Text style={styles.activityTitle}>{locale === "zh-CN" ? "星球专属权益" : "Planet benefits"}</Text>
          <Text style={styles.activityDescription}>{locale === "zh-CN" ? "探索积分可兑换权益" : "Explore point benefits"}</Text>
          <Text style={styles.activityIcon}>◇</Text>
          <Text style={styles.activityLink}>{locale === "zh-CN" ? "了解更多 ›" : "Learn more ›"}</Text>
        </Pressable>
      </ScrollView>

      <SectionHeading title={locale === "zh-CN" ? "推荐原力" : "Recommended missions"} action={t("viewAll")} />
      <View style={styles.missionList}>
        <Pressable onPress={openTasks} style={styles.missionRow}>
          <View style={[styles.missionIcon, styles.missionIconPurple]}><Text style={styles.missionGlyph}>◎</Text></View>
          <View style={styles.missionCopy}>
            <Text style={styles.missionTitle}>{t("exploreMission")}</Text>
            <Text style={styles.missionMeta}>{locale === "zh-CN" ? "每日参与社区探索" : "Explore the community daily"}</Text>
          </View>
          <Text style={styles.missionReward}>+15 {t("points")}</Text>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>
        <View style={styles.rowDivider} />
        <Pressable onPress={openTasks} style={styles.missionRow}>
          <View style={[styles.missionIcon, styles.missionIconGold]}><Text style={styles.missionGlyph}>↗</Text></View>
          <View style={styles.missionCopy}>
            <Text style={styles.missionTitle}>{t("inviteMission")}</Text>
            <Text style={styles.missionMeta}>{locale === "zh-CN" ? "邀请朋友加入社区" : "Invite a friend to the community"}</Text>
          </View>
          <Text style={styles.missionReward}>+50 {t("points")}</Text>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>
      </View>
      <Text style={styles.bottomNote}>{locale === "zh-CN" ? "我是有底线的" : "You've reached the end"}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  statBar: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statPill: { flex: 1, minHeight: 38, borderRadius: 20, borderWidth: 1, borderColor: "#E5E1E9", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 5 },
  statDiamond: { color: "#8E4DCB", fontSize: 11 },
  statPower: { color: "#4D8B9D", fontSize: 13 },
  statName: { color: "#88838E", fontSize: 9, fontWeight: "600" },
  statNumber: { color: "#39343D", fontSize: 11, fontWeight: "800", flex: 1 },
  statChevron: { color: "#B9B3C0", fontSize: 16 },
  noticeBar: { height: 34, borderRadius: 18, backgroundColor: "#F7F4F9", borderWidth: 1, borderColor: "#EEE8F2", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 7, marginBottom: 10 },
  noticeSpeaker: { color: colors.brand, fontSize: 13 },
  noticeText: { flex: 1, color: "#817A88", fontSize: 9 },
  noticeMore: { color: colors.brand, fontSize: 8, fontWeight: "800" },
  planetStage: { height: 430, borderRadius: 12, overflow: "hidden", backgroundColor: "#1B0D2A", marginBottom: 7 },
  planetTopLine: { position: "absolute", top: 13, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planetTopTitle: { color: "#BFA6D9", fontSize: 8, letterSpacing: 1.2, fontWeight: "900" },
  planetClaim: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingTop: 18 },
  gemBadge: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(35,12,57,0.78)", borderWidth: 1, borderColor: "rgba(209,164,255,0.6)", alignItems: "center", justifyContent: "center", marginBottom: 9 },
  gemGlyph: { color: "#F0D3FF", fontSize: 25, textShadowColor: "#B978FF", textShadowRadius: 12 },
  claimCaption: { color: "#E3D1F5", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  claimValue: { color: "#FFFFFF", fontSize: 32, lineHeight: 38, fontWeight: "900", marginTop: 2 },
  claimUnit: { color: "#C5A8DF", fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  claimButton: { backgroundColor: "#FFFFFF", minWidth: 145, height: 37, borderRadius: 19, alignItems: "center", justifyContent: "center", marginTop: 15, paddingHorizontal: 16 },
  claimButtonText: { color: "#6E35A5", fontSize: 10, fontWeight: "900" },
  claimFootnote: { color: "#B89BCD", fontSize: 8, marginTop: 8, textAlign: "center" },
  planetStats: { position: "absolute", bottom: 0, left: 0, right: 0, minHeight: 62, backgroundColor: "rgba(16,7,27,0.7)", flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  planetStat: { flex: 1, gap: 5 },
  planetStatLabel: { color: "#AA91C0", fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  planetStatValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  planetStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 14 },
  activityRail: { gap: 9, paddingRight: 8, paddingBottom: 2 },
  activityCard: { width: 205, minHeight: 125, borderRadius: 10, padding: 13, overflow: "hidden", justifyContent: "space-between" },
  activityCardPurple: { backgroundColor: "#4B2772" },
  activityCardRose: { backgroundColor: "#77365C" },
  activityCardGold: { backgroundColor: "#76542D" },
  activityKicker: { color: "rgba(255,255,255,0.65)", fontSize: 7, letterSpacing: 1, fontWeight: "900" },
  activityTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", marginTop: 5 },
  activityDescription: { color: "rgba(255,255,255,0.76)", fontSize: 8, marginTop: 2 },
  activityIcon: { position: "absolute", right: 12, top: 17, color: "rgba(255,255,255,0.2)", fontSize: 48, fontWeight: "900" },
  activityLink: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", marginTop: 10 },
  missionList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#EEEAF1", paddingHorizontal: 2 },
  missionRow: { minHeight: 61, flexDirection: "row", alignItems: "center", gap: 9 },
  missionIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  missionIconPurple: { backgroundColor: "#F2E8FB" },
  missionIconGold: { backgroundColor: "#FFF3E2" },
  missionGlyph: { color: colors.brand, fontSize: 18, fontWeight: "800" },
  missionCopy: { flex: 1, gap: 4 },
  missionTitle: { color: "#37313D", fontSize: 10, fontWeight: "800" },
  missionMeta: { color: "#A09AA5", fontSize: 8 },
  missionReward: { color: colors.brand, fontSize: 9, fontWeight: "800" },
  rowArrow: { color: "#B7B1BD", fontSize: 19 },
  rowDivider: { height: 1, backgroundColor: "#F0EDF2", marginLeft: 44 },
  bottomNote: { alignSelf: "center", color: "#BAB5BF", fontSize: 8, paddingVertical: 7 }
});
