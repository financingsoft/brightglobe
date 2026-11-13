import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

export default function PointsRecordScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated, isPreviewAccount } = useAuth();
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
      setError(t("登录真实账户后查看黑钻记录。", "Sign in to view your BD account history."));
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
        if (active) setError(reason instanceof Error ? reason.message : t("暂时无法读取账户记录。", "Unable to load account history."));
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
        <Text style={styles.headerTitle}>{t("黑钻记录", "BD history")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} style={styles.headerAction}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.totalBlock}>
        <Text style={styles.totalLabel}>{t("可用黑钻", "Available BD")}</Text>
        <Text style={styles.totalValue}>
          {account ? formatBdBaseUnits(account.account.availableBaseUnits) : "—"}
        </Text>
        <View style={styles.frozenRow}>
          <Text style={styles.frozenLabel}>{t("待确认", "Pending")}</Text>
          <Text style={styles.frozenValue}>
            {account ? formatBdBaseUnits(account.account.pendingBaseUnits) : "—"} BD
          </Text>
        </View>
        <Text style={styles.totalHint}>{t("BrightGlobe 平台内部账户 · 非链上余额", "BrightGlobe internal account · Not an on-chain balance")}</Text>
      </View>

      <View style={styles.introSection}>
        <Text style={styles.sectionTitle}>{t("关于黑钻", "About BD")}</Text>
        <Text style={styles.introText}>
          {t(
            "1.0 版本的黑钻是 BrightGlobe 平台内部奖励记账单位。余额以服务端账本为准，不提供购买、转账、兑换或提现。",
            "In V1.0, BD is an internal BrightGlobe reward-accounting unit. The server ledger is authoritative. Purchase, transfer, exchange and cash-out are not available."
          )}
        </Text>
      </View>

      <View style={styles.recordsHeader}>
        <Text style={styles.sectionTitle}>{t("收集记录", "Collection history")}</Text>
        <Text style={styles.recordCount}>{items.length}</Text>
      </View>
      {loading ? (
        <Text style={styles.emptyText}>{t("正在读取记录…", "Loading history…")}</Text>
      ) : items.length > 0 ? (
        <View style={styles.recordList}>
          {items.map((item, index) => (
            <View key={item.id} style={[styles.recordRow, index !== items.length - 1 && styles.recordDivider]}>
              <View style={styles.recordCopy}>
                <Text style={styles.recordTitle}>{historyTitle(item.type, locale)}</Text>
                <Text style={styles.recordTime}>{formatTime(item.createdAt, locale)}</Text>
              </View>
              <Text style={[styles.recordValue, item.deltaBaseUnits.startsWith("-") && styles.recordValueUsed]}>
                {item.deltaBaseUnits.startsWith("-") ? "" : "+"}{formatBdBaseUnits(item.deltaBaseUnits)} BD
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{t("还没有黑钻入账记录。点击首页地球参与每日收集。", "No BD credits yet. Tap the Earth on Home when daily collection is available.")}</Text>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {(!isAuthenticated || isPreviewAccount) ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/login")} style={styles.signInButton}>
          <Text style={styles.signInText}>{t("登录账户", "Sign in")}</Text>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  headerAction: { width: 28, height: 30, justifyContent: "center" },
  backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 },
  closeGlyph: { color: "#555555", fontSize: 24, lineHeight: 27, textAlign: "right" },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "700" },
  totalBlock: { paddingVertical: 16, borderBottomWidth: 1, borderColor: "#DDDDDD", gap: 6 },
  totalLabel: { color: "#777777", fontSize: 9 },
  totalValue: { color: "#333333", fontSize: 28, fontWeight: "800" },
  frozenRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#EEEEEE", paddingTop: 8, marginTop: 3 },
  frozenLabel: { color: "#888888", fontSize: 8 },
  frozenValue: { color: "#777777", fontSize: 8 },
  totalHint: { color: "#999999", fontSize: 7 },
  introSection: { paddingVertical: 14, borderBottomWidth: 1, borderColor: "#E3E3E3", gap: 7 },
  sectionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" },
  introText: { color: "#777777", fontSize: 8, lineHeight: 14 },
  recordsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  recordCount: { color: "#999999", fontSize: 8 },
  recordList: { borderTopWidth: 1, borderColor: "#E5E5E5" },
  recordRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recordDivider: { borderBottomWidth: 1, borderColor: "#EAEAEA" },
  recordCopy: { gap: 4, flex: 1 },
  recordTitle: { color: "#444444", fontSize: 9, fontWeight: "600" },
  recordTime: { color: "#999999", fontSize: 7 },
  recordValue: { color: "#777777", fontSize: 9, fontWeight: "700" },
  recordValueUsed: { color: "#999999" },
  emptyText: { color: "#999999", fontSize: 8, lineHeight: 14, paddingVertical: 16 },
  errorText: { color: "#A45B5B", fontSize: 8, lineHeight: 13, marginTop: 7 },
  signInButton: { height: 36, borderRadius: 18, backgroundColor: "#394554", alignItems: "center", justifyContent: "center", marginTop: 16 },
  signInText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" }
});
