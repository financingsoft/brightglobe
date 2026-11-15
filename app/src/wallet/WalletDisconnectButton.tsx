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
  if (!isConnected) return null;

  const zh = locale === "zh-CN";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => { void disconnect(); }}
      style={styles.button}
    >
      <Text style={styles.text}>
        {zh ? "断开外部钱包连接（不会退出 BrightGlobe 账户）" : "Disconnect wallet connection (keeps BrightGlobe signed in)"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 32, alignItems: "center", justifyContent: "center", marginTop: 7 },
  text: { color: "#91A5C5", fontSize: 7, textAlign: "center" }
});
