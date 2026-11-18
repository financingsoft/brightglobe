import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import { ApiError } from "@/services/api";
import {
  formatAssetBaseUnits,
  getBgAssetAccount,
  getBgRewardActivity,
  getBgRewardDashboard,
  type BgAssetAccount,
  type BgRewardActivityItem,
  type BgRewardDashboard
} from "@/services/assets";

function statusLabel(value: string | null, locale: string): string {
  if (!value) return locale === "zh-CN" ? "尚无记录" : "Not available";
  const labels: Record<string, [string, string]> = {
    not_recorded_today: ["今日尚无记录", "No record today"],
    reserved: ["奖励已预留", "Reward reserved"],
    submitted: ["已提交链上", "Submitted on-chain"],
    confirmed: ["链上已确认", "Confirmed on-chain"],
    finalized: ["链上最终确认", "Finalized on-chain"],
    paid: ["已完成发放", "Paid"],
    queued: ["等待处理", "Queued"],
    signing: ["签名处理中", "Signing"],
    signed: ["已签名", "Signed"],
    failed: ["发放失败", "Payout failed"],
    rejected: ["审核未通过", "Rejected"],
    quarantined: ["隔离核查中", "Under review"],
    cancelled: ["已取消", "Cancelled"],
    expired: ["已过期", "Expired"]
  };
  const pair = labels[value] ?? [value, value];
  return locale === "zh-CN" ? pair[0] : pair[1];
}

function amountLabel(value: string | null, account: BgAssetAccount | null): string {
  if (value === null) return "—";
  if (account?.decimals !== null && account?.decimals !== undefined) {
    return formatAssetBaseUnits(value, account.decimals) + " BG";
  }
  return value + " base units";
}

