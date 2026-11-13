import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function OfficialFollowScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "invalid" | "verified">("idle");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const verifyCode = () => {
    if (code.trim().toUpperCase() === "BG2026") {
      setStatus("verified");
      return;
    }
    setStatus("invalid");
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerAction}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("关注微信公众号", "Follow official account")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} style={styles.headerAction}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountIcon}><Text style={styles.accountGlyph}>BG</Text></View>
        <View style={styles.accountCopy}>
          <Text style={styles.accountName}>{t("BrightGlobe 官方服务号", "BrightGlobe Official Account")}</Text>
          <Text style={styles.accountMeta}>{t("服务通知 · 社区活动 · 贡献任务", "Service updates · Community events · Missions")}</Text>
        </View>
        <Text style={styles.followTag}>{t("官方", "Official")}</Text>
      </View>

      <View style={styles.steps}>
        <Text style={styles.sectionTitle}>{t("任务步骤", "How to complete")}</Text>
        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>{t("关注 BrightGlobe 官方微信公众号。", "Follow the BrightGlobe official account.")}</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>{t("在公众号任务菜单中获取验证码。", "Get a verification code from the account menu.")}</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>{t("输入验证码并提交，查看任务验证状态。", "Enter the code and submit to view the verification state.")}</Text>
        </View>
      </View>

      <View style={styles.verification}>
        <Text style={styles.sectionTitle}>{t("输入验证码", "Enter verification code")}</Text>
        <TextInput
          value={code}
          onChangeText={(value) => { setCode(value); setStatus("idle"); }}
          placeholder={t("请输入公众号提供的验证码", "Enter the code from the official account")}
          placeholderTextColor="#7D91B3"
          style={styles.input}
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={verifyCode}
        />
        <Pressable accessibilityRole="button" onPress={verifyCode} disabled={!code.trim()} style={[styles.verifyButton, !code.trim() && styles.verifyButtonDisabled]}>
          <Text style={styles.verifyButtonText}>{t("提交验证", "Verify code")}</Text>
        </Pressable>
        {status === "invalid" ? (
          <Text style={styles.errorMessage}>{t("验证码无效，请检查后重试。", "Invalid code. Check it and try again.")}</Text>
        ) : status === "verified" ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>{t("验证成功", "Verification successful")}</Text>
            <Text style={styles.successCopy}>{t("预览验证已通过。真实关注关系和原力奖励服务尚未连接。", "Preview verification passed. Live follow status and Power rewards are not connected.")}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>{t("预览演示码：BG2026（仅用于测试页面状态）", "Preview demo code: BG2026 (for UI testing only)")}</Text>
        )}
      </View>

      <Text style={styles.disclosure}>{t("本页面为本地交互预览，不会访问微信，也不会发放真实原力。", "Local interaction preview only. It does not access WeChat or issue real Contribution Power.")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)" },
  headerAction: { width: 28, height: 30, justifyContent: "center" },
  backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  closeGlyph: { color: "#C9D9F2", fontSize: 24, lineHeight: 27, textAlign: "right" },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "700" },
  accountCard: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderColor: "#E4E4E4" },
  accountIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#7044BF", alignItems: "center", justifyContent: "center" },
  accountGlyph: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  accountCopy: { flex: 1, gap: 5 },
  accountName: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  accountMeta: { color: "#8A9DBD", fontSize: 7 },
  followTag: { color: "#BD9AFF", fontSize: 7, borderWidth: 1, borderColor: "#B8A5D7", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9 },
  steps: { paddingVertical: 14, borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.16)", gap: 11 },
  sectionTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  stepNumber: { width: 18, height: 18, borderRadius: 9, textAlign: "center", textAlignVertical: "center", overflow: "hidden", backgroundColor: "#F0EAF8", color: "#BD9AFF", fontSize: 8, fontWeight: "700" },
  stepText: { flex: 1, color: "#B8C9E4", fontSize: 8, lineHeight: 13 },
  verification: { paddingTop: 15, gap: 10 },
  input: { minHeight: 42, borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", borderRadius: 3, paddingHorizontal: 10, color: "#EAF2FF", fontSize: 9 },
  verifyButton: { minHeight: 34, backgroundColor: "#7044BF", borderRadius: 18, alignItems: "center", justifyContent: "center" },
  verifyButtonDisabled: { backgroundColor: "#B9A9D4" },
  verifyButtonText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  hint: { color: "#8A9DBD", fontSize: 7 },
  errorMessage: { color: "#B54A4A", fontSize: 8 },
  successBox: { padding: 10, backgroundColor: "#F2EDF9", borderWidth: 1, borderColor: "#D6C9E8", borderRadius: 3, gap: 5 },
  successTitle: { color: "#5C369B", fontSize: 9, fontWeight: "700" },
  successCopy: { color: "#A0B2D0", fontSize: 7, lineHeight: 12 },
  disclosure: { color: "#788CAB", fontSize: 7, lineHeight: 12, textAlign: "center", marginTop: 18 }
});
