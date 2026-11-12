import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function WalletScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const records = [
    { title: t("每日签到", "Daily check-in"), time: t("今天 09:12", "Today 09:12"), value: "+3" },
    { title: t("阅读精选内容", "Read selected content"), time: t("昨天 18:40", "Yesterday 18:40"), value: "+1.2" },
    { title: t("社区活动参与", "Community activity"), time: t("11月08日 15:20", "Nov 08 15:20"), value: "+5" },
    { title: t("任务奖励发放", "Mission reward"), time: t("11月06日 12:05", "Nov 06 12:05"), value: "+2.0" }
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
        </View>
        <Text style={styles.totalValue}>122.90001</Text>
        <View style={styles.frozenRow}>
          <Text style={styles.frozenLabel}>{t("冻结黑钻数", "Frozen points")}</Text>
          <Text style={styles.frozenValue}>0</Text>
        </View>
        <Pressable onPress={() => setShowAccountInfo(true)} style={styles.manageRow}>
          <Text style={styles.manageLabel}>{t("账户管理", "Account management")}</Text>
          <Text style={styles.manageAction}>{t("积分账户说明", "Points account details")} ›</Text>
        </Pressable>
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
      <Modal visible={showAccountInfo} transparent animationType="fade" onRequestClose={() => setShowAccountInfo(false)}>
        <View style={styles.scrim}>
          <View style={styles.manageDialog}>
            <Text style={styles.manageTitle}>{t("BrightGlobe 积分账户", "BrightGlobe points account")}</Text>
            <Text style={styles.manageCopy}>{t("社区积分是平台内部的活动记录单位，不是加密货币或现金。此预览不提供钱包地址、私钥、转账或真实兑换功能。", "Community points are internal activity units, not cryptocurrency or cash. This preview does not provide wallet addresses, private keys, transfers, or live redemption.")}</Text>
            <Pressable onPress={() => setShowAccountInfo(false)} style={styles.manageClose}><Text style={styles.manageCloseText}>{t("知道了", "Got it")}</Text></Pressable>
          </View>
        </View>
      </Modal>
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
  frozenRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#EEEEEE", paddingTop: 7, marginTop: 3 },
  frozenLabel: { color: "#888888", fontSize: 8 },
  frozenValue: { color: "#777777", fontSize: 8 },
  manageRow: { minHeight: 31, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#EEEEEE", marginTop: 2 },
  manageLabel: { color: "#777777", fontSize: 8 },
  manageAction: { color: "#777777", fontSize: 8 },
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
  previewNote: { color: "#AAAAAA", fontSize: 7, lineHeight: 12, marginTop: 12 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 28 },
  manageDialog: { backgroundColor: "#FFFFFF", width: "100%", maxWidth: 310, borderRadius: 8, padding: 18, alignItems: "center", gap: 10 },
  manageTitle: { color: "#333333", fontSize: 12, fontWeight: "700" },
  manageCopy: { color: "#777777", fontSize: 8, lineHeight: 14, textAlign: "center" },
  manageClose: { minWidth: 88, height: 30, borderRadius: 16, backgroundColor: "#555555", alignItems: "center", justifyContent: "center" },
  manageCloseText: { color: "#FFFFFF", fontSize: 8, fontWeight: "600" }
});