import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

export default function WalletScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const records = [
    { title: t("每日签到", "Daily check-in"), time: t("今天 09:12", "Today 09:12"), value: "+10" },
    { title: t("探索社区", "Explore community"), time: t("昨天 18:40", "Yesterday 18:40"), value: "+15" },
    { title: t("学习资源兑换", "Learning bundle redemption"), time: t("11月08日 15:20", "Nov 08 15:20"), value: "−800" },
    { title: t("邀请好友", "Invite a friend"), time: t("11月06日 12:05", "Nov 06 12:05"), value: "+50" }
  ];

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("积分记录", "Points record")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.totalBlock}>
        <Text style={styles.totalLabel}>{t("积分总数", "Total points")}</Text>
        <Text style={styles.totalValue}>2,480</Text>
        <Text style={styles.totalHint}>{t("BrightGlobe 社区积分", "BrightGlobe community points")}</Text>
      </View>

      <View style={styles.introSection}>
        <Text style={styles.sectionTitle}>{t("积分简介", "About points")}</Text>
        <Text style={styles.introText}>
          {t(
            "社区积分是 BrightGlobe 平台内的活动奖励单位，可依据平台规则参与权益兑换。积分不代表现金、存款、投资或保证收益。",
            "Community points are internal BrightGlobe reward units and may be used for eligible platform benefits under published rules. They are not cash, deposits, investments, or guaranteed returns."
          )}
        </Text>
      </View>

      <View style={styles.recordsHeader}>
        <Text style={styles.sectionTitle}>{t("收支记录", "Activity history")}</Text>
        <Text style={styles.recordCount}>{t("最近记录", "Recent activity")}</Text>
      </View>
      <View style={styles.recordList}>
        {records.map((record, index) => (
          <View key={record.title + record.time} style={[styles.recordRow, index !== records.length - 1 && styles.recordDivider]}>
            <View style={styles.recordCopy}>
              <Text style={styles.recordTitle}>{record.title}</Text>
              <Text style={styles.recordTime}>{record.time}</Text>
            </View>
            <Text style={[styles.recordValue, record.value.startsWith("−") && styles.recordValueUsed]}>
              {record.value}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.previewNote}>{t("以上为演示记录，尚未连接真实账户和积分账本。", "Preview records only. Account and points ledger are not connected.")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 28, height: 30, justifyContent: "center" },
  backGlyph: { color: "#4A434F", fontSize: 29, lineHeight: 30 },
  headerTitle: { color: "#3A3540", fontSize: 15, fontWeight: "800" },
  headerSpacer: { width: 28 },
  totalBlock: { paddingVertical: 23, borderBottomWidth: 1, borderColor: "#EEEAF1", gap: 5 },
  totalLabel: { color: "#89828E", fontSize: 10 },
  totalValue: { color: "#35303A", fontSize: 31, fontWeight: "900" },
  totalHint: { color: "#A59EAA", fontSize: 8 },
  introSection: { paddingVertical: 17, borderBottomWidth: 1, borderColor: "#EEEAF1", gap: 9 },
  sectionTitle: { color: "#4F4955", fontSize: 12, fontWeight: "900" },
  introText: { color: "#918B96", fontSize: 9, lineHeight: 16 },
  recordsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13 },
  recordCount: { color: "#A29BA7", fontSize: 8 },
  recordList: { borderTopWidth: 1, borderColor: "#EEEAF1" },
  recordRow: { minHeight: 57, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recordDivider: { borderBottomWidth: 1, borderColor: "#F0EDF2" },
  recordCopy: { gap: 4 },
  recordTitle: { color: "#4C4652", fontSize: 10, fontWeight: "700" },
  recordTime: { color: "#A8A2AD", fontSize: 8 },
  recordValue: { color: colors.success, fontSize: 11, fontWeight: "900" },
  recordValueUsed: { color: "#8F8994" },
  previewNote: { color: "#B4AEB9", fontSize: 8, lineHeight: 13, marginTop: 15 }
});
