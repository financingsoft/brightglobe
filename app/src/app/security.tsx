import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { authClient } from "@/auth/client";

export default function SecurityScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const { data: session, refetch } = authClient.useSession();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const enabled = session?.user.twoFactorEnabled === true;
  const enrolling = Boolean(totpURI) && !enabled;
  const hasFreshCodes = backupCodes.length > 0;

  const beginEnrollment = async () => {
    if (password.length < 12) {
      setError(t("请输入当前账户密码。", "Enter your current account password."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authClient.twoFactor.enable({
        password,
        method: "totp",
        issuer: "BrightGlobe"
      });
      if (result.error) throw new Error(result.error.message || "Unable to start authenticator enrollment.");
      if (result.data.method !== "totp") throw new Error("TOTP enrollment was not returned.");
      setTotpURI(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("无法启用身份验证器。", "Could not enable the authenticator."));
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!/^\\d{6}$/.test(code.trim())) {
      setError(t("请输入 6 位动态验证码。", "Enter the 6-digit authenticator code."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: false });
      if (result.error) throw new Error(result.error.message || "The authenticator code is invalid.");
      await refetch();
      setTotpURI("");
      setCode("");
      setNotice(t("身份验证器已启用。请立即保存下方备用恢复码。", "Authenticator enabled. Save the backup codes below now."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("验证码无效，请重试。", "The code is invalid. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const rotateBackupCodes = () => {
    Alert.alert(
      t("重新生成备用恢复码？", "Regenerate backup codes?"),
      t("旧的所有备用恢复码会立即失效。请确认你能安全保存新代码。", "All existing backup codes will immediately stop working. Continue only if you can securely save the new codes."),
      [
        { text: t("取消", "Cancel"), style: "cancel" },
        { text: t("重新生成", "Regenerate"), style: "destructive", onPress: () => { void generateBackupCodes(); } }
      ]
    );
  };

  const generateBackupCodes = async () => {
    if (password.length < 12) {
      setError(t("请先输入当前账户密码。", "Enter your current account password first."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password });
      if (result.error) throw new Error(result.error.message || "Unable to regenerate backup codes.");
      setBackupCodes(result.data.backupCodes);
      setPassword("");
      setNotice(t("新恢复码只显示在本次页面中。旧恢复码已全部失效。", "New backup codes are shown only in this view. All previous codes are now invalid."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("无法生成备用恢复码。", "Could not generate backup codes."));
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    // Clipboard export is intentionally omitted: codes remain visible for manual secure storage.
    setNotice(t("请将代码保存到密码管理器或离线安全位置；不要截图或发送给他人。", "Store these codes in a password manager or secure offline location. Do not screenshot or share them."));
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
          <Text style={styles.title}>{t("账户安全", "Account security")}</Text>
          <View style={styles.back} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.heading}>{t("身份验证器", "Authenticator app")}</Text>
          <Text style={styles.copy}>
            {enabled
              ? t("已启用动态验证码。员工敏感操作还会要求一次性、限时的二次验证授权。", "Authenticator protection is enabled. Sensitive staff actions also require a one-time, short-lived step-up grant.")
              : t("使用身份验证器生成离线动态验证码。员工敏感操作必须先完成此设置。", "Use an authenticator app to generate offline codes. Staff-sensitive actions require this setup.")}
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.label}>{t("状态", "Status")}</Text>
            <Text style={enabled ? styles.good : styles.pending}>{enabled ? t("已启用", "Enabled") : t("未启用", "Not enabled")}</Text>
          </View>

          {!enabled && !enrolling ? (
            <>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t("当前账户密码", "Current account password")}
                placeholderTextColor="#8293B0"
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                style={styles.input}
                editable={!busy}
                maxLength={128}
              />
              <Pressable onPress={beginEnrollment} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{t("设置身份验证器", "Set up authenticator")}</Text>}
              </Pressable>
            </>
          ) : null}

          {enrolling ? (
            <View style={styles.enrollment}>
              <Text style={styles.copy}>{t("使用 Google Authenticator、1Password 或其他兼容 TOTP 的应用扫描二维码。二维码只在本机生成，不会发送给第三方。", "Scan this QR code with Google Authenticator, 1Password, or another TOTP-compatible app. The QR code is rendered locally and is not sent to a third party.")}</Text>
              <View style={styles.qrFrame}><QRCode value={totpURI} size={176} /></View>
              <Text selectable style={styles.uri}>{totpURI}</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder={t("输入身份验证器的 6 位验证码", "Enter the 6-digit authenticator code")}
                placeholderTextColor="#8293B0"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                editable={!busy}
              />
              <Pressable onPress={verifyEnrollment} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{t("验证并启用", "Verify and enable")}</Text>}
              </Pressable>
            </View>
          ) : null}

          {enabled ? (
            <>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t("当前账户密码（重新生成恢复码时需要）", "Current password (required to regenerate codes)")}
                placeholderTextColor="#8293B0"
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                style={styles.input}
                editable={!busy}
                maxLength={128}
              />
              <Pressable onPress={rotateBackupCodes} disabled={busy} style={[styles.secondary, busy && styles.disabled]}>
                <Text style={styles.secondaryText}>{t("重新生成备用恢复码", "Regenerate backup codes")}</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {hasFreshCodes ? (
          <View style={styles.panel}>
            <Text style={styles.heading}>{t("备用恢复码", "Backup codes")}</Text>
            <Text style={styles.warning}>
              {t("每个代码只能使用一次。生成新代码会立即使旧代码全部失效。此页面不会长期保存代码；离开页面后请确认你已安全备份。", "Each code can be used once. Generating new codes invalidates all previous codes immediately. Codes are not stored by this screen; make sure they are backed up before leaving.")}
            </Text>
            <View style={styles.codeGrid}>
              {backupCodes.map((item, index) => <Text selectable key={index} style={styles.code}>{item}</Text>)}
            </View>
            <Pressable onPress={copyCodes} style={styles.secondary}>
              <Text style={styles.secondaryText}>{t("我已了解如何安全保存", "I understand how to store these safely")}</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        <Text style={styles.footnote}>
          {t("如果同时失去身份验证器和全部备用恢复码，需要通过项目方线下身份核验与双人审批流程恢复；客服不会索取你的验证码或恢复码。", "If both your authenticator and all backup codes are lost, recovery requires the project's out-of-band identity verification and dual-approval process. Support will never ask for your codes.")}
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 460, alignSelf: "center", paddingBottom: 28 },
  header: { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)" },
  back: { width: 30 }, backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  title: { color: "#EAF2FF", fontSize: 13, fontWeight: "600" },
  panel: { borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)", paddingVertical: 16, gap: 10 },
  heading: { color: "#EAF2FF", fontSize: 12, fontWeight: "700" },
  copy: { color: "#A0B2D0", fontSize: 9, lineHeight: 15 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  label: { color: "#C9D9F2", fontSize: 9 },
  good: { color: "#83D9B2", fontSize: 9, fontWeight: "700" },
  pending: { color: "#F0C67A", fontSize: 9, fontWeight: "700" },
  input: { width: "100%", minHeight: 42, borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", borderRadius: 5, paddingHorizontal: 11, color: "#EAF2FF", fontSize: 10, marginTop: 4 },
  primary: { minHeight: 38, backgroundColor: "#7251B2", borderRadius: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  secondary: { minHeight: 36, borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.28)", borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondaryText: { color: "#C9D9F2", fontSize: 9 },
  disabled: { opacity: 0.5 },
  enrollment: { gap: 12 },
  qrFrame: { alignSelf: "center", backgroundColor: "#FFFFFF", padding: 12, borderRadius: 8, marginVertical: 6 },
  uri: { color: "#8293B0", fontSize: 7, lineHeight: 11 },
  warning: { color: "#F0C67A", fontSize: 8, lineHeight: 13 },
  codeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  code: { width: "47%", color: "#EAF2FF", backgroundColor: "rgba(156, 183, 224, 0.10)", borderRadius: 4, paddingVertical: 8, textAlign: "center", fontSize: 10, fontVariant: ["tabular-nums"] },
  error: { color: "#FF9FA5", fontSize: 9, marginTop: 10 },
  notice: { color: "#83D9B2", fontSize: 9, marginTop: 10 },
  footnote: { color: "#8293B0", fontSize: 8, lineHeight: 13, marginTop: 16 }
});
