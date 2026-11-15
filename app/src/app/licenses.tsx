import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { REOWN_APPKIT_LICENSE } from "@/legal/reown-appkit-license";

export default function LicensesScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const zh = locale === "zh-CN";

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{zh ? "第三方许可" : "Third-party licenses"}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.notice}>Portions © 2025 Reown, Inc. All Rights Reserved</Text>
        <Text style={styles.product}>Reown AppKit for React Native</Text>
        <Text style={styles.description}>
          {zh
            ? "BrightGlobe 使用 Reown AppKit 提供外部钱包连接。钱包身份验证和账户权限仍由 BrightGlobe 服务端管理。"
            : "BrightGlobe uses Reown AppKit for external wallet connectivity. Wallet authentication and account authorization remain managed by BrightGlobe services."}
        </Text>
        <Text selectable style={styles.license}>{REOWN_APPKIT_LICENSE}</Text>
        <View style={styles.separator} />
        <Text style={styles.notice}>{zh ? "开源依赖" : "Open-source dependencies"}</Text>
        <Text style={styles.product}>react-native-qrcode-svg · MIT</Text>
        <Text style={styles.description}>
          {zh
            ? "用于生成钱包收款地址二维码。项目：https://github.com/Expensify/react-native-qrcode-svg"
            : "Used to render wallet receive-address QR codes. Project: https://github.com/Expensify/react-native-qrcode-svg"}
        </Text>
        <Text style={styles.product}>expo-camera · MIT</Text>
        <Text style={styles.description}>
          {zh
            ? "用于扫描收款方 Solana 钱包地址二维码。项目：https://github.com/expo/expo/tree/main/packages/expo-camera"
            : "Used to scan recipient Solana wallet-address QR codes. Project: https://github.com/expo/expo/tree/main/packages/expo-camera"}
        </Text>
        <Text style={styles.product}>expo-clipboard · MIT</Text>
        <Text style={styles.description}>
          {zh
            ? "用于复制钱包收款地址。项目：https://github.com/expo/expo/tree/main/packages/expo-clipboard"
            : "Used to copy wallet receive addresses. Project: https://github.com/expo/expo/tree/main/packages/expo-clipboard"}
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)" },
  back: { width: 28 },
  backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "600" },
  scroll: { flex: 1, marginTop: 10 },
  content: { paddingBottom: 24, gap: 8 },
  notice: { color: "#D9E6F8", fontSize: 9, fontWeight: "700" },
  product: { color: "#AFC3E2", fontSize: 8, fontWeight: "700" },
  description: { color: "#8FA4C5", fontSize: 8, lineHeight: 13, marginBottom: 8 },
  separator: { height: 1, backgroundColor: "rgba(156,183,224,0.2)", marginVertical: 8 },
  license: { color: "#879AB8", fontSize: 7, lineHeight: 12 }
});
