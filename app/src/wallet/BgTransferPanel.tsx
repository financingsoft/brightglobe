import { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAccount, useAppKit, useProvider } from "@reown/appkit-react-native";
import { useAuth } from "@/auth/session";
import { useI18n } from "@/i18n/locale";
import {
  createBgTransferIntent,
  decimalStringToAssetBaseUnits,
  formatAssetBaseUnits,
  getBgAssetTransaction,
  getBgOnChainWalletBalance,
  reportBgTransferSubmitted
} from "@/services/assets";
import { SOLANA_DEVNET_CHAIN_ID, walletKitConfigured } from "./appkit";

type PendingTransfer = {
  intentId: string;
  signature: string;
};

type Props = {
  decimals: number;
  onAccountRefresh: () => Promise<void>;
};

export function BgTransferPanel(props: Props) {
  if (!walletKitConfigured) {
    return <UnavailablePanel />;
  }
  return <BgTransferPanelInner {...props} />;
}

function UnavailablePanel() {
  const { locale } = useI18n();
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{locale === "zh-CN" ? "链上转账" : "On-chain transfer"}</Text>
      <Text style={styles.copy}>
        {locale === "zh-CN"
          ? "钱包连接尚未配置。完成 Reown Project ID 配置后即可启用 Devnet 钱包连接。"
          : "Wallet connection is not configured. Set the Reown Project ID to enable Devnet wallet access."}
      </Text>
    </View>
  );
}

