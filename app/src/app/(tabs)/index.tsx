import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  AppScreen,
  MetricCard,
  PageHeading,
  Panel,
  Pill,
  ProgressTrack,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { EarthBackground } from "@/components/earth/EarthBackground";
import { useI18n } from "@/i18n/locale";

export default function HomeScreen() {
  const { locale, t } = useI18n();
  const [isFocused, setIsFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  return (
    <AppScreen>
      <PageHeading
        eyebrow={t("homeEyebrow")}
        title={t("homeTitle")}
        subtitle={t("homeSubtitle")}
      />

      <View style={styles.heroPanel}>
        <EarthBackground active={isFocused} />
        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <Pill label={t("preview")} tone="gold" />
            <Text style={styles.heroSymbol}>✦</Text>
          </View>
          <Text style={styles.heroLabel}>{t("contributionPower")}</Text>
          <Text style={styles.heroValue}>1,280</Text>
          <Text style={styles.heroHint}>
            {t("currentLevel")}  ·  {t("levelLabel")} 4
          </Text>
          <View style={styles.heroDivider} />
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t("todayProgress")}</Text>
            <Text style={styles.progressCount}>2 / 4</Text>
          </View>
          <ProgressTrack progress={50} />
        </View>
      </View>

      <View style={styles.metricRow}>
        <MetricCard
          label={t("experience")}
          value="860 XP"
          footnote="Level 4"
          tone="blue"
        />
        <MetricCard
          label={t("rewardPoints")}
          value="2,480"
          footnote={t("preview")}
          tone="teal"
        />
      </View>

      <SectionHeading title={t("dailyTask")} action={t("viewAll")} />
      <Panel>
        <View style={styles.missionRow}>
          <View style={styles.missionIcon}>
            <Text style={styles.missionEmoji}>☀</Text>
          </View>
          <View style={styles.missionCopy}>
            <Text style={styles.missionTitle}>{t("checkinComplete")}</Text>
            <Text style={styles.missionMeta}>+20 XP · +10 {t("points")}</Text>
          </View>
          <Pill label={t("completed")} tone="green" />
        </View>
        <View style={styles.missionDivider} />
        <View style={styles.missionRow}>
          <View style={[styles.missionIcon, styles.missionIconBlue]}>
            <Text style={styles.missionEmoji}>◎</Text>
          </View>
          <View style={styles.missionCopy}>
            <Text style={styles.missionTitle}>{t("exploreMission")}</Text>
            <Text style={styles.missionMeta}>+30 XP · +15 {t("points")}</Text>
          </View>
          <Pill label={t("available")} />
        </View>
      </Panel>

      <SectionHeading title={t("weeklyActivity")} />
      <Panel>
        <View style={styles.weekRow}>
          {[28, 52, 36, 76, 58, 90, 43].map((height, index) => (
            <View key={index} style={styles.weekColumn}>
              <View style={styles.weekBarTrack}>
                <View style={[styles.weekBar, { height: height + "%" }]} />
              </View>
              <Text style={styles.weekDay}>
                {(locale === "zh-CN" ? ["一", "二", "三", "四", "五", "六", "日"] : ["M", "T", "W", "T", "F", "S", "S"])[index]}
              </Text>
            </View>
          ))}
        </View>
      </Panel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    gap: 10,
    position: "relative",
    overflow: "hidden"
  },
  heroContent: {
    gap: 10,
    zIndex: 1
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroSymbol: { color: "#86AFFF", fontSize: 25 },
  heroLabel: { color: "#C5D2E5", fontSize: 12, fontWeight: "700", marginTop: 8 },
  heroValue: { color: "#FFFFFF", fontSize: 42, fontWeight: "800", letterSpacing: -1.5 },
  heroHint: { color: "#C5D2E5", fontSize: 12 },
  heroDivider: { height: 1, backgroundColor: "#34465C", marginVertical: 8 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  progressCount: { color: "#C5D2E5", fontSize: 12, fontWeight: "700" },
  metricRow: { flexDirection: "row", gap: 12 },
  missionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  missionIcon: {
    height: 40,
    width: 40,
    borderRadius: 13,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  missionIconBlue: { backgroundColor: colors.brandSoft },
  missionEmoji: { fontSize: 19, color: colors.ink },
  missionCopy: { flex: 1, gap: 3 },
  missionTitle: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  missionMeta: { color: colors.inkMuted, fontSize: 11 },
  missionDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  weekRow: { height: 116, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  weekColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 9 },
  weekBarTrack: {
    height: 86,
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#F0F3F8",
    justifyContent: "flex-end",
    overflow: "hidden"
  },
  weekBar: { width: "100%", borderRadius: 8, backgroundColor: colors.brand },
  weekDay: { color: colors.inkMuted, fontSize: 10, fontWeight: "700" }
});
