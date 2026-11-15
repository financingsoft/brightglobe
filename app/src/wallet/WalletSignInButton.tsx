import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAccount, useAppKit, useProvider } from "@reown/appkit-react-native";
import { useAuth } from "@/auth/session";
import { useI18n } from "@/i18n/locale";
import { walletKitConfigured, SOLANA_DEVNET_CHAIN_ID } from "./appkit";
import { linkSolanaWalletToEmail, signInWithSolanaWallet } from "./auth";

export function WalletSignInButton() {
  if (!walletKitConfigured) return null;
  return <WalletSignInButtonInner />;
}

function WalletSignInButtonInner() {
  const { locale } = useI18n();
  const { acceptWalletSession, authMethod } = useAuth();
  const router = useRouter();
  const { open } = useAppKit();
  const { address, chainId, namespace, isConnected } = useAccount();
  const { provider, providerType } = useProvider();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const continueWithWallet = async () => {
    if (!isConnected || !address) {
      await open({ view: "Connect" });
      return;
    }
    if (namespace !== "solana" || providerType !== "solana" || !provider) {
      setError(t("请选择 Solana 钱包。", "Please connect a Solana wallet."));
      return;
    }
    if (String(chainId) !== SOLANA_DEVNET_CHAIN_ID) {
      setError(t("请先将钱包网络切换到 Solana Devnet。", "Switch your wallet to Solana Devnet first."));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const walletProvider = provider as {
          request: (
            args: { method: "solana_signMessage"; params: { message: string; pubkey: string } },
            chain: string
          ) => Promise<unknown>;
        };
      const session = authMethod === "email"
        ? await linkSolanaWalletToEmail(address, String(chainId), walletProvider)
        : await signInWithSolanaWallet(address, String(chainId), walletProvider);
      await acceptWalletSession(session);
      router.replace("/(tabs)");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("钱包登录失败，请重试。", "Wallet sign-in failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={continueWithWallet}
        style={[styles.button, busy && styles.disabled]}
      >
        {busy ? <ActivityIndicator color="#EAF2FF" /> : (
          <Text style={styles.buttonText}>
            {isConnected
              ? authMethod === "email"
                ? t("将钱包绑定到当前账户", "Link wallet to this account")
                : t("使用已连接的钱包登录", "Sign in with connected wallet")
              : t("连接 Solana 钱包", "Connect Solana wallet")}
          </Text>
        )}
      </Pressable>
      <Text style={styles.caption}>
        {authMethod === "email"
          ? t("将钱包绑定到当前邮箱账户，需要签署一次性身份验证消息。", "Link this wallet to your email account by signing a one-time identity proof.")
          : t("仅支持 Solana Devnet。连接钱包后，还需签署一次性登录验证消息；不会请求转账授权。", "Solana Devnet only. After connecting, sign a one-time login message. No transfer approval is requested.")}
      </Text>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(174, 194, 230, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    backgroundColor: "rgba(20, 33, 57, 0.76)"
  },
  buttonText: { color: "#DCE7FA", fontSize: 10, fontWeight: "600" },
  caption: { color: "#8799B8", fontSize: 7, lineHeight: 12, textAlign: "center", marginTop: 7 },
  error: { color: "#FFAB9A", fontSize: 8, lineHeight: 13, textAlign: "center", marginTop: 7 },
  disabled: { opacity: 0.55 }
});
