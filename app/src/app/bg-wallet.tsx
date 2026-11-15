import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import { ApiError } from "@/services/api";
import { formatAssetBaseUnits, getBgAssetAccount, type BgAssetAccount } from "@/services/assets";

export default function BgWalletScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const { isAuthenticated, isPreviewAccount, authMethod } = useAuth();
  const [account, setAccount] = useState<BgAssetAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || isPreviewAccount) {
      setAccount(null);
      setLoading(false);
      setError(null);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    getBgAssetAccount()
      .then((result) => { if (active) setAccount(result); })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof ApiError
          ? reason.message
          : t("暂时无法读取 BG 账户。", "Unable to load the BG account."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAuthenticated, isPreviewAccount, authMethod, locale]);

  const isDraft = account?.status !== "active" || account?.decimals === null;

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
        <Text style={styles.balanceLabel}>{t("账户余额", "Account balance")}</Text>
        {loading ? (
          <ActivityIndicator color="#EAF2FF" />
        ) : (
          <Text style={styles.balanceValue}>
            {account ? formatAssetBaseUnits(account.balanceBaseUnits, account.decimals) : "—"}
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
  disclaimer: { color: "#788CAB", fontSize: 7, lineHeight: 12, textAlign: "center", marginTop: 14 }
});
