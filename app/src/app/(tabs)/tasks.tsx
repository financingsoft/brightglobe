import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  PageHeading,
  Panel,
  Pill,
  ProgressTrack,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

type MissionCategory = "daily" | "social" | "create" | "explore";

export default function TasksScreen() {
  const { locale, t } = useI18n();
  const [category, setCategory] = useState<"all" | MissionCategory>("all");

  const missions = [
    { id: "checkin", category: "daily" as const, icon: "☀", title: t("dailyMission"), detail: t("taskDailyDetail"), reward: "+20 XP · +10 " + t("points"), status: t("completed"), tone: "green" as const },
    { id: "community", category: "social" as const, icon: "◎", title: t("exploreMission"), detail: t("taskExploreDetail"), reward: "+30 XP · +15 " + t("points"), status: t("available"), tone: "blue" as const },
    { id: "creator", category: "create" as const, icon: "✎", title: locale === "zh-CN" ? "发布一条原创内容" : "Publish an original post", detail: locale === "zh-CN" ? "分享你的知识、经验或创意。" : "Share your knowledge, experience, or idea.", reward: "+50 XP · +25 " + t("points"), status: t("available"), tone: "blue" as const },
    { id: "invite", category: "social" as const, icon: "↗", title: t("inviteMission"), detail: t("taskInviteDetail"), reward: "+100 XP · +50 " + t("points"), status: t("available"), tone: "blue" as const },
    { id: "discover", category: "explore" as const, icon: "✧", title: locale === "zh-CN" ? "探索一个新领域" : "Explore a new topic", detail: locale === "zh-CN" ? "浏览一个新主题并关注感兴趣的内容。" : "Browse a new topic and follow something you like.", reward: "+25 XP · +12 " + t("points"), status: t("available"), tone: "blue" as const }
  ];

  const filters = [
    { id: "all" as const, label: t("categoryAll") },
    { id: "daily" as const, label: t("categoryDaily") },
    { id: "social" as const, label: t("categorySocial") },
    { id: "create" as const, label: t("categoryCreate") },
    { id: "explore" as const, label: t("categoryExplore") }
  ];

  const visibleMissions = useMemo(
    () => category === "all" ? missions : missions.filter((mission) => mission.category === category),
    [category, locale]
  );

  return (
    <AppScreen>
      <PageHeading
        eyebrow={t("navDiscover").toUpperCase()}
        title={t("tasksTitle")}
        subtitle={t("tasksSubtitle")}
      />

      <View style={styles.forceBanner}>
        <View style={styles.forceBannerOrb}>
          <Text style={styles.forceBannerOrbText}>✦</Text>
        </View>
        <View style={styles.forceBannerCopy}>
          <Text style={styles.forceBannerLabel}>{t("contributionPower")}</Text>
          <Text style={styles.forceBannerValue}>1,280</Text>
          <Text style={styles.forceBannerHint}>{t("missionHint")}</Text>
        </View>
        <View style={styles.bannerLevel}>
          <Text style={styles.bannerLevelNumber}>04</Text>
          <Text style={styles.bannerLevelLabel}>LEVEL</Text>
        </View>
      </View>

      <Panel style={styles.progressCard}>
        <View style={styles.progressHead}>
          <View>
            <Text style={styles.progressTitle}>{t("todayProgress")}</Text>
            <Text style={styles.progressCount}>2 / 5</Text>
          </View>
          <Pill label={t("preview")} tone="gold" />
        </View>
        <ProgressTrack progress={40} />
        <Text style={styles.progressFoot}>{t("streak")}: 5 {t("days")}</Text>
      </Panel>

      <SectionHeading title={t("discoverCategories")} />
      <View style={styles.filterRow}>
        {filters.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: category === item.id }}
            onPress={() => setCategory(item.id)}
            style={[styles.filterChip, category === item.id && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, category === item.id && styles.filterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionHeading title={category === "all" ? t("allMissions") : t("missionReward")} />
      {visibleMissions.map((mission) => (
        <Panel key={mission.id} style={styles.missionCard}>
          <View style={styles.missionTop}>
            <View style={styles.missionIcon}>
              <Text style={styles.missionGlyph}>{mission.icon}</Text>
            </View>
            <View style={styles.missionCopy}>
              <Text style={styles.missionTitle}>{mission.title}</Text>
              <Text style={styles.missionDetail}>{mission.detail}</Text>
            </View>
            <Pill label={mission.status} tone={mission.tone} />
          </View>
          <View style={styles.missionBottom}>
            <Text style={styles.rewardLabel}>{mission.reward}</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
        </Panel>
      ))}

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>{locale === "zh-CN" ? "关于任务奖励" : "About mission rewards"}</Text>
        <Text style={styles.noteBody}>{t("apiNotice")}</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  forceBanner: {
    minHeight: 150,
    borderRadius: 22,
    overflow: "hidden",
    padding: 18,
    backgroundColor: colors.violetDeep,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  forceBannerOrb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(198,145,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(225,193,255,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  forceBannerOrbText: { color: "#F5D1FF", fontSize: 35, fontWeight: "900" },
  forceBannerCopy: { flex: 1, gap: 4 },
  forceBannerLabel: { color: "#D4C1E8", fontSize: 10, fontWeight: "800" },
  forceBannerValue: { color: "#FFFFFF", fontSize: 32, fontWeight: "900" },
  forceBannerHint: { color: "#C7AEDF", fontSize: 9, lineHeight: 13 },
  bannerLevel: { alignItems: "center", justifyContent: "center", width: 45, height: 50, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.11)" },
  bannerLevelNumber: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  bannerLevelLabel: { color: "#C7AEDF", fontSize: 7, fontWeight: "800" },
  progressCard: { gap: 11 },
  progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressTitle: { color: colors.inkMuted, fontSize: 10, fontWeight: "800" },
  progressCount: { color: colors.ink, fontSize: 25, fontWeight: "900", marginTop: 3 },
  progressFoot: { color: colors.inkMuted, fontSize: 9 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filterChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF" },
  filterChipActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  filterText: { color: colors.inkMuted, fontSize: 10, fontWeight: "800" },
  filterTextActive: { color: "#FFFFFF" },
  missionCard: { gap: 12 },
  missionTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  missionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft },
  missionGlyph: { color: colors.brand, fontSize: 20, fontWeight: "900" },
  missionCopy: { flex: 1, gap: 4 },
  missionTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  missionDetail: { color: colors.inkMuted, fontSize: 9, lineHeight: 14 },
  missionBottom: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rewardLabel: { color: colors.brand, fontSize: 10, fontWeight: "900" },
  arrow: { color: "#B4A8C0", fontSize: 22 },
  noteCard: { backgroundColor: "#F0E8F8", borderRadius: 16, padding: 14, gap: 5 },
  noteTitle: { color: colors.brandDark, fontSize: 10, fontWeight: "900" },
  noteBody: { color: "#75618C", fontSize: 9, lineHeight: 14 }
});
