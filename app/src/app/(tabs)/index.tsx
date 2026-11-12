import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  AppScreen,
  MetricCard,
  PageHeading,
  Panel,
  Pill,
  PrimaryButton,
  ProgressTrack,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { EarthBackground } from "@/components/earth/EarthBackground";
import { useI18n } from "@/i18n/locale";

const shortcuts = [
  { key: "shortcutTasks" as const, icon: "✣", route: "/tasks" as const },
  { key: "shortcutEvents" as const, icon: "✧", route: "/rewards" as const },
  { key: "shortcutWallet" as const, icon: "▤", route: "/wallet" as const },
  { key: "shortcutInvite" as const, icon: "↗", route: "/profile" as const }
];

export default function HomeScreen() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(true);
  const [claimed, setClaimed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  return (
    <AppScreen>
      <View style={styles.welcomeRow}>
        <View style={styles.welcomeCopy}>
          <Text style={styles.welcomeEyebrow}>{t("homeEyebrow")}</Text>
          <Text style={styles.welcomeTitle}>{t("homeTitle")}</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelIcon}>✦</Text>
          <Text style={styles.levelText}>LV.04</Text>
        </View>
      </View>
      <Text style={styles.welcomeSubtitle}>{t("homeSubtitle")}</Text>

      <View style={styles.planetPanel}>
        <EarthBackground active={isFocused} />
        <View style={styles.planetOverlay}>
          <View style={styles.planetTop}>
            <Pill label={t("preview")} tone="gold" />
            <Text style={styles.planetSpark}>✧</Text>
          </View>
          <View style={styles.powerBlock}>
            <Text style={styles.powerLabel}>{t("contributionPower")}</Text>
            <Text style={styles.powerValue}>1,280</Text>
            <Text style={styles.powerMeta}>{t("contributionRank")} · {t("memberLevel")}</Text>
          </View>
          <View style={styles.planetBottom}>
            <View style={styles.planetMiniStat}>
              <Text style={styles.planetMiniLabel}>{t("experience")}</Text>
              <Text style={styles.planetMiniValue}>860 XP</Text>
            </View>
            <View style={styles.planetMiniDivider} />
            <View style={styles.planetMiniStat}>
              <Text style={styles.planetMiniLabel}>{t("rewardPoints")}</Text>
              <Text style={styles.planetMiniValue}>2,480</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.dailyRewardCard}>
        <View style={styles.dailyRewardTop}>
          <View style={styles.dailyRewardIcon}>
            <Text style={styles.dailyRewardGlyph}>✦</Text>
          </View>
          <View style={styles.dailyRewardCopy}>
            <Text style={styles.dailyRewardTitle}>{t("dailyYield")}</Text>
            <Text style={styles.dailyRewardMeta}>+20 XP  ·  +10 {t("points")}</Text>
          </View>
          <View style={styles.todayTag}>
            <Text style={styles.todayTagText}>+10</Text>
          </View>
        </View>
        <PrimaryButton
          label={claimed ? t("collected") : t("collectNow")}
          onPress={() => setClaimed(true)}
        />
        {claimed ? (
          <Text style={styles.claimedNote}>
            {locale === "zh-CN" ? "演示状态：领取按钮已完成本地交互，尚未连接真实奖励接口。" : "Demo state only. No real reward has been credited."}
          </Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <MetricCard
          label={t("pointsToday")}
          value="+30"
          footnote={t("rewardPoints")}
          tone="gold"
        />
        <MetricCard
          label={t("streak")}
          value={locale === "zh-CN" ? "5 天" : "5 days"}
          footnote={t("todayProgress")}
          tone="teal"
        />
      </View>

      <SectionHeading title={t("shortcuts")} action={t("viewAll")} />
      <View style={styles.shortcutGrid}>
        {shortcuts.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => router.push(item.route)}
            style={({ pressed }) => [styles.shortcutTile, pressed && styles.pressed]}
          >
            <View style={styles.shortcutIcon}>
              <Text style={styles.shortcutGlyph}>{item.icon}</Text>
            </View>
            <Text style={styles.shortcutLabel}>{t(item.key)}</Text>
            <Text style={styles.shortcutArrow}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.bulletin}>
        <View style={styles.bulletinIcon}>
          <Text style={styles.bulletinGlyph}>⌁</Text>
        </View>
        <View style={styles.bulletinCopy}>
          <Text style={styles.bulletinTitle}>{t("bulletin")}</Text>
          <Text style={styles.bulletinText}>{t("bulletinText")}</Text>
        </View>
        <Text style={styles.bulletinArrow}>›</Text>
      </View>

      <SectionHeading title={t("recommended")} action={t("viewAll")} />
      <Panel style={styles.recommendedCard}>
        <View style={styles.recommendIcon}>
          <Text style={styles.recommendGlyph}>◎</Text>
        </View>
        <View style={styles.recommendCopy}>
          <Text style={styles.recommendTitle}>{t("exploreMission")}</Text>
          <Text style={styles.recommendMeta}>{t("taskExploreDetail")}</Text>
          <Text style={styles.recommendReward}>+30 XP  ·  +15 {t("points")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/tasks")}
          style={styles.smallArrowButton}
        >
          <Text style={styles.smallArrow}>›</Text>
        </Pressable>
      </Panel>

      <View style={styles.weeklyFooter}>
        <Text style={styles.weeklyTitle}>{t("weeklyActivity")}</Text>
        <View style={styles.weekBars}>
          {[28, 52, 36, 76, 58, 90, 43].map((height, index) => (
            <View key={index} style={styles.weekColumn}>
              <View style={styles.weekTrack}>
                <View style={[styles.weekFill, { height: height + "%" }]} />
              </View>
              <Text style={styles.weekDay}>
                {(locale === "zh-CN" ? ["一", "二", "三", "四", "五", "六", "日"] : ["M", "T", "W", "T", "F", "S", "S"])[index]}
              </Text>
            </View>
          ))}
        </View>
        <ProgressTrack progress={50} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  welcomeCopy: { flex: 1, gap: 4 },
  welcomeEyebrow: { color: colors.brand, fontSize: 9, letterSpacing: 1, fontWeight: "900" },
  welcomeTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.6 },
  welcomeSubtitle: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, marginTop: -12 },
  levelBadge: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: "#E8D9FC"
  },
  levelIcon: { color: colors.brand, fontSize: 17, fontWeight: "900" },
  levelText: { color: colors.brandDark, fontSize: 8, fontWeight: "900", marginTop: 1 },
  planetPanel: {
    height: 322,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: colors.purpleNight,
    position: "relative",
    borderWidth: 1,
    borderColor: "#382054"
  },
  planetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 18
  },
  planetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planetSpark: { color: "#E4C5FF", fontSize: 25 },
  powerBlock: { marginTop: 4, maxWidth: "65%", gap: 4 },
  powerLabel: { color: "#E5D9F3", fontSize: 10, fontWeight: "800" },
  powerValue: { color: "#FFFFFF", fontSize: 40, lineHeight: 45, fontWeight: "900", letterSpacing: -1.5 },
  powerMeta: { color: "#D2B9EA", fontSize: 9, fontWeight: "700" },
  planetBottom: {
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: "rgba(232,213,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingTop: 12
  },
  planetMiniStat: { flex: 1, gap: 5 },
  planetMiniLabel: { color: "#C7B6D9", fontSize: 9, fontWeight: "700" },
  planetMiniValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  planetMiniDivider: { width: 1, height: 31, backgroundColor: "rgba(232,213,255,0.22)" },
  dailyRewardCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 13
  },
  dailyRewardTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  dailyRewardIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" },
  dailyRewardGlyph: { color: "#BD7B17", fontSize: 21, fontWeight: "900" },
  dailyRewardCopy: { flex: 1, gap: 4 },
  dailyRewardTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  dailyRewardMeta: { color: colors.inkMuted, fontSize: 10 },
  todayTag: { backgroundColor: colors.goldSoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12 },
  todayTagText: { color: "#9A5A06", fontSize: 12, fontWeight: "900" },
  claimedNote: { color: colors.inkMuted, fontSize: 9, lineHeight: 14 },
  statsRow: { flexDirection: "row", gap: 11 },
  shortcutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shortcutTile: {
    width: "48%",
    minHeight: 82,
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  pressed: { opacity: 0.82 },
  shortcutIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  shortcutGlyph: { color: colors.brand, fontSize: 18, fontWeight: "900" },
  shortcutLabel: { color: colors.ink, fontSize: 10, lineHeight: 14, fontWeight: "800", flex: 1 },
  shortcutArrow: { color: "#B5A9C1", fontSize: 22 },
  bulletin: {
    backgroundColor: "#F0E6FC",
    borderRadius: 17,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  bulletinIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E0C9FA", alignItems: "center", justifyContent: "center" },
  bulletinGlyph: { color: colors.brandDark, fontSize: 22, fontWeight: "900" },
  bulletinCopy: { flex: 1, gap: 4 },
  bulletinTitle: { color: colors.brandDark, fontSize: 11, fontWeight: "900" },
  bulletinText: { color: "#75618C", fontSize: 9, lineHeight: 14 },
  bulletinArrow: { color: colors.brandDark, fontSize: 24 },
  recommendedCard: { flexDirection: "row", alignItems: "center", gap: 11 },
  recommendIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  recommendGlyph: { color: colors.teal, fontSize: 21, fontWeight: "900" },
  recommendCopy: { flex: 1, gap: 4 },
  recommendTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  recommendMeta: { color: colors.inkMuted, fontSize: 9, lineHeight: 13 },
  recommendReward: { color: colors.brand, fontSize: 9, fontWeight: "900", marginTop: 1 },
  smallArrowButton: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  smallArrow: { color: colors.brand, fontSize: 22, lineHeight: 24 },
  weeklyFooter: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, gap: 13 },
  weeklyTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  weekBars: { height: 93, flexDirection: "row", gap: 8 },
  weekColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 7 },
  weekTrack: { height: 70, width: "100%", justifyContent: "flex-end", borderRadius: 7, overflow: "hidden", backgroundColor: "#F2EEF6" },
  weekFill: { width: "100%", backgroundColor: colors.brand, borderRadius: 7 },
  weekDay: { color: colors.inkMuted, fontSize: 8, fontWeight: "800" }
});
