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
  license: { color: "#879AB8", fontSize: 7, lineHeight: 12 }
});
