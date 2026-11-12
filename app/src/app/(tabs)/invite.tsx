import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function InviteScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("邀请码", "Invitation code")}</Text>
        <View style={styles.back} />
      </View>
      <Text style={styles.pageTitle}>{t("邀请好友加入 BrightGlobe", "Invite friends to BrightGlobe")}</Text>
      <Text style={styles.subtitle}>{t("邀请好友一起参与社区共建，解锁更多贡献机会。", "Invite friends to build the community and discover more ways to contribute.")}</Text>
      <View style={styles.codeCard}>
        <Text style={styles.label}>{t("我的邀请码", "My invitation code")}</Text>
        <Text style={styles.code}>BG828</Text>
        <Pressable onPress={() => {}} style={styles.copyButton}><Text style={styles.copyText}>{t("复制邀请码", "Copy code")}</Text></Pressable>
        <View style={styles.qrBox}>
          <View style={styles.qrPattern}><Text style={styles.qrText}>▦ ▣ ▦</Text><Text style={styles.qrText}>▣ ▦ ▣</Text><Text style={styles.qrText}>▦ ▣ ▦</Text></View>
        </View>
        <Text style={styles.qrCaption}>{t("扫码或复制邀请码，邀请朋友加入", "Scan or copy the code to invite a friend")}</Text>
      </View>
      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>{t("奖励规则", "Invitation rules")}</Text>
        <Text style={styles.ruleText}>{t("1. 好友通过你的邀请码加入 BrightGlobe。", "1. A friend joins BrightGlobe with your invitation code.")}</Text>
        <Text style={styles.ruleText}>{t("2. 好友完成指定的新手任务后，邀请奖励进入待确认状态。", "2. The invitation reward becomes pending after the required onboarding activity.")}</Text>
        <Text style={styles.ruleText}>{t("3. 奖励以平台公布的活动规则为准。", "3. Rewards follow the published campaign rules.")}</Text>
      </View>
      <Text style={styles.preview}>{t("邀请码与二维码为演示内容，复制和邀请服务尚未接入。", "Demo invitation code and QR placeholder; sharing is not connected.")}</Text>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  back: { width: 28 }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600" },
  pageTitle: { color: "#333333", fontSize: 14, fontWeight: "700", marginTop: 17, textAlign: "center" },
  subtitle: { color: "#888888", fontSize: 8, lineHeight: 13, textAlign: "center", marginTop: 7, marginHorizontal: 12 },
  codeCard: { borderWidth: 1, borderColor: "#DDDDDD", borderRadius: 7, padding: 14, alignItems: "center", marginTop: 15 },
  label: { color: "#777777", fontSize: 8 },
  code: { color: "#333333", fontSize: 21, fontWeight: "700", letterSpacing: 3, marginTop: 6 },
  copyButton: { height: 26, minWidth: 88, borderRadius: 14, borderWidth: 1, borderColor: "#AAAAAA", justifyContent: "center", alignItems: "center", marginTop: 8 },
  copyText: { color: "#555555", fontSize: 8 },
  qrBox: { width: 90, height: 90, borderWidth: 1, borderColor: "#E0E0E0", justifyContent: "center", alignItems: "center", marginTop: 14 },
  qrPattern: { gap: 4 }, qrText: { color: "#333333", fontSize: 17, letterSpacing: 3, lineHeight: 19 },
  qrCaption: { color: "#888888", fontSize: 7, marginTop: 6 },
  rules: { borderWidth: 1, borderColor: "#DDDDDD", borderRadius: 7, padding: 12, marginTop: 12, gap: 7 },
  rulesTitle: { color: "#444444", fontSize: 9, fontWeight: "700" },
  ruleText: { color: "#777777", fontSize: 8, lineHeight: 13 },
  preview: { color: "#AAAAAA", fontSize: 7, textAlign: "center", marginTop: 12 }
});