import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function WalletScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const records = [
    { title: t("每日签到", "Daily check-in"), time: t("今天 09:12", "Today 09:12"), value: "+3" },
    { title: t("阅读精选内容", "Read selected content"), time: t("昨天 18:40", "Yesterday 18:40"), value: "+1.2" },
    { title: t("社区活动参与", "Community activity"), time: t("11月08日 15:20", "Nov 08 15:20"), value: "+5" },
    { title: t("权益兑换", "Benefit redemption"), time: t("11月06日 12:05", "Nov 06 12:05"), value: "−8" }
  ];

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerAction}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("黑钻记录", "Points record")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} style={styles.headerAction}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.totalBlock}>
        <View style={styles.totalHeading}>
          <Text style={styles.totalLabel}>{t("黑钻总数", "Total points")}</Text>
          <Pressable onPress={() => router.push("/rewards")}><Text style={styles.exchange}>{t("兑换权益", "Benefits")} ›</Text></Pressable>
        </View>
        <Text style={styles.totalValue}>122.90001</Text>
        <View style={styles.frozenRow}>
          <Text style={styles.frozenLabel}>{t("冻结黑钻数", "Frozen points")}</Text>
          <Text style={styles.frozenValue}>0</Text>
        </View>
        <Text style={styles.totalHint}>{t("BrightGlobe 社区积分 · 预览数据", "BrightGlobe community points · Preview data")}</Text>
      </View>

      <View style={styles.introSection}>
        <Text style={styles.sectionTitle}>{t("黑钻简介", "About points")}</Text>
        <Text style={styles.introText}>
          {t(
            "社区积分是 BrightGlobe 平台内的活动奖励单位。积分余额和记录仅用于演示页面结构，不代表现金、存款、投资或保证收益。",
            "Community points are internal BrightGlobe activity rewards. The balance and ledger are preview data only and are not cash, deposits, investments, or guaranteed returns."
          )}
        </Text>
      </View>

      <View style={styles.recordsHeader}>
        <Text style={styles.sectionTitle}>{t("黑钻收支记录", "Points activity")}</Text>
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
  header: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  headerAction: { width: 28, height: 30, justifyContent: "center" },
  backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 },
  closeGlyph: { color: "#555555", fontSize: 24, lineHeight: 27, textAlign: "right" },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "700" },
  totalBlock: { paddingVertical: 14, borderBottomWidth: 1, borderColor: "#DDDDDD", gap: 5 },
  totalHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { color: "#777777", fontSize: 9 },
  totalValue: { color: "#333333", fontSize: 25, fontWeight: "700" },
  exchange: { color: "#666666", fontSize: 8 },
  frozenRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#EEEEEE", paddingTop: 7, marginTop: 3 },
  frozenLabel: { color: "#888888", fontSize: 8 },
  frozenValue: { color: "#777777", fontSize: 8 },
  totalHint: { color: "#AAAAAA", fontSize: 7 },
  introSection: { paddingVertical: 13, borderBottomWidth: 1, borderColor: "#E3E3E3", gap: 7 },
  sectionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" },
  introText: { color: "#777777", fontSize: 8, lineHeight: 14 },
  recordsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11 },
  recordCount: { color: "#999999", fontSize: 7 },
  recordList: { borderTopWidth: 1, borderColor: "#E5E5E5" },
  recordRow: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recordDivider: { borderBottomWidth: 1, borderColor: "#EAEAEA" },
  recordCopy: { gap: 4 },
  recordTitle: { color: "#444444", fontSize: 9, fontWeight: "600" },
  recordTime: { color: "#999999", fontSize: 7 },
  recordValue: { color: "#777777", fontSize: 10, fontWeight: "700" },
  recordValueUsed: { color: "#999999" },
  previewNote: { color: "#AAAAAA", fontSize: 7, lineHeight: 12, marginTop: 12 }
});