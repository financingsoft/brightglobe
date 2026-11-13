import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n, type Locale } from "@/i18n/locale";
import { useAuth, type AuthSession } from "@/auth/session";

function maskPhone(phoneNumber: string | null | undefined) {
  if (!phoneNumber) return "—";
  if (phoneNumber.length < 8) return phoneNumber;
  return phoneNumber.slice(0, 3) + "••••" + phoneNumber.slice(-4);
}

function getDeviceLabel(userAgent: string | null, locale: Locale) {
  const value = (userAgent ?? "").toLowerCase();
  const zh = locale === "zh-CN";
  if (/ipad|iphone|ipod/.test(value)) return zh ? "Apple 设备" : "Apple device";
  if (value.includes("android")) return zh ? "Android 设备" : "Android device";
  if (value.includes("windows")) return zh ? "Windows 电脑" : "Windows computer";
  if (/macintosh|mac os/.test(value)) return zh ? "Mac 电脑" : "Mac computer";
  if (value.includes("linux")) return zh ? "Linux 设备" : "Linux device";
  if (/chrome|safari|firefox|edge/.test(value)) return zh ? "浏览器会话" : "Browser session";
  return zh ? "未知设备" : "Unknown device";
}

function formatSessionDate(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US");
}

export default function SettingsScreen() {
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const {
    status,
    isAuthenticated,
    isPreviewAccount,
    user,
    profile,
    signOut,
    updateProfile,
    loadSessions,
    revokeSession,
    revokeOtherSessions
  } = useAuth();

  const [showLogout, setShowLogout] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deviceSessions, setDeviceSessions] = useState<AuthSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionActionId, setSessionActionId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");

  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const changeLocale = (value: Locale) => setLocale(value);

  useEffect(() => {
    if (showEditName) setDraftName(profile?.displayName ?? user?.name ?? "");
  }, [showEditName, profile?.displayName, user?.name]);

  const saveName = async () => {
    const displayName = draftName.trim();
    if (!displayName || displayName.length > 40) {
      Alert.alert(t("提示", "Notice"), t("昵称长度需为 1 至 40 个字符。", "Nickname must be 1 to 40 characters."));
      return;
    }
    setSavingName(true);
    try {
      await updateProfile({ displayName });
      setShowEditName(false);
    } catch (error) {
      Alert.alert(t("保存失败", "Save failed"), error instanceof Error ? error.message : t("请稍后重试。", "Please try again."));
    } finally {
      setSavingName(false);
    }
  };

  const refreshSessions = async () => {
    setLoadingSessions(true);
    setSessionError("");
    setSessionNotice("");
    try {
      setDeviceSessions(await loadSessions());
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : t("无法读取设备会话。", "Unable to load device sessions."));
    } finally {
      setLoadingSessions(false);
    }
  };

  const openSessions = async () => {
    setShowSessions(true);
    await refreshSessions();
  };

  const handleRevokeSession = async (sessionId: string) => {
    setSessionActionId(sessionId);
    setSessionError("");
    setSessionNotice("");
    try {
      await revokeSession(sessionId);
      setDeviceSessions(await loadSessions());
      setSessionNotice(t("已退出所选设备。", "The selected device has been signed out."));
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : t("撤销设备会话失败。", "Could not revoke this session."));
    } finally {
      setSessionActionId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    setSessionError("");
    setSessionNotice("");
    try {
      const count = await revokeOtherSessions();
      setDeviceSessions(await loadSessions());
      setSessionNotice(
        locale === "zh-CN"
          ? \`已退出其他 \${count} 台设备。\`
          : \`Signed out \${count} other device(s).\`
      );
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : t("无法退出其他设备。", "Could not sign out other devices."));
    } finally {
      setRevokingOthers(false);
    }
  };

  const confirmLogout = async () => {
    try {
      await signOut();
      setShowLogout(false);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert(t("退出失败", "Sign out failed"), error instanceof Error ? error.message : t("请稍后重试。", "Please try again."));
    }
  };

  const otherSessionCount = deviceSessions.filter((item) => !item.isCurrent).length;

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("账户设置", "Account settings")}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.label}>{t("用户 ID", "User ID")}</Text>
          <Text selectable style={styles.value}>{isPreviewAccount ? t("本地预览账户", "Local preview") : user?.id ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("手机号", "Phone number")}</Text>
          <Text style={styles.value}>{isPreviewAccount ? "—" : maskPhone(user?.phoneNumber)}</Text>
        </View>
        <Pressable style={styles.row} onPress={() => isAuthenticated && !isPreviewAccount && setShowEditName(true)} disabled={!isAuthenticated || isPreviewAccount}>
          <Text style={styles.label}>{t("昵称", "Nickname")}</Text>
          <Text style={styles.value}>{isPreviewAccount ? t("预览数据", "Preview data") : profile?.displayName ?? user?.name ?? "—"}</Text>
        </Pressable>
        <View style={styles.row}>
          <Text style={styles.label}>{t("手机号验证", "Phone verification")}</Text>
          <Text style={styles.value}>
            {isPreviewAccount
              ? t("不适用", "Not applicable")
              : user?.phoneNumberVerified
                ? t("已验证", "Verified")
                : t("未验证 / 未登录", "Unverified / signed out")}
          </Text>
        </View>
        {isAuthenticated && !isPreviewAccount ? (
          <Pressable style={styles.row} onPress={openSessions}>
            <Text style={styles.label}>{t("登录设备", "Signed-in devices")}</Text>
            <Text style={styles.value}>{t("管理设备与会话", "Manage devices and sessions")} ›</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{t("偏好设置", "Preferences")}</Text>
        <View style={styles.row}><Text style={styles.label}>{t("语言", "Language")}</Text><View style={styles.languageOptions}>
          <Pressable onPress={() => changeLocale("zh-CN")}><Text style={[styles.language, locale === "zh-CN" && styles.languageActive]}>简体中文</Text></Pressable>
          <Text style={styles.separator}>/</Text>
          <Pressable onPress={() => changeLocale("en")}><Text style={[styles.language, locale === "en" && styles.languageActive]}>English</Text></Pressable>
        </View></View>
        <Pressable style={styles.row} onPress={() => router.push("/help")}><Text style={styles.label}>{t("帮助中心", "Help center")}</Text><Text style={styles.chevron}>›</Text></Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/help")}><Text style={styles.label}>{t("意见反馈", "Feedback")}</Text><Text style={styles.chevron}>›</Text></Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/help")}><Text style={styles.label}>{t("隐私说明", "Privacy")}</Text><Text style={styles.chevron}>›</Text></Pressable>
      </View>

      {isAuthenticated ? (
        <Pressable onPress={() => setShowLogout(true)} style={styles.logout}><Text style={styles.logoutText}>{t("退出登录", "Log out")}</Text></Pressable>
      ) : (
        <Pressable onPress={() => router.push("/login")} style={styles.logout}><Text style={styles.logoutText}>{t("登录账户", "Sign in")}</Text></Pressable>
      )}
      <Text style={styles.preview}>
        {isPreviewAccount
          ? t("当前为本地演示状态，不代表真实账户。", "This is a local preview state, not a real account.")
          : status === "unauthenticated" || status === "unconfigured"
            ? t("登录后将显示真实账户信息。", "Sign in to view your account information.")
            : t("账户身份与会话由 Better Auth 管理。", "Identity and sessions are managed by Better Auth.")}
      </Text>

      <Modal visible={showSessions} transparent animationType="fade" onRequestClose={() => setShowSessions(false)}>
        <View style={styles.scrim}>
          <View style={[styles.dialog, styles.sessionsDialog]}>
            <View style={styles.sessionsHeader}>
              <Text style={styles.dialogTitle}>{t("登录设备", "Signed-in devices")}</Text>
              <Pressable onPress={() => setShowSessions(false)} accessibilityRole="button" accessibilityLabel={t("关闭", "Close")}>
                <Text style={styles.closeGlyph}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.dialogCopy}>{t("这里只显示当前账户的设备会话。撤销其他设备不会影响当前设备。", "Only sessions for this account are shown. Revoking another device will not affect this device.")}</Text>
            {loadingSessions ? (
              <View style={styles.loadingState}><ActivityIndicator color="#555555" /><Text style={styles.sessionMeta}>{t("正在读取设备…", "Loading devices…")}</Text></View>
            ) : (
              <ScrollView style={styles.sessionList} contentContainerStyle={styles.sessionListContent}>
                {deviceSessions.length === 0 ? (
                  <Text style={styles.sessionMeta}>{t("暂无可显示的设备会话。", "No device sessions to display.")}</Text>
                ) : deviceSessions.map((item) => (
                  <View key={item.id} style={styles.sessionRow}>
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionTitle}>{getDeviceLabel(item.userAgent, locale)}</Text>
                      <Text style={styles.sessionMeta}>{t("登录时间", "Signed in")}: {formatSessionDate(item.createdAt, locale)}</Text>
                      <Text style={styles.sessionMeta}>{t("IP 地址", "IP address")}: {item.ipAddress || "—"}</Text>
                    </View>
                    {item.isCurrent ? (
                      <Text style={styles.currentSession}>{t("当前设备", "This device")}</Text>
                    ) : (
                      <Pressable
                        onPress={() => handleRevokeSession(item.id)}
                        disabled={sessionActionId === item.id || revokingOthers}
                        style={styles.revokeButton}
                      >
                        <Text style={styles.revokeText}>
                          {sessionActionId === item.id ? t("处理中", "Working") : t("退出", "Sign out")}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
            {sessionError ? <Text style={styles.sessionError}>{sessionError}</Text> : null}
            {sessionNotice ? <Text style={styles.sessionNotice}>{sessionNotice}</Text> : null}
            {otherSessionCount > 0 ? (
              <Pressable
                onPress={handleRevokeOthers}
                disabled={revokingOthers || Boolean(sessionActionId)}
                style={[styles.revokeOthersButton, (revokingOthers || Boolean(sessionActionId)) && styles.disabled]}
              >
                <Text style={styles.revokeOthersText}>
                  {revokingOthers ? t("处理中…", "Working…") : t("退出其他所有设备", "Sign out all other devices")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showEditName} transparent animationType="fade" onRequestClose={() => setShowEditName(false)}>
        <View style={styles.scrim}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t("修改昵称", "Update nickname")}</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              maxLength={40}
              editable={!savingName}
              placeholder={t("输入昵称", "Enter a nickname")}
              style={styles.nameInput}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => setShowEditName(false)} disabled={savingName} style={styles.dialogButton}><Text style={styles.dialogButtonText}>{t("取消", "Cancel")}</Text></Pressable>
              <Pressable onPress={saveName} disabled={savingName} style={[styles.dialogButton, styles.dialogPrimary]}>
                <Text style={[styles.dialogButtonText, styles.dialogPrimaryText]}>{savingName ? t("保存中", "Saving") : t("保存", "Save")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <View style={styles.scrim}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t("确认退出登录？", "Log out?")}</Text>
            <Text style={styles.dialogCopy}>
              {isPreviewAccount
                ? t("这只会结束本地预览状态。", "This only ends the local preview state.")
                : t("退出后需要再次使用手机号验证码登录。", "You will need your phone verification code to sign in again.")}
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={() => setShowLogout(false)} style={styles.dialogButton}><Text style={styles.dialogButtonText}>{t("取消", "Cancel")}</Text></Pressable>
              <Pressable onPress={confirmLogout} style={[styles.dialogButton, styles.dialogPrimary]}><Text style={[styles.dialogButtonText, styles.dialogPrimaryText]}>{t("确定", "Confirm")}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  back: { width: 28 }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600" },
  group: { borderBottomWidth: 1, borderColor: "#E0E0E0", paddingTop: 7, paddingBottom: 4 },
  groupTitle: { color: "#555555", fontSize: 9, fontWeight: "700", marginBottom: 4 },
  row: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#EEEEEE", gap: 12 },
  label: { color: "#555555", fontSize: 8 },
  value: { color: "#888888", fontSize: 8, maxWidth: "70%", textAlign: "right" },
  languageOptions: { flexDirection: "row", alignItems: "center", gap: 6 },
  language: { color: "#999999", fontSize: 8 }, languageActive: { color: "#333333", fontWeight: "700" }, separator: { color: "#CCCCCC", fontSize: 8 },
  chevron: { color: "#888888", fontSize: 17 },
  logout: { height: 34, borderWidth: 1, borderColor: "#BBBBBB", borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 22 },
  logoutText: { color: "#555555", fontSize: 9 },
  preview: { color: "#AAAAAA", fontSize: 7, textAlign: "center", marginTop: 12, lineHeight: 12 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center", padding: 28 },
  dialog: { width: "100%", maxWidth: 300, backgroundColor: "#FFFFFF", borderRadius: 8, padding: 19, alignItems: "center" },
  dialogTitle: { color: "#333333", fontSize: 12, fontWeight: "700" },
  dialogCopy: { color: "#777777", fontSize: 8, textAlign: "center", lineHeight: 13, marginTop: 9 },
  nameInput: { width: "100%", height: 38, borderWidth: 1, borderColor: "#DDDDDD", borderRadius: 4, marginTop: 13, paddingHorizontal: 10, color: "#333333", fontSize: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 15 },
  dialogButton: { minWidth: 78, height: 28, borderRadius: 16, borderWidth: 1, borderColor: "#AAAAAA", alignItems: "center", justifyContent: "center" },
  dialogPrimary: { backgroundColor: "#555555", borderColor: "#555555" },
  dialogButtonText: { color: "#555555", fontSize: 8 }, dialogPrimaryText: { color: "#FFFFFF" },
  sessionsDialog: { width: "100%", maxWidth: 340, maxHeight: "82%", alignItems: "stretch", paddingBottom: 16 },
  sessionsHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeGlyph: { color: "#666666", fontSize: 24, lineHeight: 24 },
  loadingState: { alignItems: "center", justifyContent: "center", paddingVertical: 26, gap: 8 },
  sessionList: { width: "100%", flexGrow: 0, marginTop: 12 },
  sessionListContent: { gap: 0 },
  sessionRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderColor: "#EEEEEE", paddingVertical: 11 },
  sessionCopy: { flex: 1, gap: 4 },
  sessionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" },
  sessionMeta: { color: "#999999", fontSize: 7, lineHeight: 11 },
  currentSession: { color: "#4D7A58", fontSize: 8, fontWeight: "600" },
  revokeButton: { borderWidth: 1, borderColor: "#C9C9C9", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  revokeText: { color: "#777777", fontSize: 8 },
  revokeOthersButton: { minHeight: 32, marginTop: 12, borderRadius: 17, backgroundColor: "#555555", alignItems: "center", justifyContent: "center" },
  revokeOthersText: { color: "#FFFFFF", fontSize: 8, fontWeight: "600" },
  sessionError: { color: "#A34B42", fontSize: 8, marginTop: 8, textAlign: "center" },
  sessionNotice: { color: "#4D7A58", fontSize: 8, marginTop: 8, textAlign: "center" },
  disabled: { opacity: 0.45 }
});
