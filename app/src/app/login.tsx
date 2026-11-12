import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PreviewStatusBar } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

export default function LoginScreen() {
  const { locale } = useI18n();
  const { enterPreviewAccount } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const requestCode = () => {
    if (!/^1\d{10}$/.test(phone)) {
      Alert.alert(t("提示", "Notice"), t("请输入有效的手机号。", "Enter a valid mobile number."));
      return;
    }
    Alert.alert(t("服务未连接", "Service unavailable"), t("短信验证码服务尚未接入。你可以使用本地预览账户查看页面。", "SMS verification is not connected. Use the local preview account to inspect the UI."));
  };

  const continueSignup = () => {
    if (!nickname.trim()) {
      Alert.alert(t("提示", "Notice"), t("请输入昵称。", "Enter a nickname."));
      return;
    }
    Alert.alert(t("服务未连接", "Service unavailable"), t("注册服务尚未接入。本地预览不会创建真实账户。", "Registration is not connected. The preview will not create a real account."));
  };

  const enterPreview = () => {
    enterPreviewAccount();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <PreviewStatusBar />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
          <Text style={styles.headerTitle}>{t("登录注册", "Sign in / Sign up")}</Text>
          <Pressable onPress={() => router.push("/(tabs)/help")}><Text style={styles.help}>{t("帮助", "Help")}</Text></Pressable>
        </View>

        <View style={styles.logo}><Text style={styles.logoGlyph}>◇</Text></View>
        <Text style={styles.brand}>BrightGlobe</Text>
        <Text style={styles.tagline}>{t("让每一份贡献汇聚成改变", "A world of shared progress")}</Text>

        {mode === "login" ? (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>{t("手机号登录", "Mobile sign-in")}</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.country}>+86</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t("请输入手机号", "Mobile number")} placeholderTextColor="#AAAAAA" style={styles.input} />
            </View>
            <View style={styles.fieldRow}>
              <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder={t("请输入验证码", "Verification code")} placeholderTextColor="#AAAAAA" style={styles.input} />
              <Pressable onPress={requestCode} style={styles.codeButton}><Text style={styles.codeText}>{t("获取验证码", "Get code")}</Text></Pressable>
            </View>
            <Pressable onPress={requestCode} style={styles.primary}><Text style={styles.primaryText}>{t("立即开启", "Continue")}</Text></Pressable>
            <Pressable onPress={() => setMode("signup")} style={styles.switchMode}><Text style={styles.switchText}>{t("首次使用？点我注册", "New here? Sign up")}</Text></Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>{t("设置昵称", "Set your nickname")}</Text>
            <TextInput value={nickname} onChangeText={setNickname} placeholder={t("请输入昵称（必填）", "Nickname (required)")} placeholderTextColor="#AAAAAA" style={styles.singleInput} />
            <TextInput value={inviteCode} onChangeText={setInviteCode} placeholder={t("邀请码（选填）", "Invitation code (optional)")} placeholderTextColor="#AAAAAA" style={styles.singleInput} />
            <Pressable onPress={continueSignup} style={styles.primary}><Text style={styles.primaryText}>{t("下一步", "Next")}</Text></Pressable>
            <Pressable onPress={() => setMode("login")} style={styles.switchMode}><Text style={styles.switchText}>{t("已有账户？返回登录", "Already have an account? Sign in")}</Text></Pressable>
          </View>
        )}

        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>{t("仅用于页面预览", "UI preview only")}</Text>
          <Text style={styles.previewDescription}>{t("验证码、注册和真实账户服务尚未接入。使用预览账户只会在当前应用会话中解锁受保护页面，不会创建账户或发放积分。", "SMS verification, registration, and live account services are not connected. The preview account only unlocks protected screens for this app session; it creates no account or rewards.")}</Text>
          <Pressable onPress={enterPreview} style={styles.previewButton}><Text style={styles.previewButtonText}>{t("进入本地预览账户", "Enter preview account")}</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  page: { flex: 1, width: "100%", maxWidth: 390, alignSelf: "center", paddingHorizontal: 24 },
  header: { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 36 }, backGlyph: { color: "#333333", fontSize: 28, lineHeight: 31 },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600" },
  help: { color: "#777777", fontSize: 9 },
  logo: { width: 43, height: 43, borderWidth: 1, borderColor: "#BEBEBE", borderRadius: 22, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 35 },
  logoGlyph: { color: "#555555", fontSize: 24 },
  brand: { color: "#333333", fontSize: 19, fontWeight: "700", textAlign: "center", marginTop: 9 },
  tagline: { color: "#999999", fontSize: 8, textAlign: "center", marginTop: 4 },
  form: { marginTop: 34 },
  sectionTitle: { color: "#444444", fontSize: 12, fontWeight: "700", marginBottom: 11 },
  fieldRow: { height: 43, borderBottomWidth: 1, borderColor: "#DDDDDD", flexDirection: "row", alignItems: "center", gap: 10 },
  country: { color: "#555555", fontSize: 10 },
  input: { flex: 1, height: 42, color: "#333333", fontSize: 10 },
  codeButton: { minWidth: 73, alignItems: "flex-end" },
  codeText: { color: "#555555", fontSize: 8 },
  singleInput: { height: 43, borderBottomWidth: 1, borderColor: "#DDDDDD", fontSize: 10, color: "#333333" },
  primary: { height: 39, backgroundColor: "#555555", borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 21 },
  primaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  switchMode: { alignItems: "center", paddingVertical: 14 },
  switchText: { color: "#777777", fontSize: 8 },
  previewBox: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 6, padding: 12, marginTop: 28, gap: 7 },
  previewTitle: { color: "#666666", fontSize: 8, fontWeight: "700" },
  previewDescription: { color: "#888888", fontSize: 7, lineHeight: 12 },
  previewButton: { height: 30, borderRadius: 16, borderWidth: 1, borderColor: "#AAAAAA", alignItems: "center", justifyContent: "center", marginTop: 3 },
  previewButtonText: { color: "#555555", fontSize: 8, fontWeight: "600" }
});