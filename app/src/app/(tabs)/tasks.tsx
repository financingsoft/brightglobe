import { StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  PageHeading,
  Panel,
  Pill,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

export default function TasksScreen() {
  const { t } = useI18n();

  const missions = [
    { icon: "☀", title: t("dailyMission"), detail: "Daily participation", reward: "+20 XP · +10" + " " + t("points"), status: t("completed"), tone: "green" as const },
    { icon: "◎", title: t("exploreMission"), detail: "Discover topics and communities", reward: "+30 XP · +15" + " " + t("points"), status: t("available"), tone: "blue" as const },
    { icon: "↗", title: t("inviteMission"), detail: "Share BrightGlobe with someone", reward: "+100 XP · +50" + " " + t("points"), status: t("available"), tone: "blue" as const }
  ];

  return (
    <AppScreen>
      <PageHeading title={t("tasksTitle")} subtitle={t("tasksSubtitle")} />
      <Panel style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>{t("todayProgress")}</Text>
          <Text style={styles.summaryValue}>1 / 3</Text>
        </View>
        <Pill label={t("preview")} tone="gold" />
      </Panel>

      <SectionHeading title={t("dailyTask")} />
      {missions.map((mission) => (
        <Panel key={mission.title} style={styles.missionCard}>
          <View style={styles.missionTop}>
            <View style={styles.iconBox}>
              <Text style={styles.iconText}>{mission.icon}</Text>
            </View>
            <View style={styles.missionBody}>
              <Text style={styles.missionTitle}>{mission.title}</Text>
              <Text style={styles.missionDetail}>{mission.detail}</Text>
            </View>
            <Pill label={mission.status} tone={mission.tone} />
          </View>
          <View style={styles.rewardLine}>
            <Text style={styles.rewardLabel}>{mission.reward}</Text>
          </View>
        </Panel>
      ))}

      <Panel style={styles.note}>
        <Text style={styles.noteTitle}>{t("missionHint")}</Text>
        <Text style={styles.noteBody}>
          {t("apiNotice")}
        </Text>
      </Panel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandSoft
  },
  summaryLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  summaryValue: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  missionCard: { gap: 12 },
  missionTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F4FB"
  },
  iconText: { color: colors.ink, fontSize: 20 },
  missionBody: { flex: 1, gap: 4 },
  missionTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  missionDetail: { color: colors.inkMuted, fontSize: 11 },
  rewardLine: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11 },
  rewardLabel: { color: colors.brand, fontSize: 12, fontWeight: "800" },
  note: { backgroundColor: "#F9FBFE" },
  noteTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  noteBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 17 }
});
