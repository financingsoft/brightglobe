import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import { getAnnouncements, getCommunityEvents, type Announcement, type CommunityEvent } from "@/services/community";

export default function AnnouncementsScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const [items, setItems] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!isAuthenticated) { setItems([]); setEvents([]); return () => { active = false; }; }
    setLoading(true);
    setError(null);
    Promise.all([getAnnouncements(), getCommunityEvents()]).then(([news, activities]) => {
      if (!active) return;
      setItems(news.items);
      setEvents(activities.items);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : t("暂时无法加载内容", "Unable to load community content"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAuthenticated, locale]));

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("星球公告", "Community updates")}</Text>
        <View style={styles.back} />
      </View>
      {loading ? <ActivityIndicator color="#C9B7F0" style={styles.state} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && items.length === 0 && events.length === 0 ? <Text style={styles.empty}>{t("暂无已发布的公告或活动。", "No published announcements or events yet.")}</Text> : null}
      {items.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/announcement-detail", params: { slug: item.slug } })} style={styles.card}>
          <Text style={styles.kind}>{t("公告", "ANNOUNCEMENT")}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.summary}</Text>
          <View style={styles.footer}><Text style={styles.date}>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "—"}</Text><Text style={styles.more}>{t("查看详情", "Read more")} ›</Text></View>
        </Pressable>
      ))}
      {events.map((event) => (
        <View key={event.id} style={styles.card}>
          <Text style={styles.kind}>{t("社区活动", "COMMUNITY EVENT")}</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.body}>{event.summary}</Text>
          <Text style={styles.date}>{event.startsAt ? new Date(event.startsAt).toLocaleString() : t("时间待定", "Date to be announced")}</Text>
        </View>
      ))}
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", marginBottom: 7 },
  back: { width: 28 }, backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", borderRadius: 7, padding: 12, marginTop: 8, gap: 7 },
  kind: { color: "#A98BE0", fontSize: 7, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#EAF2FF", fontSize: 11, fontWeight: "700" },
  body: { color: "#A0B2D0", fontSize: 9, lineHeight: 14 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { color: "#8A9DBD", fontSize: 8 }, more: { color: "#C9D9F2", fontSize: 8 },
  state: { marginTop: 22 }, empty: { color: "#96A9C8", fontSize: 10, textAlign: "center", marginTop: 30 },
  error: { color: "#F0A5A5", fontSize: 9, textAlign: "center", marginTop: 18 }
});
