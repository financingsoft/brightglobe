import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function AnnouncementsScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const items = [
    { title: t("BrightGlobe 社区共建公告", "BrightGlobe community announcement"), body: t("欢迎参与社区建设，分享你的建议与想法。", "Take part in building the community and share your feedback."), date: "2026.11.13" },
    { title: t("贡献任务规则更新", "Contribution mission rules updated"), body: t("部分任务说明与奖励状态已更新。", "Some mission descriptions and reward states have been updated."), date: "2026.11.10" },
    { title: t("社区活动预告", "Community event preview"), body: t("新一轮社区活动即将开放。", "A new round of community activities will open soon."), date: "2026.11.05" }
  ];
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("星球公告", "Community announcements")}</Text>
        <View style={styles.back} />
      </View>
      {items.map((item) => (
        <Pressable key={item.title} onPress={() => router.push({ pathname: "/activity", params: { title: item.title } })} style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <View style={styles.footer}><Text style={styles.date}>{item.date}</Text><Text style={styles.more}>{t("立即查看", "View now")} ›</Text></View>
        </Pressable>
      ))}
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD", marginBottom: 7 },
  back: { width: 28 }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#DADADA", borderRadius: 7, padding: 12, marginTop: 8, gap: 7 },
  title: { color: "#333333", fontSize: 10, fontWeight: "700" },
  body: { color: "#777777", fontSize: 8, lineHeight: 13 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { color: "#999999", fontSize: 7 },
  more: { color: "#555555", fontSize: 8 }
});