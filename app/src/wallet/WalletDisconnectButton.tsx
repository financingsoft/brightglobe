import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useAccount, useAppKit } from "@reown/appkit-react-native";
import { useI18n } from "@/i18n/locale";
import { walletKitConfigured } from "./appkit";

export function WalletDisconnectButton() {
  if (!walletKitConfigured) return null;
  return <WalletDisconnectButtonInner />;
}

function WalletDisconnectButtonInner() {
  const { locale } = useI18n();
  const { disconnect } = useAppKit();
  const { isConnected } = useAccount();
  const [error, setError] = useState("");
  if (!isConnected) return null;

  const zh = locale === "zh-CN";
  const handleDisconnect = async () => {
    setError("");
    try {
      await disconnect();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (zh ? "断开钱包连接失败。" : "Unable to disconnect the wallet."));
    }
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={handleDisconnect} style={styles.button}>
        <Text style={styles.text}>
          {zh ? "断开外部钱包连接（不会退出 BrightGlobe 账户）" : "Disconnect wallet connection (keeps BrightGlobe signed in)"}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 32, alignItems: "center", justifyContent: "center", marginTop: 7 },
  text: { color: "#91A5C5", fontSize: 7, textAlign: "center" },
  error: { color: "#FFAB9A", fontSize: 7, textAlign: "center", marginTop: 4 }
});
