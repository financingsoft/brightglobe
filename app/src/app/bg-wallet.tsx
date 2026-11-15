import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import { ApiError } from "@/services/api";
import {
  formatAssetBaseUnits,
  getBgAssetAccount,
  getBgAssetActivity,
  type BgAssetAccount,
  type BgAssetActivityItem
} from "@/services/assets";
import { BgTransferPanel } from "@/wallet/BgTransferPanel";

function formatActivityTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function activityTitle(item: BgAssetActivityItem, locale: string): string {
  const zh = locale === "zh-CN";
  const outgoing = item.deltaBaseUnits.startsWith("-");
  if (item.type === "transfer") return zh ? (outgoing ? "链上转出" : "链上转入") : (outgoing ? "On-chain send" : "On-chain receive");
  if (item.type === "mint_to") return zh ? "链上代币发放" : "On-chain token mint";
  if (item.type === "burn") return zh ? "链上代币销毁" : "On-chain token burn";
  if (item.type === "opening_balance") return zh ? "链上初始余额" : "On-chain opening balance";
  return zh ? "BG 账户变动" : "BG account activity";
}

function activityStatus(status: string, locale: string): string {
  const zh = locale === "zh-CN";
  const labels: Record<string, [string, string]> = {
    settled: ["已结算", "Settled"],
    created: ["待签名", "Awaiting signature"],
    signed: ["已签名", "Signed"],
    submitted: ["等待链上确认", "Submitted"],
    confirmed: ["链上确认中", "Confirmed"],
    finalized: ["链上已最终确认", "Finalized"],
    settling: ["等待账本结算", "Ledger settling"],
    failed: ["失败", "Failed"],
    expired: ["已过期", "Expired"]
  };
  const pair = labels[status] ?? [status, status];
  return zh ? pair[0] : pair[1];
}