function BgTransferPanelInner({ decimals, onAccountRefresh }: Props) {
  const { locale } = useI18n();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const router = useRouter();
  const { isAuthenticated, isPreviewAccount, wallets } = useAuth();
  const { open } = useAppKit();
  const { address, chainId, namespace, isConnected } = useAccount();
  const { provider, providerType } = useProvider();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingTransfer | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);
  const [onChainBalanceLoading, setOnChainBalanceLoading] = useState(false);
  const [onChainBalanceError, setOnChainBalanceError] = useState("");

  const linkedWallet = Boolean(address && wallets.some(
    (wallet) => wallet.network === "devnet" && wallet.address === address
  ));
  const providerReady = Boolean(
    isConnected &&
    address &&
    namespace === "solana" &&
    providerType === "solana" &&
    provider &&
    String(chainId) === SOLANA_DEVNET_CHAIN_ID
  );

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || isPreviewAccount || !providerReady || !address || !linkedWallet) {
      setOnChainBalance(null);
      setOnChainBalanceLoading(false);
      setOnChainBalanceError("");
      return () => { active = false; };
    }
    setOnChainBalanceLoading(true);
    setOnChainBalanceError("");
    getBgOnChainWalletBalance(address)
      .then((snapshot) => {
        if (active) setOnChainBalance(snapshot.onChainBalanceBaseUnits);
      })
      .catch((reason: unknown) => {
        if (active) setOnChainBalanceError(
          reason instanceof Error ? reason.message : t("无法读取链上余额。", "Unable to load the on-chain balance.")
        );
      })
      .finally(() => {
        if (active) setOnChainBalanceLoading(false);
      });
    return () => { active = false; };
  }, [isAuthenticated, isPreviewAccount, providerReady, address, linkedWallet]);

  const copyWalletAddress = async () => {
    if (!address) return;
    try {
      await Clipboard.setStringAsync(address);
      setNotice(t("Devnet 收款地址已复制。", "Devnet receiving address copied."));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("复制钱包地址失败。", "Unable to copy the wallet address."));
    }
  };

  const connectWallet = async () => {
    setError("");
    try {
      await open({ view: "Connect" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("无法打开钱包连接窗口。", "Unable to open the wallet connection dialog."));
    }
  };

  const refreshTransaction = async (current: PendingTransfer) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await reportBgTransferSubmitted(current.intentId, current.signature);
      const snapshot = await getBgAssetTransaction(current.intentId);
      setNotice(
        snapshot.status === "finalized" && snapshot.ledgerSettled
          ? t("链上交易已最终确认，BrightGlobe 账本也已完成结算。", "The transaction is finalized and the BrightGlobe ledger has settled.")
          : snapshot.status === "finalized"
            ? t("链上交易已最终确认，正在等待内部账本完成结算。", "The chain transaction is finalized. Waiting for internal ledger settlement.")
            : snapshot.status === "failed"
              ? t("链上交易失败。", "The on-chain transaction failed.")
              : snapshot.status === "expired"
                ? t("交易已过期，请重新发起。", "The transaction expired. Start a new transfer.")
                : t("交易已提交，等待 Solana finalized 最终确认。", "Transaction submitted. Waiting for Solana finalized confirmation.")
      );
      if (snapshot.status === "finalized" && snapshot.ledgerSettled) {
        await onAccountRefresh();
        setPending(null);
      } else if (snapshot.status === "failed" || snapshot.status === "expired") {
        setPending(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("同步交易状态失败。", "Unable to synchronize the transaction status."));
    } finally {
      setBusy(false);
    }
  };

  const sendTransfer = async () => {
    setError("");
    setNotice("");
    if (!isAuthenticated || isPreviewAccount) {
      setError(t("请先登录 BrightGlobe 账户。", "Sign in to your BrightGlobe account first."));
      return;
    }
    if (!providerReady || !address || !provider) {
      await connectWallet();
      return;
    }
    if (!linkedWallet) {
      setError(t("当前连接的钱包尚未绑定到此 BrightGlobe 账户，请先到账户设置完成绑定。", "This connected wallet is not linked to your BrightGlobe account. Link it in Account Settings first."));
      return;
    }
    if (pending) {
      setError(t("有一笔交易正在等待最终确认，请先同步该笔交易。", "A transfer is already awaiting finality. Synchronize that transaction first."));
      return;
    }
    if (!recipient.trim()) {
      setError(t("请输入收款钱包地址。", "Enter a destination wallet address."));
      return;
    }

    setBusy(true);
    try {
      const amountBaseUnits = decimalStringToAssetBaseUnits(amount, decimals);
      const intent = await createBgTransferIntent({
        fromAddress: address,
        toAddress: recipient.trim(),
        amountBaseUnits,
        idempotencyKey: "bg-transfer-" + (() => {
          const bytes = new Uint8Array(16);
          crypto.getRandomValues(bytes);
          return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        })()
      });
      // Reflect the new short-lived reservation before handing the transaction
      // to the external wallet for signing.
      await onAccountRefresh().catch(() => undefined);

      const walletProvider = provider as {
        request: (
          args: { method: "solana_signAndSendTransaction"; params: { transaction: string } },
          chain: string
        ) => Promise<unknown>;
      };
      const result = await walletProvider.request(
        {
          method: "solana_signAndSendTransaction",
          params: { transaction: intent.transactionBase64 }
        },
        "solana:" + SOLANA_DEVNET_CHAIN_ID
      );

      const signature = typeof result === "string"
        ? result
        : typeof result === "object" && result !== null && "signature" in result &&
          typeof (result as { signature?: unknown }).signature === "string"
          ? (result as { signature: string }).signature
          : null;
      if (!signature) {
        throw new Error("The connected wallet did not return a transaction signature.");
      }

      const current = { intentId: intent.intentId, signature };
      setPending(current);
      setNotice(t("钱包已广播交易，正在登记并等待最终确认。", "The wallet broadcast the transaction. Registering it and waiting for finality."));
      await reportBgTransferSubmitted(intent.intentId, signature);
      const snapshot = await getBgAssetTransaction(intent.intentId);
      if (snapshot.status === "finalized" && snapshot.ledgerSettled) {
        await onAccountRefresh();
        setPending(null);
        setNotice(t("交易已最终确认，账本结算和余额同步均已完成。", "Transaction finalized, ledger settlement completed and balance synchronized."));
      } else if (snapshot.status === "finalized") {
        setNotice(t("链上交易已最终确认，账本仍在结算中。请稍后同步状态，不要重复发送。", "The chain transaction is finalized but ledger settlement is pending. Synchronize later; do not send it again."));
      } else {
        setNotice(t("交易已提交，尚未最终确认。不要重复发送。", "Transaction submitted but not finalized. Do not send it again."));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("转账未完成，请检查钱包和网络。", "The transfer did not complete. Check your wallet and network."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{t("BG 链上转账", "BG on-chain transfer")}</Text>
      {!isAuthenticated || isPreviewAccount ? (
        <Text style={styles.copy}>{t("请登录真实 BrightGlobe 账户后使用。", "Sign in to a live BrightGlobe account to use transfers.")}</Text>
      ) : !isConnected ? (
        <Pressable accessibilityRole="button" onPress={connectWallet} style={styles.action}>
          <Text style={styles.actionText}>{t("连接 Phantom / Solflare", "Connect Phantom / Solflare")}</Text>
        </Pressable>
      ) : !providerReady ? (
        <Text style={styles.copy}>{t("请连接 Solana 钱包并切换到 Devnet。", "Connect a Solana wallet and switch it to Devnet.")}</Text>
      ) : !linkedWallet ? (
        <>
          <Text style={styles.copy}>{t("当前钱包尚未绑定到这个 BrightGlobe 账户。", "The connected wallet is not linked to this BrightGlobe account.")}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/settings")} style={styles.action}>
            <Text style={styles.actionText}>{t("前往账户设置绑定钱包", "Link wallet in Account Settings")}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.connectedAddress}>{t("已验证钱包", "Verified wallet")} · {address!.slice(0, 6)}…{address!.slice(-6)}</Text>
          <View style={styles.chainBalanceRow}>
            <Text style={styles.chainBalanceLabel}>{t("钱包链上 BG 余额", "On-chain BG balance")}</Text>
            {onChainBalanceLoading ? (
              <ActivityIndicator size="small" color="#C9D9F2" />
            ) : (
              <Text style={styles.chainBalanceValue}>
                {onChainBalance === null ? "—" : formatAssetBaseUnits(onChainBalance, decimals)}
              </Text>
            )}
          </View>
          {onChainBalanceError ? <Text style={styles.copy}>{onChainBalanceError}</Text> : null}
          <View style={styles.receiveCard}>
            <Text style={styles.receiveTitle}>{t("Devnet 收款二维码", "Devnet receive QR")}</Text>
            <View style={styles.qrSurface}>
              <QRCode value={address!} size={148} color="#101828" backgroundColor="#FFFFFF" quietZone={8} />
            </View>
            <Text selectable style={styles.receiveAddress}>{address}</Text>
            <Pressable accessibilityRole="button" onPress={copyWalletAddress} style={styles.copyAddressButton}>
              <Text style={styles.copyAddressText}>{t("复制收款地址", "Copy receive address")}</Text>
            </Pressable>
          </View>
          <TextInput
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("收款方 Solana 地址", "Recipient Solana address")}
            placeholderTextColor="#8293B0"
            editable={!busy && !pending}
            style={styles.input}
          />
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t("转账数量", "Amount")}
            placeholderTextColor="#8293B0"
            editable={!busy && !pending}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" disabled={busy || Boolean(pending)} onPress={sendTransfer} style={[styles.action, (busy || pending) && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionText}>{t("在 Solana Devnet 发起转账", "Send on Solana Devnet")}</Text>}
          </Pressable>
          {pending ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => refreshTransaction(pending)} style={[styles.secondaryAction, busy && styles.disabled]}>
              <Text style={styles.secondaryActionText}>{t("同步交易状态", "Sync transaction status")}</Text>
            </Pressable>
          ) : null}
        </>
      )}
      <Text style={styles.copy}>
        {t(
          "仅支持 Devnet。交易由你连接的钱包签名和广播；BrightGlobe 不持有私钥。余额只在链上 finalized 并通过服务端核验后结算。",
          "Devnet only. Your connected wallet signs and broadcasts; BrightGlobe never holds private keys. The account is settled only after finalized chain verification."
        )}
      </Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 15, padding: 14, borderRadius: 8, backgroundColor: "rgba(17,31,55,0.75)", gap: 8 },
  sectionTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  copy: { color: "#A0B2D0", fontSize: 8, lineHeight: 14 },
  connectedAddress: { color: "#A0B2D0", fontSize: 8 },
  chainBalanceRow: { minHeight: 30, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderBottomWidth: 1, borderColor: "rgba(156,183,224,0.16)" },
  chainBalanceLabel: { color: "#91A5C5", fontSize: 8 },
  chainBalanceValue: { color: "#EAF2FF", fontSize: 10, fontWeight: "700" },
  receiveCard: { alignItems: "center" as const, gap: 7, padding: 10, borderRadius: 8, backgroundColor: "rgba(5,13,32,0.55)" },
  receiveTitle: { color: "#D4C6F0", fontSize: 8, fontWeight: "700" },
  qrSurface: { padding: 5, backgroundColor: "#FFFFFF", borderRadius: 4 },
  receiveAddress: { color: "#A0B2D0", fontSize: 7, textAlign: "center" as const, lineHeight: 12 },
  copyAddressButton: { minHeight: 30, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: "rgba(174,194,230,0.35)", justifyContent: "center" as const, alignItems: "center" as const },
  copyAddressText: { color: "#D4C6F0", fontSize: 8, fontWeight: "600" },
  input: { minHeight: 38, borderWidth: 1, borderColor: "rgba(156,183,224,0.25)", borderRadius: 7, color: "#EAF2FF", paddingHorizontal: 10, fontSize: 10 },
  action: { minHeight: 36, borderRadius: 18, backgroundColor: "#7052AD", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  actionText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  secondaryAction: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: "rgba(174,194,230,0.35)", alignItems: "center", justifyContent: "center" },
  secondaryActionText: { color: "#D4C6F0", fontSize: 8, fontWeight: "600" },
  notice: { color: "#B8E3C5", fontSize: 8, lineHeight: 13 },
  error: { color: "#FFAB9A", fontSize: 8, lineHeight: 13 },
  disabled: { opacity: 0.55 }
});
