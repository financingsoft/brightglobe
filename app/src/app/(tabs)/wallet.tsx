import { StyleSheet, Text } from "react-native";
import {
  AppScreen,
  InfoRow,
  PageHeading,
  Panel,
  Pill,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

export default function WalletScreen() {
  const { t } = useI18n();

  return (
    <AppScreen>
      <PageHeading title={t("walletTitle")} subtitle={t("walletSubtitle")} />
      <Panel style={styles.balancePanel}>
        <Pill label={t("preview")} tone="gold" />
        <Text style={styles.balanceLabel}>{t("availableBalance")}</Text>
        <Text style={styles.balanceValue}>2,480</Text>
        <Text style={styles.balanceUnit}>{t("rewardPoints")}</Text>
      </Panel>

      <Panel>
        <InfoRow label={t("accountStatus")} value={t("notConnected")} />
        <InfoRow label={t("noToken")} value="—" last />
      </Panel>

      <SectionHeading title={t("transactionHistory")} />
      <Panel style={styles.emptyPanel}>
        <Text style={styles.emptyIcon}>↔</Text>
        <Text style={styles.emptyTitle}>{t("noTransactions")}</Text>
      </Panel>

      <Panel style={styles.disclaimerPanel}>
        <Text style={styles.disclaimerTitle}>{t("rewardPoints")}</Text>
        <Text style={styles.disclaimerBody}>{t("pointsExplainer")}</Text>
      </Panel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  balancePanel: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    paddingVertical: 23,
    gap: 8
  },
  balanceLabel: { color: "#C5D2E5", fontSize: 12, fontWeight: "700", marginTop: 8 },
  balanceValue: { color: "#FFFFFF", fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  balanceUnit: { color: "#C5D2E5", fontSize: 11 },
  emptyPanel: { alignItems: "center", paddingVertical: 30 },
  emptyIcon: { color: colors.inkMuted, fontSize: 28 },
  emptyTitle: { color: colors.inkMuted, fontSize: 12, textAlign: "center", lineHeight: 19 },
  disclaimerPanel: { backgroundColor: "#F9FBFE" },
  disclaimerTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  disclaimerBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 18 }
});
