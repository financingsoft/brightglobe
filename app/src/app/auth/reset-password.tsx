import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

export default function ResetPasswordScreen() {
  const { locale } = useI18n();
  const { resetPassword } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const submit = async () => {
    if (!token || params.error) {
      setMessage(t("重置链接无效或已过期，请重新申请。", "This reset link is invalid or expired. Request a new one."));
      return;
    }
    if (password.length < 12) {
      setMessage(t("新密码至少需要 12 位。", "Your new password must be at least 12 characters."));
      return;
    }
    if (password !== confirmation) {
      setMessage(t("两次输入的密码不一致。", "The passwords do not match."));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await resetPassword(token, password);
      setMessage(t("密码已更新，请使用新密码登录。", "Password updated. Sign in with your new password."));
      setTimeout(() => router.replace("/login"), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("密码重置失败，请重新申请链接。", "Password reset failed. Request a new link."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StarfieldBackground />
      <View style={styles.content}>
        <Text style={styles.brand}>BrightGlobe</Text>
        <Text style={styles.title}>{t("设置新密码", "Set a new password")}</Text>
        <Text style={styles.description}>{t("请设置至少 12 位的新密码。", "Choose a new password with at least 12 characters.")}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t("新密码", "New password")}
          placeholderTextColor="#8293B0"
          style={styles.input}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={128}
        />
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={t("再次输入新密码", "Confirm new password")}
          placeholderTextColor="#8293B0"
          style={styles.input}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={128}
        />
        <Pressable onPress={submit} disabled={busy || !token} style={[styles.button, (busy || !token) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t("更新密码", "Update password")}</Text>}
        </Pressable>
        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#030817" },
  content: { flex: 1, justifyContent: "center", padding: 28, maxWidth: 460, width: "100%", alignSelf: "center" },
  brand: { color: "#B9A0F0", fontSize: 12, fontWeight: "700", letterSpacing: 2, textAlign: "center" },
  title: { color: "#EAF2FF", fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 18 },
  description: { color: "#9EAFCC", fontSize: 11, textAlign: "center", marginTop: 9, marginBottom: 20 },
  input: { height: 48, borderBottomWidth: 1, borderColor: "rgba(157,184,226,0.28)", color: "#EAF2FF", fontSize: 12, marginBottom: 12 },
  button: { height: 44, borderRadius: 24, backgroundColor: "#7251B2", alignItems: "center", justifyContent: "center", marginTop: 20 },
  buttonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  message: { color: "#AFC5E8", fontSize: 10, textAlign: "center", lineHeight: 16, marginTop: 16 }
});
