import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import { StarfieldBackground } from "@/components/StarfieldBackground";

type LoginMode = "login" | "signup" | "forgot";

export default function LoginScreen() {
  const { locale } = useI18n();
  const {
    status,
    previewEnabled,
    signUpEmail,
    signInEmail,
    sendVerificationEmail,
    requestPasswordReset,
    enterPreviewAccount
  } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compactHeight = height < 640;
  const horizontalPadding = width < 350 ? 18 : width < 410 ? 24 : 30;
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"info" | "error">("info");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const backendUnavailable = status === "unconfigured";
  const normalizedEmail = email.trim().toLowerCase();

  const showMessage = (value: string, kind: "info" | "error" = "info") => {
    setMessage(value);
    setMessageKind(kind);
  };

  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showMessage(t("请输入有效的邮箱地址。", "Enter a valid email address."), "error");
      return;
    }
    if (mode !== "forgot" && password.length < 12) {
      showMessage(t("密码至少需要 12 位。", "Your password must be at least 12 characters."), "error");
      return;
    }
    if (mode === "signup" && !nickname.trim()) {
      showMessage(t("请输入昵称。", "Enter a display name."), "error");
      return;
    }

    setBusy(true);
    showMessage("");
    try {
      if (mode === "signup") {
        await signUpEmail(normalizedEmail, password, nickname.trim());
        setMode("login");
        showMessage(t("注册信息已提交。请打开邮箱，点击验证链接后再登录。", "Registration submitted. Check your inbox and verify your email before signing in."));
      } else if (mode === "forgot") {
        await requestPasswordReset(normalizedEmail);
        showMessage(t("如果该邮箱已注册，密码重置链接将发送至你的邮箱。", "If an account exists for this email, a password reset link will be sent."));
      } else {
        await signInEmail(normalizedEmail, password);
        router.replace("/(tabs)");
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("操作失败，请稍后重试。", "The request failed. Please try again."), "error");
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showMessage(t("请先填写有效的邮箱地址。", "Enter a valid email address first."), "error");
      return;
    }
    setBusy(true);
    showMessage("");
    try {
      await sendVerificationEmail(normalizedEmail);
      showMessage(t("如果账户需要验证，验证邮件已重新发送。", "If the account requires verification, a new email has been sent."));
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("发送失败，请稍后重试。", "Could not send the email. Try again."), "error");
    } finally {
      setBusy(false);
    }
  };

  const enterPreview = () => {
    enterPreviewAccount();
    router.replace("/(tabs)");
  };

  const title = mode === "signup"
    ? t("创建账户", "Create account")
    : mode === "forgot"
      ? t("重置密码", "Reset password")
      : t("邮箱登录", "Email sign-in");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StarfieldBackground />
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[styles.page, { paddingHorizontal: horizontalPadding, paddingBottom: compactHeight ? 24 : 18 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
          <Text style={styles.headerTitle}>{t("账户中心", "Account")}</Text>
          <Pressable onPress={() => router.push("/help")}><Text style={styles.help}>{t("帮助", "Help")}</Text></Pressable>
        </View>

        <View style={[styles.logo, compactHeight && styles.logoCompact]}><Text style={styles.logoGlyph}>◇</Text></View>
        <Text style={styles.brand}>BrightGlobe</Text>
        <Text style={styles.tagline}>{t("让每一份贡献汇聚成改变", "A world of shared progress")}</Text>

        <View style={[styles.form, compactHeight && styles.formCompact]}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {mode === "signup" ? (
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder={t("昵称", "Display name")}
              placeholderTextColor="#8293B0"
              style={styles.singleInput}
              editable={!busy}
              maxLength={48}
              autoCapitalize="words"
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("邮箱地址", "Email address")}
            placeholderTextColor="#8293B0"
            style={styles.singleInput}
            editable={!busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
          />
          {mode !== "forgot" ? (
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("密码（至少 12 位）", "Password (12 characters minimum)")}
              placeholderTextColor="#8293B0"
              style={styles.singleInput}
              editable={!busy}
              secureTextEntry
              textContentType={mode === "signup" ? "newPassword" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              maxLength={128}
            />
          ) : null}
          <Pressable onPress={submit} disabled={busy || backendUnavailable} style={[styles.primary, (busy || backendUnavailable) && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>
              {mode === "signup" ? t("注册并发送验证邮件", "Create account")
                : mode === "forgot" ? t("发送重置链接", "Send reset link")
                  : t("登录", "Sign in")}
            </Text>}
          </Pressable>

          {mode === "login" ? (
            <>
              <Pressable onPress={() => { setMode("forgot"); showMessage(""); }} style={styles.secondaryAction}>
                <Text style={styles.switchText}>{t("忘记密码？", "Forgot password?")}</Text>
              </Pressable>
              <Pressable onPress={resendVerification} disabled={busy || backendUnavailable} style={styles.secondaryAction}>
                <Text style={styles.switchText}>{t("重新发送邮箱验证", "Resend verification email")}</Text>
              </Pressable>
              <Pressable onPress={() => { setMode("signup"); showMessage(""); }} style={styles.switchMode}>
                <Text style={styles.switchText}>{t("首次使用？创建账户", "New here? Create an account")}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => { setMode("login"); showMessage(""); }} style={styles.switchMode}>
              <Text style={styles.switchText}>{t("返回登录", "Back to sign in")}</Text>
            </Pressable>
          )}
          {message ? <Text accessibilityLiveRegion="polite" style={[styles.message, messageKind === "error" && styles.errorMessage]}>{message}</Text> : null}
        </View>

        {backendUnavailable ? (
          <View style={[styles.noticeBox, compactHeight && styles.noticeBoxCompact]}>
            <Text style={styles.noticeTitle}>{t("用户中心尚未配置", "User center is not configured")}</Text>
            <Text style={styles.noticeDescription}>{t("需要配置 API 地址，并在 Staging Worker 启用邮件认证及邮件服务凭证后，才能创建真实账户。", "Configure the API URL, enable email authentication, and add the transactional email credentials to the Staging Worker before creating real accounts.")}</Text>
          </View>
        ) : null}

        {previewEnabled ? (
          <View style={[styles.previewBox, compactHeight && styles.previewBoxCompact]}>
            <Text style={styles.previewTitle}>{t("仅供本地 UI 测试", "Local UI test only")}</Text>
            <Text style={styles.previewDescription}>{t("预览账户不会创建真实身份、会话或积分。", "Preview access creates no real identity, session, or points.")}</Text>
            <Pressable onPress={enterPreview} style={styles.previewButton}><Text style={styles.previewButtonText}>{t("进入本地预览账户", "Enter local preview")}</Text></Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent", position: "relative" },
  pageScroll: { flex: 1, width: "100%" },
  page: { flexGrow: 1, width: "100%", maxWidth: 460, alignSelf: "center", position: "relative" },
  header: { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 36 }, backGlyph: { color: "#EAF2FF", fontSize: 28, lineHeight: 31 },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "600" },
  help: { color: "#9EAFCC", fontSize: 9 },
  logo: { width: 43, height: 43, borderWidth: 1, borderColor: "rgba(165, 190, 230, 0.36)", borderRadius: 22, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 35 },
  logoCompact: { marginTop: 18 },
  logoGlyph: { color: "#C5D4EC", fontSize: 24 },
  brand: { color: "#EAF2FF", fontSize: 19, fontWeight: "700", textAlign: "center", marginTop: 9 },
  tagline: { color: "#8799B8", fontSize: 8, textAlign: "center", marginTop: 4 },
  form: { marginTop: 34 },
  formCompact: { marginTop: 20 },
  sectionTitle: { color: "#DDE8FA", fontSize: 12, fontWeight: "700", marginBottom: 11 },
  singleInput: { height: 46, borderBottomWidth: 1, borderColor: "rgba(157, 184, 226, 0.24)", fontSize: 11, color: "#EAF2FF", marginBottom: 8, paddingHorizontal: 2 },
  primary: { height: 42, backgroundColor: "#7251B2", borderRadius: 22, alignItems: "center", justifyContent: "center", marginTop: 21 },
  primaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  secondaryAction: { alignItems: "center", paddingVertical: 10 },
  switchMode: { alignItems: "center", paddingVertical: 12 },
  switchText: { color: "#9EAFCC", fontSize: 9 },
  message: { color: "#AFC5E8", fontSize: 9, lineHeight: 15, textAlign: "center", marginTop: 7 },
  errorMessage: { color: "#FFAB9A" },
  disabled: { opacity: 0.45 },
  noticeBoxCompact: { marginTop: 16 },
  noticeBox: { borderWidth: 1, borderColor: "rgba(157, 184, 226, 0.18)", borderRadius: 6, padding: 12, marginTop: 24, gap: 7 },
  noticeTitle: { color: "#B5C5DF", fontSize: 8, fontWeight: "700" },
  noticeDescription: { color: "#91A2C0", fontSize: 7, lineHeight: 12 },
  previewBoxCompact: { marginTop: 14 },
  previewBox: { borderWidth: 1, borderColor: "rgba(157, 184, 226, 0.18)", borderRadius: 6, padding: 12, marginTop: 20, gap: 7 },
  previewTitle: { color: "#B5C5DF", fontSize: 8, fontWeight: "700" },
  previewDescription: { color: "#91A2C0", fontSize: 7, lineHeight: 12 },
  previewButton: { height: 30, borderRadius: 16, borderWidth: 1, borderColor: "#6F82A2", alignItems: "center", justifyContent: "center", marginTop: 3 },
  previewButtonText: { color: "#C5D4EC", fontSize: 8, fontWeight: "600" }
});
