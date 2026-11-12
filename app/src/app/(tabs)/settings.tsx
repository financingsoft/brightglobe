import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n, type Locale } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

export default function SettingsScreen() {
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const changeLocale = (value: Locale) => setLocale(value);
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("账户设置", "Account settings")}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.group}>
        <View style={styles.row}><Text style={styles.label}>{t("当前账户", "Account")}</Text><Text style={styles.value}>BG-00828</Text></View>
        <View style={styles.row}><Text style={styles.label}>{t("昵称", "Nickname")}</Text><Text style={styles.value}>{t("BrightGlobe 用户", "BrightGlobe Member")}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{t("会员类型", "Member type")}</Text><Text style={styles.value}>{t("探索者", "Explorer")}</Text></View>
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
      <Pressable onPress={() => setShowLogout(true)} style={styles.logout}><Text style={styles.logoutText}>{t("退出登录", "Log out")}</Text></Pressable>
      <Text style={styles.preview}>{t("账户服务尚未连接，当前为本地预览。", "Account service is not connected; this is a local preview.")}</Text>
      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <View style={styles.scrim}><View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{t("确认退出登录？", "Log out?")}</Text>
          <Text style={styles.dialogCopy}>{t("当前只是演示页面，不会执行真实账户退出。", "This is a preview; no live account session will be ended.")}</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => setShowLogout(false)} style={styles.dialogButton}><Text style={styles.dialogButtonText}>{t("取消", "Cancel")}</Text></Pressable>
            <Pressable onPress={() => { setShowLogout(false); signOutPreviewAccount(); router.replace("/(tabs)"); }} style={[styles.dialogButton, styles.dialogPrimary]}><Text style={[styles.dialogButtonText, styles.dialogPrimaryText]}>{t("确定", "Confirm")}</Text></Pressable>
          </View>
        </View></View>
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
  row: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#EEEEEE" },
  label: { color: "#555555", fontSize: 8 }, value: { color: "#888888", fontSize: 8 },
  languageOptions: { flexDirection: "row", alignItems: "center", gap: 6 },
  language: { color: "#999999", fontSize: 8 }, languageActive: { color: "#333333", fontWeight: "700" }, separator: { color: "#CCCCCC", fontSize: 8 },
  chevron: { color: "#888888", fontSize: 17 },
  logout: { height: 34, borderWidth: 1, borderColor: "#BBBBBB", borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 22 },
  logoutText: { color: "#555555", fontSize: 9 }, preview: { color: "#AAAAAA", fontSize: 7, textAlign: "center", marginTop: 12 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center", padding: 28 },
  dialog: { width: "100%", maxWidth: 300, backgroundColor: "#FFFFFF", borderRadius: 8, padding: 19, alignItems: "center" },
  dialogTitle: { color: "#333333", fontSize: 12, fontWeight: "700" }, dialogCopy: { color: "#777777", fontSize: 8, textAlign: "center", lineHeight: 13, marginTop: 9 },
  actions: { flexDirection: "row", gap: 10, marginTop: 15 }, dialogButton: { minWidth: 78, height: 28, borderRadius: 16, borderWidth: 1, borderColor: "#AAAAAA", alignItems: "center", justifyContent: "center" },
  dialogPrimary: { backgroundColor: "#555555", borderColor: "#555555" }, dialogButtonText: { color: "#555555", fontSize: 8 }, dialogPrimaryText: { color: "#FFFFFF" }
});