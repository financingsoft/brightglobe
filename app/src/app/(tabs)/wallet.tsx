import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  PageHeading,
  Panel,
  Pill,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

type ActivityKind = "earned" | "used";

export default function WalletScreen() {
  const { locale, t } = useI18n();
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");

  const activity = [
    { id: "a1", title: t("dailyMission"), date: locale === "zh-CN" ? "今天 · 09:12" : "Today · 09:12", amount: "+10", kind: "earned" as const, icon: "☀" },
    { id: "a2", title: t("exploreMission"), date: locale === "zh-CN" ? "昨天 · 18:40" : "Yesterday · 18:40", amount: "+15", kind: "earned" as const, icon: "◎" },
    { id: "a3", title: t("rewardTwo"), date: locale === "zh-CN" ? "11月08日 · 15:20" : "Nov 08 · 15:20", amount: "−800", kind: "used" as const, icon: "▤" },
    { id: "a4", title: t("inviteMission"), date: locale === "zh-CN" ? "11月06日 · 12:05" : "Nov 06 · 12:05", amount: "+50", kind: "earned" as const, icon: "↗" }
  ];

  const visibleActivity = useMemo(
    () => filter === "all" ? activity : activity.filter((item) => item.kind === filter),
    [filter, locale]
  );

  return (
    <AppScreen>
      <PageHeading
        eyebrow={t("navMe").toUpperCase()}
        title={t("walletTitle")}
        subtitle={t("walletSubtitle")}
      />

      <View style={styles.walletHero}>
        <View style={styles.walletGlow} />
        <View style={styles.walletHeroTop}>
          <Text style={styles.walletHeroLabel}>{t("availableBalance")}</Text>
          <Pill label={t("preview")} tone="gold" />
        </View>
        <Text style={styles.walletBalance}>2,480</Text>
        <Text style={styles.walletUnit}>{t("rewardPoints")}</Text>
        <View style={styles.walletHeroBottom}>
          <View style={styles.walletHeroStat}>
            <Text style={styles.walletHeroStatLabel}>{t("pointsToday")}</Text>
            <Text style={styles.walletHeroStatValue}>+30</Text>
          </View>
          <View style={styles.walletHeroDivider} />
          <View style={styles.walletHeroStat}>
            <Text style={styles.walletHeroStatLabel}>{t("experience")}</Text>
            <Text style={styles.walletHeroStatValue}>860 XP</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryIcon}>↗</Text>
          <Text style={styles.summaryValue}>+1,260</Text>
          <Text style={styles.summaryLabel}>{locale === "zh-CN" ? "累计获得" : "Total earned"}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryIcon, styles.summaryIconGold]}>✧</Text>
          <Text style={styles.summaryValue}>860</Text>
          <Text style={styles.summaryLabel}>{t("walletXpLabel")}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryIcon, styles.summaryIconTeal]}>◎</Text>
          <Text style={styles.summaryValue}>1,280</Text>
          <Text style={styles.summaryLabel}>{t("contributionPower")}</Text>
        </View>
      </View>

      <SectionHeading title={t("transactionHistory")} />
      <View style={styles.filterRow}>
        {[
          { id: "all" as const, label: t("categoryAll") },
          { id: "earned" as const, label: locale === "zh-CN" ? "收入" : "Earned" },
          { id: "used" as const, label: locale === "zh-CN" ? "支出" : "Used" }
        ].map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item.id }}
            onPress={() => setFilter(item.id)}
            style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Panel style={styles.activityPanel}>
        {visibleActivity.length > 0 ? visibleActivity.map((item, index) => (
          <View key={item.id} style={[styles.activityRow, index !== visibleActivity.length - 1 && styles.activityBorder]}>
            <View style={styles.activityIcon}>
              <Text style={styles.activityGlyph}>{item.icon}</Text>
            </View>
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityDate}>{item.date}</Text>
            </View>
            <Text style={[styles.activityAmount, item.kind === "used" && styles.activityAmountUsed]}>
              {item.amount}
            </Text>
          </View>
        )) : (
          <Text style={styles.emptyText}>{t("noTransactions")}</Text>
        )}
      </Panel>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t("rewardPoints")}</Text>
        <Text style={styles.infoBody}>{t("pointsExplainer")}</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  walletHero: {
    minHeight: 220,
    borderRadius: 23,
    backgroundColor: colors.violetDeep,
    overflow: "hidden",
    padding: 19,
    gap: 4
  },
  walletGlow: { position: "absolute", width: 210, height: 210, borderRadius: 105, backgroundColor: "rgba(154,91,223,0.2)", right: -40, top: -70 },
  walletHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  walletHeroLabel: { color: "#DAC8EC", fontSize: 10, fontWeight: "800" },
  walletBalance: { color: "#FFFFFF", fontSize: 43, fontWeight: "900", letterSpacing: -1.1, marginTop: 13 },
  walletUnit: { color: "#C9B2E0", fontSize: 10, fontWeight: "700" },
  walletHeroBottom: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", marginTop: 18, paddingTop: 13, flexDirection: "row", alignItems: "center", gap: 20 },
  walletHeroStat: { flex: 1, gap: 5 },
  walletHeroStatLabel: { color: "#C9B2E0", fontSize: 9, fontWeight: "700" },
  walletHeroStatValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  walletHeroDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryTile: { flex: 1, minHeight: 104, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 11, borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  summaryIcon: { color: colors.brand, fontSize: 18, fontWeight: "900" },
  summaryIconGold: { color: "#B97916" },
  summaryIconTeal: { color: colors.teal },
  summaryValue: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  summaryLabel: { color: colors.inkMuted, fontSize: 8, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 8 },
  filterChipActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  filterText: { color: colors.inkMuted, fontSize: 9, fontWeight: "800" },
  filterTextActive: { color: "#FFFFFF" },
  activityPanel: { paddingVertical: 3, gap: 0 },
  activityRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  activityIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  activityGlyph: { color: colors.brand, fontSize: 17, fontWeight: "900" },
  activityCopy: { flex: 1, gap: 4 },
  activityTitle: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  activityDate: { color: colors.inkMuted, fontSize: 8 },
  activityAmount: { color: colors.success, fontSize: 13, fontWeight: "900" },
  activityAmountUsed: { color: colors.inkMuted },
  emptyText: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, paddingVertical: 14 },
  infoBox: { backgroundColor: "#F0E8F8", borderRadius: 16, padding: 14, gap: 5 },
  infoTitle: { color: colors.brandDark, fontSize: 10, fontWeight: "900" },
  infoBody: { color: "#76628D", fontSize: 9, lineHeight: 15 }
});
