import { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import bs58 from "bs58";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
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

  const refreshOnChainBalance = async () => {
    if (!address || !providerReady || !linkedWallet) return;
    const snapshot = await getBgOnChainWalletBalance(address);
    setOnChainBalance(snapshot.onChainBalanceBaseUnits);
    setOnChainBalanceError("");
  };

  const openQrScanner = async () => {
    setError("");
    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (!permission.granted) {
          setError(t(
            "需要相机权限才能扫描收款二维码。若之前已拒绝，请在系统设置中允许 BrightGlobe 使用相机。",
            "Camera permission is required to scan a receiving QR code. If access was previously denied, enable camera access for BrightGlobe in system settings."
          ));
          return;
        }
      }
      setScannerOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("无法请求相机权限。", "Unable to request camera permission."));
    }
  };

  const handleQrScanned = ({ data }: { data: string }) => {
    const candidate = data.trim().startsWith("solana:")
      ? data.trim().slice("solana:".length).split("?")[0]
      : data.trim();
    try {
      if (bs58.decode(candidate).length !== 32) throw new Error("Invalid public key length.");
      setRecipient(candidate);
      setIdempotencyKey(null);
      setScannerOpen(false);
      setError("");
      setNotice(t("已读取收款钱包地址，请核对后再转账。", "Wallet address scanned. Verify it before sending."));
    } catch {
      setScannerOpen(false);
      setError(t("二维码不是有效的 Solana 钱包地址。", "The QR code does not contain a valid Solana wallet address."));
    }
  };

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
        await Promise.all([onAccountRefresh(), refreshOnChainBalance()]);
        setPending(null);
        setIdempotencyKey(null);
      } else if (snapshot.status === "failed" || snapshot.status === "expired") {
        setPending(null);
        setIdempotencyKey(null);
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
    try {
      if (bs58.decode(recipient.trim()).length !== 32) throw new Error("Invalid Solana address length.");
    } catch {
      setError(t("收款地址格式不正确，请输入有效的 Solana 地址。", "The recipient is not a valid Solana address."));
      return;
    }
    if (recipient.trim() === address) {
      setError(t("收款地址不能与当前发送钱包相同。", "The recipient must be different from the sending wallet."));
      return;
    }

    setBusy(true);
    try {
      const amountBaseUnits = decimalStringToAssetBaseUnits(amount, decimals);
      const operationKey = idempotencyKey ?? ("bg-transfer-" + (() => {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      })());
      setIdempotencyKey(operationKey);
      const intent = await createBgTransferIntent({
        fromAddress: address,
        toAddress: recipient.trim(),
        amountBaseUnits,
        idempotencyKey: operationKey
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
      try {
        if (bs58.decode(signature).length !== 64) throw new Error("Invalid transaction signature length.");
      } catch {
        throw new Error("The connected wallet returned an invalid Solana transaction signature.");
      }

      const current = { intentId: intent.intentId, signature };
      setPending(current);
      setNotice(t("钱包已广播交易，正在登记并等待最终确认。", "The wallet broadcast the transaction. Registering it and waiting for finality."));
      await reportBgTransferSubmitted(intent.intentId, signature);
      const snapshot = await getBgAssetTransaction(intent.intentId);
      if (snapshot.status === "finalized" && snapshot.ledgerSettled) {
        await Promise.all([onAccountRefresh(), refreshOnChainBalance()]);
        setPending(null);
        setIdempotencyKey(null);
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
            <Text style={styles.receiveHint}>
              {t("二维码仅包含 Devnet 钱包地址，不包含 BG 金额或支付请求。", "This QR contains only a Devnet wallet address, not a BG amount or payment request.")}
            </Text>
            <Pressable accessibilityRole="button" onPress={copyWalletAddress} style={styles.copyAddressButton}>
              <Text style={styles.copyAddressText}>{t("复制收款地址", "Copy receive address")}</Text>
            </Pressable>
          </View>
          <View style={styles.recipientRow}>
            <TextInput
              value={recipient}
              onChangeText={(value) => { setRecipient(value); setIdempotencyKey(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("收款方 Solana 地址", "Recipient Solana address")}
              placeholderTextColor="#8293B0"
              editable={!busy && !pending}
              style={[styles.input, styles.recipientInput]}
            />
            <Pressable accessibilityRole="button" disabled={busy || Boolean(pending)} onPress={openQrScanner} style={styles.scanButton}>
              <Text style={styles.scanButtonText}>{t("扫码", "Scan")}</Text>
            </Pressable>
          </View>
          <TextInput
            value={amount}
            onChangeText={(value) => { setAmount(value); setIdempotencyKey(null); }}
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
      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scannerScreen}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleQrScanned}
          />
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>{t("扫描 Solana 收款二维码", "Scan Solana receive QR")}</Text>
            <Pressable accessibilityRole="button" onPress={() => setScannerOpen(false)} style={styles.scannerClose}>
              <Text style={styles.scannerCloseText}>{t("关闭", "Close")}</Text>
            </Pressable>
          </View>
          <View pointerEvents="none" style={styles.scannerGuide}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerHint}>{t("将钱包地址二维码放入框内", "Place a wallet address QR inside the frame")}</Text>
          </View>
        </View>
      </Modal>
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
  receiveHint: { color: "#788CAB", fontSize: 6, textAlign: "center" as const, lineHeight: 10 },
  copyAddressButton: { minHeight: 30, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: "rgba(174,194,230,0.35)", justifyContent: "center" as const, alignItems: "center" as const },
  copyAddressText: { color: "#D4C6F0", fontSize: 8, fontWeight: "600" },
  recipientRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  recipientInput: { flex: 1 },
  scanButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 7, backgroundColor: "rgba(112,82,173,0.45)", justifyContent: "center" as const, alignItems: "center" as const },
  scanButtonText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  input: { minHeight: 38, borderWidth: 1, borderColor: "rgba(156,183,224,0.25)", borderRadius: 7, color: "#EAF2FF", paddingHorizontal: 10, fontSize: 10 },
  scannerScreen: { flex: 1, backgroundColor: "#050D20", justifyContent: "space-between" as const },
  scannerHeader: { paddingTop: 58, paddingHorizontal: 20, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  scannerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  scannerClose: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: "rgba(5,13,32,0.7)", justifyContent: "center" as const },
  scannerCloseText: { color: "#FFFFFF", fontSize: 11 },
  scannerGuide: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const, gap: 18 },
  scannerFrame: { width: 250, height: 250, borderWidth: 2, borderColor: "#FFFFFF", borderRadius: 18, backgroundColor: "transparent" },
  scannerHint: { color: "#FFFFFF", fontSize: 11, backgroundColor: "rgba(5,13,32,0.65)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  action: { minHeight: 36, borderRadius: 18, backgroundColor: "#7052AD", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  actionText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  secondaryAction: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: "rgba(174,194,230,0.35)", alignItems: "center", justifyContent: "center" },
  secondaryActionText: { color: "#D4C6F0", fontSize: 8, fontWeight: "600" },
  notice: { color: "#B8E3C5", fontSize: 8, lineHeight: 13 },
  error: { color: "#FFAB9A", fontSize: 8, lineHeight: 13 },
  disabled: { opacity: 0.55 }
});
