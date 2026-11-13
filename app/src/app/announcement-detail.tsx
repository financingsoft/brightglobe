import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function AnnouncementDetailScreen() {
  const { title, body, date } = useLocalSearchParams<{ title?: string; body?: string; date?: string }>();
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const pageTitle = typeof title === "string" ? title : t("星球公告", "Community announcement");
  const pageBody = typeof body === "string" ? body : t("欢迎参与社区建设，分享你的建议与想法。", "Take part in building the community and share your feedback.");
  const pageDate = typeof date === "string" ? date : "2026.11.13";

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerAction}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{t("公告详情", "Announcement")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} style={styles.headerAction}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>
      <View style={styles.article}>
        <Text style={styles.title}>{pageTitle}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.brand}>BrightGlobe</Text>
          <Text style={styles.date}>{pageDate}</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.body}>{pageBody}</Text>
        <Text style={styles.body}>{t("BrightGlobe 致力于建设开放、友好、可信赖的全球贡献者社区。感谢每一位成员参与讨论、分享知识并帮助社区持续成长。", "BrightGlobe is building an open, welcoming, and trusted global contributor community. Thank you to every member who discusses, shares knowledge, and helps the community grow.")}</Text>
      </View>
      <Text style={styles.preview}>{t("公告内容为预览数据，正式公告服务尚未连接。", "Preview announcement content; the live announcement service is not connected.")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", marginBottom: 10 },
  headerAction: { width: 28, height: 32, justifyContent: "center" },
  backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  closeGlyph: { color: "#C9D9F2", fontSize: 24, lineHeight: 27, textAlign: "right" },
  headerTitle: { flex: 1, color: "#EAF2FF", fontSize: 13, fontWeight: "700", textAlign: "center" },
  article: { paddingHorizontal: 2, paddingTop: 11, gap: 12 },
  title: { color: "#EAF2FF", fontSize: 16, lineHeight: 23, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#A0B2D0", fontSize: 8 },
  date: { color: "#8A9DBD", fontSize: 8 },
  divider: { height: 1, backgroundColor: "#E5E5E5" },
  body: { color: "#B8C9E4", fontSize: 10, lineHeight: 18 },
  preview: { color: "#788CAB", fontSize: 7, lineHeight: 12, marginTop: 18, textAlign: "center" }
});
