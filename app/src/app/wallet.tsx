import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import {
  formatBdBaseUnits,
  getBdAccount,
  getBdHistory,
  type BdAccountSnapshot,
  type BdHistoryItem
} from "@/services/bd";

function historyTitle(type: string, locale: string): string {
  if (type === "daily_collection") return locale === "zh-CN" ? "点击地球 · 每日收集" : "Earth tap · Daily collection";
  return locale === "zh-CN" ? "黑钻账户变动" : "BD account activity";
}

function formatTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function WalletScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated, isPreviewAccount } = useAuth();
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [account, setAccount] = useState<BdAccountSnapshot | null>(null);
  const [items, setItems] = useState<BdHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || isPreviewAccount) {
      setAccount(null);
      setItems([]);
      setLoading(false);
      setError(t("登录真实账户后查看黑钻账户。", "Sign in to view your BD account."));
      return () => { active = false; };
    }

    setLoading(true);
    setError(null);
    Promise.all([getBdAccount(), getBdHistory()])
      .then(([snapshot, history]) => {
        if (!active) return;
        setAccount(snapshot);
        setItems(history);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : t("暂时无法读取账户。", "Unable to load the account."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [isAuthenticated, isPreviewAccount, locale]);

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerAction}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("黑钻账户", "BD account")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} style={styles.headerAction}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t("可用黑钻", "Available BD")}</Text>
        <Text style={styles.balanceValue}>
          {account ? formatBdBaseUnits(account.account.availableBaseUnits) : "—"}
        </Text>
        <View style={styles.balanceFooter}>
          <Text style={styles.balanceFootnote}>
            {t("累计获得 ", "Lifetime earned ")}
            {account ? formatBdBaseUnits(account.account.lifetimeEarnedBaseUnits) : "—"} BD
          </Text>
          <Text style={styles.accountBadge}>{t("平台内部账户", "Internal account")}</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => setShowAccountInfo(true)} style={styles.manageRow}>
        <View style={styles.manageIcon}><Text style={styles.manageGlyph}>◇</Text></View>
        <View style={styles.manageCopy}>
          <Text style={styles.manageTitle}>{t("账户规则", "Account rules")}</Text>
          <Text style={styles.manageHint}>{t("了解黑钻记录、领取和使用边界", "Understand BD records and collection rules")}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.shortcutRow}>
        <Pressable onPress={() => setShowAccountInfo(true)} style={styles.shortcut}>
          <Text style={styles.shortcutGlyph}>◇</Text>
          <Text style={styles.shortcutTitle}>{t("账户说明", "Account details")}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/points-record")} style={styles.shortcut}>
          <Text style={styles.shortcutGlyph}>▤</Text>
          <Text style={styles.shortcutTitle}>{t("黑钻记录", "BD history")}</Text>
        </Pressable>
      </View>

      <View style={styles.recordsHeader}>
        <Text style={styles.sectionTitle}>{t("最近入账", "Recent credits")}</Text>
        <Pressable onPress={() => router.push("/points-record")}><Text style={styles.viewAll}>{t("全部", "All")} ›</Text></Pressable>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>{t("正在读取记录…", "Loading history…")}</Text>
      ) : items.length > 0 ? (
        <View style={styles.recordList}>
          {items.slice(0, 5).map((record, index) => (
            <View key={record.id} style={[styles.recordRow, index !== Math.min(items.length, 5) - 1 && styles.recordDivider]}>
              <View style={styles.recordCopy}>
                <Text style={styles.recordTitle}>{historyTitle(record.type, locale)}</Text>
                <Text style={styles.recordTime}>{formatTime(record.createdAt, locale)}</Text>
              </View>
              <Text style={styles.recordValue}>
                {record.deltaBaseUnits.startsWith("-") ? "" : "+"}{formatBdBaseUnits(record.deltaBaseUnits)} BD
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{t("暂无入账记录。可在首页点击地球参与每日收集。", "No credits yet. Tap the Earth on Home when daily collection is available.")}</Text>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {(!isAuthenticated || isPreviewAccount) ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/login")} style={styles.signInButton}>
          <Text style={styles.signInText}>{t("登录账户", "Sign in")}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.previewNote}>
        {t("1.0 版本不提供链上钱包、用户间转账、代币兑换或现金提现。此处显示的是服务端内部账本余额。", "V1.0 does not provide an on-chain wallet, peer transfers, token exchange or cash withdrawal. This is the server-side internal ledger balance.")}
      </Text>

      <Modal visible={showAccountInfo} transparent animationType="fade" onRequestClose={() => setShowAccountInfo(false)}>
        <View style={styles.scrim}>
          <View style={styles.manageDialog}>
            <Text style={styles.manageDialogTitle}>{t("BrightGlobe 黑钻账户", "BrightGlobe BD account")}</Text>
            <Text style={styles.manageDialogCopy}>
              {t(
                "黑钻是 BrightGlobe 1.0 的内部奖励记账单位。所有余额和记录由服务端账本管理；当前版本不开放购买、转账、兑换、提现或链上钱包功能。",
                "BD is BrightGlobe V1.0's internal reward-accounting unit. Balances and history are managed by the server ledger. Purchase, transfer, exchange, cash-out and blockchain wallet features are not available in this release."
              )}
            </Text>
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
  balanceValue: { color: "#333333", fontSize: 28, fontWeight: "800" },
  balanceFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  balanceFootnote: { color: "#888888", fontSize: 8 },
  accountBadge: { color: "#6B7582", fontSize: 7, borderWidth: 1, borderColor: "#DDE1E6", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
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
  recordRow: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recordDivider: { borderBottomWidth: 1, borderColor: "#EAEAEA" },
  recordCopy: { flex: 1, gap: 4 },
  recordTitle: { color: "#444444", fontSize: 9, fontWeight: "600" },
  recordTime: { color: "#999999", fontSize: 7 },
  recordValue: { color: "#777777", fontSize: 9, fontWeight: "700" },
  emptyText: { color: "#999999", fontSize: 8, lineHeight: 14, paddingVertical: 14 },
  errorText: { color: "#A45B5B", fontSize: 8, lineHeight: 13, marginTop: 7 },
  signInButton: { height: 36, borderRadius: 18, backgroundColor: "#394554", alignItems: "center", justifyContent: "center", marginTop: 16 },
  signInText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  previewNote: { color: "#9299A4", fontSize: 7, lineHeight: 12, marginTop: 12 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 28 },
  manageDialog: { backgroundColor: "#FFFFFF", width: "100%", maxWidth: 310, borderRadius: 8, padding: 18, alignItems: "center", gap: 10 },
  manageDialogTitle: { color: "#333333", fontSize: 12, fontWeight: "700" },
  manageDialogCopy: { color: "#777777", fontSize: 8, lineHeight: 14, textAlign: "center" },
  dismissButton: { minWidth: 88, height: 30, borderRadius: 16, backgroundColor: "#555555", alignItems: "center", justifyContent: "center" },
  dismissText: { color: "#FFFFFF", fontSize: 8, fontWeight: "600" }
});
