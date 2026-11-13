import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

export default function LoginScreen() {
  const { locale } = useI18n();
  const {
    status,
    previewEnabled,
    sendPhoneOtp,
    verifyPhoneOtp,
    updateProfile,
    enterPreviewAccount
  } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [callingCode, setCallingCode] = useState(locale === "zh-CN" ? "+86" : "+1");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const phoneNumber = useMemo(
    () => callingCode.trim() + phone.replace(/\D/g, ""),
    [callingCode, phone]
  );
  const validPhone = /^\+[1-9]\d{7,14}$/.test(phoneNumber);
  const backendUnavailable = status === "unconfigured";

  const requestCode = async () => {
    if (!validPhone) {
      setMessage(t("请填写完整的国际区号和手机号。", "Enter a valid international calling code and phone number."));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await sendPhoneOtp(phoneNumber);
      setCodeSent(true);
      setMessage(t("验证码已发送，请查收短信。", "Verification code sent. Check your messages."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("验证码发送失败。", "Could not send the code."));
    } finally {
      setBusy(false);
    }
  };

  const continueWithCode = async () => {
    if (!codeSent) {
      setMessage(t("请先获取验证码。", "Request a verification code first."));
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setMessage(t("请输入 6 位验证码。", "Enter the 6-digit verification code."));
      return;
    }
    if (mode === "signup" && !nickname.trim()) {
      setMessage(t("请输入昵称。", "Enter a nickname."));
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      await verifyPhoneOtp(phoneNumber, code.trim());
      if (mode === "signup" && nickname.trim()) {
        try {
          await updateProfile({ displayName: nickname.trim() });
        } catch {
          Alert.alert(
            t("账户已创建", "Account created"),
            t("登录成功，但昵称暂未保存。你可以稍后在账户设置中修改。", "You are signed in, but the nickname was not saved. You can update it in account settings.")
          );
        }
      }
      router.replace("/(tabs)");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("登录失败，请重试。", "Sign-in failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const enterPreview = () => {
    enterPreviewAccount();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
          <Text style={styles.headerTitle}>{t("登录注册", "Sign in / Sign up")}</Text>
          <Pressable onPress={() => router.push("/help")}><Text style={styles.help}>{t("帮助", "Help")}</Text></Pressable>
        </View>

        <View style={styles.logo}><Text style={styles.logoGlyph}>◇</Text></View>
        <Text style={styles.brand}>BrightGlobe</Text>
        <Text style={styles.tagline}>{t("让每一份贡献汇聚成改变", "A world of shared progress")}</Text>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>{mode === "login" ? t("手机号登录", "Mobile sign-in") : t("手机号注册", "Create account with phone")}</Text>
          {mode === "signup" ? (
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder={t("请输入昵称（必填）", "Nickname (required)")}
              placeholderTextColor="#AAAAAA"
              style={styles.singleInput}
              editable={!busy}
              maxLength={40}
            />
          ) : null}
          <View style={styles.fieldRow}>
            <TextInput
              value={callingCode}
              onChangeText={setCallingCode}
              keyboardType="phone-pad"
              placeholder="+1"
              placeholderTextColor="#AAAAAA"
              style={styles.callingCode}
              editable={!busy}
              accessibilityLabel={t("国际电话区号", "International calling code")}
              maxLength={5}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder={t("手机号", "Phone number")}
              placeholderTextColor="#AAAAAA"
              style={styles.input}
              editable={!busy}
            />
          </View>
          <View style={styles.fieldRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder={t("请输入 6 位验证码", "6-digit verification code")}
              placeholderTextColor="#AAAAAA"
              style={styles.input}
              editable={!busy && codeSent}
              maxLength={6}
            />
            <Pressable onPress={requestCode} disabled={busy || backendUnavailable} style={[styles.codeButton, (busy || backendUnavailable) && styles.disabled]}>
              <Text style={styles.codeText}>{codeSent ? t("重新获取", "Resend code") : t("获取验证码", "Get code")}</Text>
            </Pressable>
          </View>
          <Pressable onPress={continueWithCode} disabled={busy || backendUnavailable} style={[styles.primary, (busy || backendUnavailable) && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{mode === "signup" ? t("完成注册", "Create account") : t("立即登录", "Sign in")}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} style={styles.switchMode}>
            <Text style={styles.switchText}>{mode === "login" ? t("首次使用？点我注册", "New here? Create an account") : t("已有账户？返回登录", "Already registered? Sign in")}</Text>
          </Pressable>
          {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
        </View>

        {backendUnavailable ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{t("用户中心尚未部署", "User center is not deployed")}</Text>
            <Text style={styles.noticeDescription}>{t("客户端已接入 Better Auth，但尚未配置后端 API 地址。请配置 EXPO_PUBLIC_API_BASE_URL 并部署 HTTPS API 后，才能发送真实短信和登录。", "The client is wired to Better Auth, but the API base URL is not configured. Configure EXPO_PUBLIC_API_BASE_URL and deploy the HTTPS API before live SMS sign-in can work.")}</Text>
          </View>
        ) : null}

        {previewEnabled ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>{t("仅供本地 UI 测试", "Local UI test only")}</Text>
            <Text style={styles.previewDescription}>{t("预览账户不会创建真实身份、会话或积分。该入口只在显式开启预览构建时显示。", "Preview access creates no real identity, session, or points. This control is shown only when the preview build flag is explicitly enabled.")}</Text>
            <Pressable onPress={enterPreview} style={styles.previewButton}><Text style={styles.previewButtonText}>{t("进入本地预览账户", "Enter local preview")}</Text></Pressable>
          </View>
        ) : null}
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
  fieldRow: { minHeight: 43, borderBottomWidth: 1, borderColor: "#DDDDDD", flexDirection: "row", alignItems: "center", gap: 10 },
  callingCode: { width: 48, height: 42, color: "#555555", fontSize: 10, textAlign: "center" },
  input: { flex: 1, height: 42, color: "#333333", fontSize: 10 },
  codeButton: { minWidth: 73, alignItems: "flex-end", paddingVertical: 10 },
  codeText: { color: "#555555", fontSize: 8 },
  singleInput: { height: 43, borderBottomWidth: 1, borderColor: "#DDDDDD", fontSize: 10, color: "#333333", marginBottom: 8 },
  primary: { height: 39, backgroundColor: "#555555", borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 21 },
  primaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  switchMode: { alignItems: "center", paddingVertical: 14 },
  switchText: { color: "#777777", fontSize: 8 },
  message: { color: "#8A4B32", fontSize: 8, lineHeight: 13, textAlign: "center", marginTop: 5 },
  disabled: { opacity: 0.45 },
  noticeBox: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 6, padding: 12, marginTop: 24, gap: 7 },
  noticeTitle: { color: "#666666", fontSize: 8, fontWeight: "700" },
  noticeDescription: { color: "#888888", fontSize: 7, lineHeight: 12 },
  previewBox: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 6, padding: 12, marginTop: 20, gap: 7 },
  previewTitle: { color: "#666666", fontSize: 8, fontWeight: "700" },
  previewDescription: { color: "#888888", fontSize: 7, lineHeight: 12 },
  previewButton: { height: 30, borderRadius: 16, borderWidth: 1, borderColor: "#AAAAAA", alignItems: "center", justifyContent: "center", marginTop: 3 },
  previewButtonText: { color: "#555555", fontSize: 8, fontWeight: "600" }
});
