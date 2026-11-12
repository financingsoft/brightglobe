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

export default function RewardsScreen() {
  const { t } = useI18n();

  const rewards = [
    { icon: "✧", title: t("rewardOne"), description: t("rewardOneDesc"), cost: "500" },
    { icon: "▤", title: t("rewardTwo"), description: t("rewardTwoDesc"), cost: "800" },
    { icon: "◉", title: t("rewardThree"), description: t("rewardThreeDesc"), cost: "1,200" }
  ];

  return (
    <AppScreen>
      <PageHeading title={t("rewardsTitle")} subtitle={t("rewardsSubtitle")} />
      <Panel style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>{t("availableBalance")}</Text>
        <Text style={styles.balanceValue}>2,480</Text>
        <Text style={styles.balanceHint}>{t("rewardPoints")} · {t("preview")}</Text>
      </Panel>

      <SectionHeading title={t("featured")} />
      {rewards.map((reward) => (
        <Panel key={reward.title} style={styles.rewardCard}>
          <View style={styles.rewardTop}>
            <View style={styles.rewardIcon}>
              <Text style={styles.rewardGlyph}>{reward.icon}</Text>
            </View>
            <View style={styles.rewardCopy}>
              <Text style={styles.rewardTitle}>{reward.title}</Text>
              <Text style={styles.rewardDescription}>{reward.description}</Text>
            </View>
          </View>
          <View style={styles.rewardBottom}>
            <Text style={styles.cost}>{reward.cost} {t("points")}</Text>
            <Pill label={t("available")} />
          </View>
        </Panel>
      ))}

      <Text style={styles.disclaimer}>{t("redemptionNote")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  balancePanel: { backgroundColor: colors.ink, borderColor: colors.ink, paddingVertical: 23 },
  balanceLabel: { color: "#C5D2E5", fontSize: 12, fontWeight: "700" },
  balanceValue: { color: "#FFFFFF", fontSize: 38, fontWeight: "800", marginTop: 5 },
  balanceHint: { color: "#C5D2E5", fontSize: 11, marginTop: 4 },
  rewardCard: { gap: 15 },
  rewardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  rewardIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  rewardGlyph: { color: colors.brand, fontSize: 22, fontWeight: "700" },
  rewardCopy: { flex: 1, gap: 4 },
  rewardTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  rewardDescription: { color: colors.inkMuted, fontSize: 11, lineHeight: 17 },
  rewardBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cost: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  disclaimer: { color: colors.inkMuted, fontSize: 11, lineHeight: 17 }
});
