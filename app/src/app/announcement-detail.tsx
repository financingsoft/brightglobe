import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { getAnnouncement, type AnnouncementDetail } from "@/services/community";

export default function AnnouncementDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const [item, setItem] = useState<AnnouncementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!slug || typeof slug !== "string") {
      setError(t("公告链接无效。", "Invalid announcement link."));
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    getAnnouncement(slug).then((result) => {
      if (active) setItem(result.item);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : t("公告暂时无法读取。", "Unable to load this announcement."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, locale]);

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerAction}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{t("公告详情", "Announcement")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} style={styles.headerAction}><Text style={styles.closeGlyph}>×</Text></Pressable>
      </View>
      {loading ? <ActivityIndicator color="#C9B7F0" style={styles.state} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {item ? <View style={styles.article}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.metaRow}><Text style={styles.brand}>BrightGlobe</Text><Text style={styles.date}>{item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "—"}</Text></View>
        <View style={styles.divider} />
        <Text style={styles.body}>{item.body}</Text>
      </View> : null}
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
  brand: { color: "#A0B2D0", fontSize: 8 }, date: { color: "#8A9DBD", fontSize: 8 },
  divider: { height: 1, backgroundColor: "rgba(156, 183, 224, 0.23)" },
  body: { color: "#B8C9E4", fontSize: 10, lineHeight: 18 },
  state: { marginTop: 24 }, error: { color: "#F0A5A5", fontSize: 9, lineHeight: 14, marginTop: 18, textAlign: "center" }
});