function activityName(item: BgRewardActivityItem, locale: string): string {
  const zh = locale === "zh-CN";
  if (item.actionType === "daily_collection") return zh ? "每日收集奖励" : "Daily collection reward";
  if (item.actionType === "task_completion") return zh ? "任务完成奖励" : "Task completion reward";
  if (item.actionType === "invitation") return zh ? "邀请奖励" : "Invitation reward";
  if (item.actionType === "campaign") return zh ? "活动奖励" : "Campaign reward";
  return item.actionType;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export default function BgRewardsScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const { isAuthenticated, isPreviewAccount } = useAuth();
  const [dashboard, setDashboard] = useState<BgRewardDashboard | null>(null);
  const [activity, setActivity] = useState<BgRewardActivityItem[]>([]);
  const [asset, setAsset] = useState<BgAssetAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const load = useCallback(async () => {
    const [summary, rows, assetResult] = await Promise.all([
      getBgRewardDashboard(),
      getBgRewardActivity(30),
      getBgAssetAccount().catch(() => null)
    ]);
    setDashboard(summary);
    setActivity(rows);
    setAsset(assetResult);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || isPreviewAccount) {
      setDashboard(null);
      setActivity([]);
      setAsset(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    Promise.all([
      getBgRewardDashboard(),
      getBgRewardActivity(30),
      getBgAssetAccount().catch(() => null)
    ]).then(([summary, rows, assetResult]) => {
      if (!active) return;
      setDashboard(summary);
      setActivity(rows);
      setAsset(assetResult);
      setError(null);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof ApiError ? reason.message : t("暂时无法读取 BG 奖励记录。", "Unable to load BG reward history."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAuthenticated, isPreviewAccount, locale]);

  const refresh = async () => {
    setRefreshing(true);
    try { await load(); }
    catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t("刷新失败，请稍后重试。", "Refresh failed. Try again later."));
    } finally { setRefreshing(false); }
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>{t("BG 奖励记录", "BG rewards")}</Text>
        <Pressable accessibilityRole="button" disabled={refreshing || loading} onPress={refresh}>
          {refreshing || loading ? <ActivityIndicator size="small" color="#C9D9F2" /> : <Text style={styles.refresh}>↻</Text>}
        </Pressable>
      </View>

      {!isAuthenticated || isPreviewAccount ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{t("登录后查看 BG 奖励", "Sign in to view BG rewards")}</Text>
          <Text style={styles.copy}>{t("预览账户不会显示或生成真实奖励数据。", "Preview accounts do not display or generate live reward data.")}</Text>
          <Pressable style={styles.action} onPress={() => router.push("/login")}><Text style={styles.actionText}>{t("登录", "Sign in")}</Text></Pressable>
        </View>
      ) : loading ? (
        <View style={styles.loading}><ActivityIndicator color="#C9D9F2" /><Text style={styles.copy}>{t("正在读取奖励记录…", "Loading reward history…")}</Text></View>
      ) : error ? (
        <View style={styles.panel}><Text style={styles.panelTitle}>{t("奖励记录暂不可用", "Rewards unavailable")}</Text><Text style={styles.copy}>{error}</Text></View>
      ) : dashboard ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>BRIGHTGLOBE · BG · DEVNET</Text>
            <Text style={styles.heroLabel}>{t("今日收集状态", "Today's collection")}</Text>
            <Text style={styles.heroStatus}>{statusLabel(dashboard.dailyCollection.status, locale)}</Text>
            <Text style={styles.heroAmount}>{amountLabel(dashboard.dailyCollection.amountBaseUnits, asset)}</Text>
            <Text style={styles.copy}>{t("奖励状态与链上发放状态分开记录。", "Reward entitlement and on-chain payout are tracked separately.")}</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statLabel}>{t("奖励笔数", "Rewards")}</Text><Text style={styles.statValue}>{dashboard.totals.rewardCount}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>{t("预留总额", "Reserved")}</Text><Text style={styles.statValue}>{amountLabel(dashboard.totals.reservedBaseUnits, asset)}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>{t("已发放总额", "Paid")}</Text><Text style={styles.statValue}>{amountLabel(dashboard.totals.paidBaseUnits, asset)}</Text></View>
          </View>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{t("状态说明", "Status notes")}</Text>
            <Text style={styles.copy}>{t("领取资格尚未由此页面评估；没有今日记录不代表一定可以领取。链上钱包余额不包含在这些统计中。", "Claim eligibility is not assessed here; no daily record does not guarantee eligibility. On-chain wallet balances are excluded.")}</Text>
          </View>
          <View style={styles.listHeader}><Text style={styles.sectionTitle}>{t("奖励活动", "Reward activity")}</Text><Text style={styles.count}>{activity.length}</Text></View>
          {activity.length ? activity.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{activityName(item, locale)}</Text>
                <Text style={styles.meta}>{formatDate(item.createdAt, locale)} · {statusLabel(item.rewardStatus, locale)}</Text>
                <Text style={styles.meta}>{t("发放状态", "Payout")}: {statusLabel(item.payoutStatus, locale)}</Text>
                {item.chainSignature ? <Text style={styles.signature}>{item.chainSignature.slice(0, 8)}…{item.chainSignature.slice(-8)}</Text> : null}
                {item.failureCode ? <Text style={styles.failure}>{t("失败代码", "Failure code")}: {item.failureCode}</Text> : null}
              </View>
              <Text style={styles.amount}>{amountLabel(item.amountBaseUnits, asset)}</Text>
            </View>
          )) : <Text style={styles.empty}>{t("暂无 BG 奖励记录。", "No BG reward activity yet.")}</Text>}
        </>
      ) : null}
      <Text style={styles.disclaimer}>{t("仅显示 BrightGlobe 内部奖励记录与 Devnet 发放进度，不代表 Mainnet 资产或可交易余额。", "Shows internal BrightGlobe reward records and Devnet payout progress only. It does not represent Mainnet assets or tradable balances.")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.2)" },
  back: { color: "#EAF2FF", fontSize: 27, lineHeight: 30, width: 28 },
  title: { color: "#EAF2FF", fontSize: 13, fontWeight: "700" },
  refresh: { color: "#C9D9F2", fontSize: 18, width: 28, textAlign: "right" },
  hero: { marginTop: 16, padding: 18, borderRadius: 10, backgroundColor: "#111F37", gap: 7 },
  eyebrow: { color: "#9AAECD", fontSize: 8, letterSpacing: 1.3, fontWeight: "700" },
  heroLabel: { color: "#A0B2D0", fontSize: 9, marginTop: 8 },
  heroStatus: { color: "#EAF2FF", fontSize: 17, fontWeight: "800" },
  heroAmount: { color: "#D7C7F1", fontSize: 19, fontWeight: "700" },
  copy: { color: "#A0B2D0", fontSize: 8, lineHeight: 14 },
  stats: { flexDirection: "row", gap: 7, marginTop: 10 },
  stat: { flex: 1, minHeight: 66, backgroundColor: "rgba(17,31,55,0.72)", borderRadius: 7, padding: 9, justifyContent: "space-between" },
  statLabel: { color: "#91A5C5", fontSize: 7 },
  statValue: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  notice: { marginTop: 12, padding: 12, borderRadius: 7, backgroundColor: "rgba(112,82,173,0.13)", gap: 5 },
  noticeTitle: { color: "#D8C8F0", fontSize: 9, fontWeight: "700" },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, paddingBottom: 8, borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.18)" },
  sectionTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  count: { color: "#91A5C5", fontSize: 8 },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.1)" },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: "#E1EBFC", fontSize: 9, fontWeight: "700" },
  meta: { color: "#8A9DBD", fontSize: 7 },
  signature: { color: "#788CAB", fontSize: 6 },
  failure: { color: "#E7A59B", fontSize: 7 },
  amount: { color: "#C9D9F2", fontSize: 8, fontWeight: "700" },
  empty: { color: "#8A9DBD", fontSize: 8, paddingVertical: 14 },
  panel: { marginTop: 18, padding: 14, borderRadius: 8, backgroundColor: "#111F37", gap: 8 },
  panelTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  action: { minHeight: 34, borderRadius: 18, backgroundColor: "#7052AD", alignItems: "center", justifyContent: "center", marginTop: 5 },
  actionText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  loading: { paddingVertical: 28, alignItems: "center", gap: 9 },
  disclaimer: { color: "#788CAB", fontSize: 7, lineHeight: 12, textAlign: "center", marginTop: 16 }
});
