import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
    { title: t("邀请新成员", "Invite a member"), time: t("11月06日 12:05", "Nov 06 12:05"), value: "+2" }
  ];

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerAction}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("我的钱包", "My wallet")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} style={styles.headerAction}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t("黑钻总数", "Total points")}</Text>
        <Text style={styles.balanceValue}>122.90001</Text>
        <View style={styles.balanceFooter}>
          <Text style={styles.balanceFootnote}>{t("冻结黑钻数  0", "Frozen points  0")}</Text>
          <Text style={styles.previewBadge}>{t("预览账户", "Preview account")}</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => setShowAccountInfo(true)} style={styles.manageRow}>
        <View style={styles.manageIcon}><Text style={styles.manageGlyph}>◎</Text></View>
        <View style={styles.manageCopy}>
          <Text style={styles.manageTitle}>{t("账户管理", "Account management")}</Text>
          <Text style={styles.manageHint}>{t("查看积分账户规则与使用说明", "View points account rules and details")}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.shortcutRow}>
        <Pressable onPress={() => setShowAccountInfo(true)} style={styles.shortcut}>
          <Text style={styles.shortcutGlyph}>◇</Text>
          <Text style={styles.shortcutTitle}>{t("积分规则", "Points rules")}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/points-record")} style={styles.shortcut}>
          <Text style={styles.shortcutGlyph}>▤</Text>
          <Text style={styles.shortcutTitle}>{t("黑钻明细", "Points history")}</Text>
        </Pressable>
      </View>

      <View style={styles.recordsHeader}>
        <Text style={styles.sectionTitle}>{t("最近交易记录", "Recent transactions")}</Text>
        <Pressable onPress={() => router.push("/points-record")}><Text style={styles.viewAll}>{t("全部", "All")} ›</Text></Pressable>
      </View>
      <View style={styles.recordList}>
        {records.map((record, index) => (
          <View key={record.title + record.time} style={[styles.recordRow, index !== records.length - 1 && styles.recordDivider]}>
            <View style={styles.recordCopy}>
              <Text style={styles.recordTitle}>{record.title}</Text>
              <Text style={styles.recordTime}>{record.time}</Text>
            </View>
            <Text style={styles.recordValue}>{record.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.previewNote}>{t("此页面展示 BrightGlobe 内部社区积分，不提供区块链地址、私钥、转账或现金兑换。以上为本地预览数据。", "This page shows internal BrightGlobe community points. Blockchain addresses, private keys, transfers, and cash redemption are not provided. All data is local preview content.")}</Text>

      <Modal visible={showAccountInfo} transparent animationType="fade" onRequestClose={() => setShowAccountInfo(false)}>
        <View style={styles.scrim}>
          <View style={styles.manageDialog}>
            <Text style={styles.manageDialogTitle}>{t("BrightGlobe 积分账户", "BrightGlobe points account")}</Text>
            <Text style={styles.manageDialogCopy}>{t("社区积分是平台内部的活动记录单位，不是加密货币或现金。积分余额和记录仅用于展示，不代表存款、投资或保证收益。", "Community points are internal activity units, not cryptocurrency or cash. Balances and records are for display only and do not represent deposits, investments, or guaranteed returns.")}</Text>
            <Pressable onPress={() => setShowAccountInfo(false)} style={styles.dismissButton}><Text style={styles.dismissText}>{t("知道了", "Got it")}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  headerAction: { width: 28, height: 30, justifyContent: "center" },
  backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 },
  closeGlyph: { color: "#555555", fontSize: 24, lineHeight: 27, textAlign: "right" },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "700" },
  balanceCard: { paddingTop: 17, paddingBottom: 14, borderBottomWidth: 1, borderColor: "#E0E0E0", gap: 6 },
  balanceLabel: { color: "#777777", fontSize: 9 },
  balanceValue: { color: "#333333", fontSize: 25, fontWeight: "700" },
  balanceFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  balanceFootnote: { color: "#888888", fontSize: 8 },
  previewBadge: { color: "#999999", fontSize: 7, borderWidth: 1, borderColor: "#DDDDDD", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  manageRow: { minHeight: 61, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "#E6E6E6", gap: 9 },
  manageIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: "#F1F1F1", alignItems: "center", justifyContent: "center" },
  manageGlyph: { color: "#666666", fontSize: 19 },
  manageCopy: { flex: 1, gap: 4 },
  manageTitle: { color: "#444444", fontSize: 9, fontWeight: "700" },
  manageHint: { color: "#999999", fontSize: 7 },
  chevron: { color: "#999999", fontSize: 18 },
  shortcutRow: { flexDirection: "row", paddingVertical: 13, borderBottomWidth: 1, borderColor: "#E6E6E6" },
  shortcut: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", gap: 5 },
  shortcutGlyph: { color: "#666666", fontSize: 18 },
  shortcutTitle: { color: "#777777", fontSize: 8 },
  recordsHeader: { minHeight: 37, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" },
  viewAll: { color: "#888888", fontSize: 8 },
  recordList: { borderTopWidth: 1, borderColor: "#E5E5E5" },
  recordRow: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recordDivider: { borderBottomWidth: 1, borderColor: "#EAEAEA" },
  recordCopy: { gap: 4 },
  recordTitle: { color: "#444444", fontSize: 9, fontWeight: "600" },
  recordTime: { color: "#999999", fontSize: 7 },
  recordValue: { color: "#777777", fontSize: 10, fontWeight: "700" },
  previewNote: { color: "#AAAAAA", fontSize: 7, lineHeight: 12, marginTop: 12 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 28 },
  manageDialog: { backgroundColor: "#FFFFFF", width: "100%", maxWidth: 310, borderRadius: 8, padding: 18, alignItems: "center", gap: 10 },
  manageDialogTitle: { color: "#333333", fontSize: 12, fontWeight: "700" },
  manageDialogCopy: { color: "#777777", fontSize: 8, lineHeight: 14, textAlign: "center" },
  dismissButton: { minWidth: 88, height: 30, borderRadius: 16, backgroundColor: "#555555", alignItems: "center", justifyContent: "center" },
  dismissText: { color: "#FFFFFF", fontSize: 8, fontWeight: "600" }
});
