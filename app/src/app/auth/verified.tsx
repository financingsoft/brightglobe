import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { useI18n } from "@/i18n/locale";

export default function EmailVerifiedScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const failed = Boolean(params.error);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  return (
    <SafeAreaView style={styles.safe}>
      <StarfieldBackground />
      <View style={styles.content}>
        <Text style={styles.symbol}>{failed ? "!" : "✓"}</Text>
        <Text style={styles.title}>{failed
          ? t("验证链接无效或已过期", "Verification link is invalid or expired")
          : t("邮箱验证成功", "Email verified")}</Text>
        <Text style={styles.description}>{failed
          ? t("请返回登录页重新发送验证邮件。", "Return to sign-in and request a new verification email.")
          : t("你的 BrightGlobe 邮箱已验证，现在可以登录账户。", "Your BrightGlobe email is verified. You can now sign in.")}</Text>
        <Pressable onPress={() => router.replace("/login")} style={styles.button}>
          <Text style={styles.buttonText}>{t("返回登录", "Continue to sign in")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#030817" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  symbol: { color: "#B9A0F0", fontSize: 42, fontWeight: "700" },
  title: { color: "#EAF2FF", fontSize: 20, fontWeight: "700", marginTop: 18, textAlign: "center" },
  description: { color: "#9EAFCC", fontSize: 12, lineHeight: 19, marginTop: 12, textAlign: "center", maxWidth: 320 },
  button: { height: 44, minWidth: 190, borderRadius: 24, backgroundColor: "#7251B2", alignItems: "center", justifyContent: "center", marginTop: 28, paddingHorizontal: 22 },
  buttonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" }
});
