import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function HelpScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const faqs = [
    [t("如何获得贡献力？", "How do I earn Contribution Power?"), t("参与社区阅读、讨论、活动及平台开放的任务，可按任务规则获得贡献记录。", "Read, discuss, join community events, and complete available missions under their published rules.")],
    [t("社区积分可以提现吗？", "Can I withdraw community points?"), t("社区积分是平台内部奖励单位，不代表现金或可提现资产。", "Community points are internal platform rewards, not cash or withdrawable assets.")],
    [t("为什么任务没有更新？", "Why hasn't a mission updated?"), t("当前版本为本地预览，任务服务尚未连接。", "This is a local preview; the live mission service is not connected.")],
    [t("如何保护我的个人信息？", "How is my personal information protected?"), t("BrightGlobe 应仅处理提供服务所必需的信息，并在正式产品中提供清晰的隐私说明。", "BrightGlobe should process only data required to provide its services and publish a clear privacy notice in production.")]
  ];
  return (
    <AppScreen>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable><Text style={styles.headerTitle}>{t("常见问题", "Help center")}</Text><View style={styles.back} /></View>
      {faqs.map(([question, answer]) => <View key={question} style={styles.card}><Text style={styles.question}>{question}</Text><Text style={styles.answer}>{answer}</Text></View>)}
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD", marginBottom: 7 },
  back: { width: 28 }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 }, headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#DDDDDD", borderRadius: 7, padding: 11, marginTop: 8, gap: 7 },
  question: { color: "#444444", fontSize: 9, fontWeight: "700" }, answer: { color: "#777777", fontSize: 8, lineHeight: 14 }
});