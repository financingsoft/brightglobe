import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import { ApiError } from "@/services/api";
import { claimInvitation, getMyInvitation, type InvitationOverview } from "@/services/community";

export default function InviteScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated, isPreviewAccount } = useAuth();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const [overview, setOverview] = useState<InvitationOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!isAuthenticated || isPreviewAccount) {
      setOverview(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    getMyInvitation().then((value) => {
      if (active) setOverview(value);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : t("暂时无法读取邀请码", "Unable to load your invitation code"));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [isAuthenticated, isPreviewAccount, locale]));

  const copyCode = async () => {
    if (!overview?.code) return;
    await Clipboard.setStringAsync(overview.code);
    Alert.alert(t("已复制", "Copied"), t("邀请码已复制到剪贴板。", "Invitation code copied to clipboard."));
  };

  const submitClaim = async () => {
    if (!claimCode.trim() || claiming) return;
    setClaiming(true);
    try {
      await claimInvitation(claimCode);
      setClaimCode("");
      Alert.alert(t("绑定成功", "Invitation recorded"), t("邀请关系已记录；当前版本不会发放邀请奖励。", "The invitation attribution was recorded. No invitation reward is issued in this release."));
    } catch (reason) {
      const message = reason instanceof ApiError && reason.code === "INVITATION_ALREADY_CLAIMED"
        ? t("此账户已经绑定过邀请码。", "This account already has an invitation attribution.")
        : reason instanceof ApiError && reason.code === "SELF_INVITATION_NOT_ALLOWED"
          ? t("不能使用自己的邀请码。", "You cannot use your own invitation code.")
          : reason instanceof Error ? reason.message : t("邀请码提交失败。", "Unable to submit the invitation code.");
      Alert.alert(t("无法绑定", "Unable to apply code"), message);
    } finally {
      setClaiming(false);
    }
  };

  if (!isAuthenticated || isPreviewAccount) {
    return <AppScreen><View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.backGlyph}>‹</Text></Pressable><Text style={styles.headerTitle}>{t("邀请码", "Invitation")}</Text><View style={styles.side} /></View><Text style={styles.notice}>{t("请登录真实账户后使用邀请功能。", "Sign in with a real account to use invitations.")}</Text><Pressable onPress={() => router.push("/login")} style={styles.action}><Text style={styles.actionText}>{t("登录", "Sign in")}</Text></Pressable></AppScreen>;
  }

  const inviteUrl = overview ? `brightglobe://invite?code=${overview.code}` : "";
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.side}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("邀请码", "Invitation")}</Text>
        <View style={styles.side} />
      </View>
      <Text style={styles.pageTitle}>{t("邀请好友加入 BrightGlobe", "Invite friends to BrightGlobe")}</Text>
      <Text style={styles.subtitle}>{t("邀请关系会记录在账户中。当前版本不发放邀请奖励。", "Invitation attribution is recorded on your account. No referral rewards are issued in this release.")}</Text>
      {loading ? <ActivityIndicator color="#C9B7F0" style={styles.loader} /> : error ? <Text style={styles.error}>{error}</Text> : overview ? (
        <View style={styles.codeCard}>
          <Text style={styles.label}>{t("我的邀请码", "My invitation code")}</Text>
          <Text style={styles.code}>{overview.code}</Text>
          <Pressable onPress={copyCode} style={styles.action}><Text style={styles.actionText}>{t("复制邀请码", "Copy code")}</Text></Pressable>
          <View style={styles.qrBox}><QRCode value={inviteUrl} size={136} backgroundColor="#FFFFFF" color="#10182A" /></View>
          <Text style={styles.qrCaption}>{t("扫码打开邀请链接", "Scan to open the invitation link")}</Text>
          <Text style={styles.count}>{t("已记录邀请关系", "Attributed referrals")}: {overview.referralCount}</Text>
        </View>
      ) : null}
      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>{t("填写好友的邀请码", "Have an invitation code?")}</Text>
        <TextInput value={claimCode} onChangeText={setClaimCode} autoCapitalize="characters" maxLength={16} placeholder={t("输入邀请码", "Enter invitation code")} placeholderTextColor="#7E91B1" style={styles.input} />
        <Pressable disabled={claiming || !claimCode.trim()} onPress={submitClaim} style={[styles.action, (claiming || !claimCode.trim()) && styles.disabled]}><Text style={styles.actionText}>{claiming ? t("提交中…", "Submitting…") : t("绑定邀请码", "Apply code")}</Text></Pressable>
      </View>
      <Text style={styles.notice}>{t("邀请奖励、任务奖励及兑换均未在 V1.0 启用。", "Referral rewards, mission rewards, and redemption are not enabled in V1.0.")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)" },
  side: { width: 28 }, backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "600" },
  pageTitle: { color: "#EAF2FF", fontSize: 14, fontWeight: "700", marginTop: 17, textAlign: "center" },
  subtitle: { color: "#96A9C8", fontSize: 9, lineHeight: 15, textAlign: "center", marginTop: 7, marginHorizontal: 12 },
  codeCard: { borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", borderRadius: 9, padding: 16, alignItems: "center", marginTop: 16 },
  label: { color: "#A0B2D0", fontSize: 9 }, code: { color: "#EAF2FF", fontSize: 23, fontWeight: "700", letterSpacing: 3, marginTop: 8 },
  action: { height: 34, minWidth: 120, borderRadius: 18, backgroundColor: "#7655B6", justifyContent: "center", alignItems: "center", paddingHorizontal: 16, marginTop: 10 },
  actionText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  qrBox: { backgroundColor: "#FFFFFF", padding: 10, marginTop: 16, borderRadius: 5 },
  qrCaption: { color: "#96A9C8", fontSize: 8, marginTop: 8 },
  count: { color: "#C9D9F2", fontSize: 9, marginTop: 12 },
  rules: { borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", borderRadius: 8, padding: 12, marginTop: 14, gap: 8 },
  rulesTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  input: { color: "#EAF2FF", borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.32)", borderRadius: 7, paddingHorizontal: 10, height: 38, fontSize: 12 },
  disabled: { opacity: 0.45 }, notice: { color: "#8498B8", fontSize: 8, lineHeight: 13, textAlign: "center", marginTop: 14 },
  error: { color: "#F0A5A5", fontSize: 9, textAlign: "center", marginTop: 14 }, loader: { marginTop: 24 }
});