export default function BgWalletScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const { isAuthenticated, isPreviewAccount, authMethod } = useAuth();
  const [account, setAccount] = useState<BgAssetAccount | null>(null);
  const [activity, setActivity] = useState<BgAssetActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const reloadAccount = async () => {
    const [result, history] = await Promise.all([getBgAssetAccount(), getBgAssetActivity()]);
    setAccount(result);
    setActivity(history);
    setError(null);
  };

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || isPreviewAccount) {
      setAccount(null);
      setActivity([]);
      setLoading(false);
      setActivityLoading(false);
      setError(null);
      return () => { active = false; };
    }
    setLoading(true);
    setActivityLoading(true);
    setError(null);
    Promise.all([getBgAssetAccount(), getBgAssetActivity()])
      .then(([result, history]) => {
        if (!active) return;
        setAccount(result);
        setActivity(history);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof ApiError
          ? reason.message
          : t("暂时无法读取 BG 账户。", "Unable to load the BG account."));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setActivityLoading(false);
        }
      });
    return () => { active = false; };
  }, [isAuthenticated, isPreviewAccount, authMethod, locale]);

  const isDraft = account?.status !== "active" || account?.decimals === null;
  const reservedBaseUnits = account?.reservedBaseUnits ?? "0";
  const hasReservedBalance = /^\d+$/.test(reservedBaseUnits) && BigInt(reservedBaseUnits) > 0n;

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerAction}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("BG 资产账户", "BG asset account")}</Text>
        <View style={styles.headerAction} />
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.eyebrow}>BRIGHTGLOBE · BG</Text>
        <Text style={styles.balanceLabel}>{t("可用 BG 余额", "Spendable BG balance")}</Text>
        {loading ? (
          <ActivityIndicator color="#EAF2FF" />
        ) : (
          <Text style={styles.balanceValue}>
            {account ? formatAssetBaseUnits(account.spendableBaseUnits ?? account.balanceBaseUnits, account.decimals) : "—"}
          </Text>
        )}
        <Text style={styles.assetCode}>BG</Text>
        <View style={styles.networkPill}>
          <Text style={styles.networkText}>Solana Devnet</Text>
        </View>
      </View>

      {!isAuthenticated || isPreviewAccount ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t("登录后查看 BG 账户", "Sign in to view your BG account")}</Text>
          <Text style={styles.noticeCopy}>{t("请先登录 BrightGlobe 账户。", "Sign in to your BrightGlobe account first.")}</Text>
          <Pressable onPress={() => router.push("/login")} style={styles.action}>
            <Text style={styles.actionText}>{t("登录", "Sign in")}</Text>
          </Pressable>
        </View>
      ) : error ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t("账户暂不可用", "Account unavailable")}</Text>
          <Text style={styles.noticeCopy}>{error}</Text>
        </View>
      ) : isDraft ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t("BG 资产尚未启用", "BG asset is not active yet")}</Text>
          <Text style={styles.noticeCopy}>
            {t(
              "当前只接入 Devnet 资产登记和账户查询。BG Mint 地址及精度尚未配置，因此这里不会显示可用代币余额，也不会提供消费、提现或转账入口。",
              "The Devnet asset registry and account lookup are connected. The BG mint address and decimals are not configured, so no spend, withdrawal, or transfer actions are available."
            )}
          </Text>
        </View>
      ) : (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t("Devnet 资产账户", "Devnet asset account")}</Text>
          <Text style={styles.noticeCopy}>
            {t("此页面显示服务端 BG 资产账户余额。链上余额和内部账本余额不会被混为一谈。", "This page displays the server-side BG asset account. Internal ledger balances are not represented as on-chain wallet balances.")}
          </Text>
        </View>
      )}

      {!isDraft && !error && account?.decimals !== null ? (
        <BgTransferPanel decimals={account!.decimals!} onAccountRefresh={reloadAccount} />
      ) : null}

      <View style={styles.activitySection}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>{t("BG 交易记录", "BG transaction activity")}</Text>
          <Text style={styles.activityCount}>{activity.length}</Text>
        </View>
        {activityLoading ? (
          <ActivityIndicator color="#C9D9F2" />
        ) : activity.length > 0 ? (
          activity.map((item) => {
            const outgoing = item.deltaBaseUnits.startsWith("-");
            const absoluteAmount = outgoing ? item.deltaBaseUnits.slice(1) : item.deltaBaseUnits;
            return (
              <View key={item.id} style={styles.activityRow}>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityName}>{activityTitle(item, locale)}</Text>
                  <Text style={styles.activityMeta}>
                    {formatActivityTime(item.createdAt, locale)} · {activityStatus(item.status, locale)}
                  </Text>
                  {item.chainSignature ? (
                    <Text style={styles.activitySignature}>{item.chainSignature.slice(0, 8)}…{item.chainSignature.slice(-8)}</Text>
                  ) : null}
                </View>
                <Text style={[styles.activityAmount, outgoing ? styles.activityOutgoing : styles.activityIncoming]}>
                  {outgoing ? "−" : "+"}{formatAssetBaseUnits(absoluteAmount, account?.decimals ?? null)} BG
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.activityEmpty}>{t("暂无 BG 交易记录。", "No BG activity yet.")}</Text>
        )}
      </View>

      {hasReservedBalance ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t("待处理转账预留", "Reserved for pending transfers")}</Text>
          <Text style={styles.infoValue}>{formatAssetBaseUnits(reservedBaseUnits, account?.decimals ?? null)} BG</Text>
        </View>
      ) : null}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{t("资产状态", "Asset status")}</Text>
        <Text style={styles.infoValue}>{account?.status ?? "—"}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{t("代币精度", "Token decimals")}</Text>
        <Text style={styles.infoValue}>{account?.decimals ?? "—"}</Text>
      </View>
      <Text style={styles.disclaimer}>
        {t("BG 主网代币尚未发行。此页面不代表主网资产或可交易余额。", "The BG Mainnet token has not been issued. This page does not represent Mainnet assets or a tradable balance.")}
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.2)" },
  headerAction: { width: 30, minHeight: 30, justifyContent: "center" },
  backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "700" },
  balanceCard: { marginTop: 16, padding: 20, borderRadius: 12, backgroundColor: "#111F37", alignItems: "center", gap: 7 },
  eyebrow: { color: "#9AAECD", fontSize: 8, letterSpacing: 1.5, fontWeight: "700" },
  balanceLabel: { color: "#A0B2D0", fontSize: 9, marginTop: 7 },
  balanceValue: { color: "#F2F5FF", fontSize: 32, fontWeight: "800" },
  assetCode: { color: "#C9D9F2", fontSize: 10, fontWeight: "700" },
  networkPill: { marginTop: 5, borderRadius: 12, backgroundColor: "rgba(112,82,173,0.25)", paddingHorizontal: 10, paddingVertical: 5 },
  networkText: { color: "#D4C6F0", fontSize: 8 },
  notice: { marginTop: 15, padding: 14, borderRadius: 8, backgroundColor: "rgba(17,31,55,0.75)", gap: 7 },
  noticeTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  noticeCopy: { color: "#A0B2D0", fontSize: 8, lineHeight: 14 },
  action: { minHeight: 32, borderRadius: 17, backgroundColor: "#7052AD", alignItems: "center", justifyContent: "center", marginTop: 5 },
  actionText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  infoRow: { minHeight: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.13)" },
  infoLabel: { color: "#91A5C5", fontSize: 8 },
  infoValue: { color: "#C9D9F2", fontSize: 8 },
  activitySection: { marginTop: 18, gap: 8 },
  activityHeader: { minHeight: 30, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.18)" },
  activityTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  activityCount: { color: "#91A5C5", fontSize: 8 },
  activityRow: { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.1)" },
  activityCopy: { flex: 1, gap: 3 },
  activityName: { color: "#DCE7F8", fontSize: 8, fontWeight: "600" },
  activityMeta: { color: "#8A9DBD", fontSize: 7 },
  activitySignature: { color: "#788CAB", fontSize: 6 },
  activityAmount: { fontSize: 9, fontWeight: "700" },
  activityOutgoing: { color: "#F0B6A7" },
  activityIncoming: { color: "#A8D9BC" },
  activityEmpty: { color: "#8A9DBD", fontSize: 8, paddingVertical: 12 },
  disclaimer: { color: "#788CAB", fontSize: 7, lineHeight: 12, textAlign: "center", marginTop: 14 }
});
