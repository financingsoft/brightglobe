import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function RewardsScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const events = [
    { icon: "✦", title: t("联赛竞猜", "Tournament picks"), note: t("参与赛事赢取奖励", "Join the challenge"), tone: "#7B47B5" },
    { icon: "◇", title: t("黑钻挖宝", "Point treasure hunt"), note: t("探索隐藏惊喜", "Find hidden rewards"), tone: "#D35C79" },
    { icon: "★", title: t("幸运抽奖", "Lucky draw"), note: t("参与活动赢好礼", "Join and win"), tone: "#D28A42" }
  ];
  const goods = [
    { icon: "◈", title: t("智能乐器", "Smart instrument"), note: t("星球精选商品", "Featured item") },
    { icon: "◉", title: t("运动相机", "Action camera"), note: t("限时兑换活动", "Limited offer") },
    { icon: "▣", title: t("精选会员权益", "Member benefits"), note: t("社区专属权益", "Member-only benefits") },
    { icon: "◇", title: t("学习礼包", "Learning bundle"), note: t("内容与课程资源", "Learning resources") }
  ];
  return (
    <AppScreen>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
          <Text style={styles.headerTitle}>{t("玩转黑钻", "Black Diamond activities")}</Text>
          <Pressable onPress={() => router.push("/wallet")} style={styles.balance}><Text style={styles.balanceText}>♢ 122.90001</Text></Pressable>
        </View>

        <Pressable onPress={() => router.push("/activity")} style={styles.hero}>
          <Text style={styles.heroKicker}>BRIGHTGLOBE EVENT</Text>
          <Text style={styles.heroTitle}>{t("精彩活动  等你参与", "Special events are waiting")}</Text>
          <Text style={styles.heroSubtitle}>{t("社区活动与专属权益", "Community events and member benefits")}</Text>
          <Text style={styles.heroAction}>{t("立即查看", "Explore now")} ›</Text>
          <Text style={styles.heroArt}>✦</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("黑钻活动", "Point activities")}</Text>
          <Text style={styles.sectionMore}>{t("更多", "More")} ›</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRail}>
          {events.map((event) => (
            <Pressable key={event.title} onPress={() => router.push({ pathname: "/activity", params: { title: event.title } })} style={styles.eventCard}>
              <View style={[styles.eventArt, { backgroundColor: event.tone }]}><Text style={styles.eventIcon}>{event.icon}</Text></View>
              <View style={styles.eventCopy}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventNote}>{event.note}</Text></View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("星球集市", "Community marketplace")}</Text>
          <Text style={styles.sectionMore}>{t("全部", "All")} ›</Text>
        </View>
        <View style={styles.marketGrid}>
          {goods.map((good, index) => (
            <Pressable key={good.title} onPress={() => router.push({ pathname: "/activity", params: { title: good.title } })} style={styles.goodCard}>
              <View style={[styles.goodArt, index % 2 === 0 ? styles.goodArtPurple : styles.goodArtOrange]}><Text style={styles.goodIcon}>{good.icon}</Text></View>
              <Text style={styles.goodTitle}>{good.title}</Text>
              <Text style={styles.goodNote}>{good.note}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.preview}>{t("活动和商品为视觉结构预览，尚未接入真实兑换与交易服务。", "Activities and goods are visual previews; redemption and transaction services are not connected.")}</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { marginHorizontal: -12, marginTop: -5, padding: 12, minHeight: 780, backgroundColor: "#21132F" },
  header: { height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  back: { width: 25 }, backGlyph: { color: "#FFFFFF", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  balance: { borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 8, paddingVertical: 5 },
  balanceText: { color: "#FFFFFF", fontSize: 7, fontWeight: "600" },
  hero: { height: 104, backgroundColor: "#E84C4C", borderRadius: 4, padding: 12, justifyContent: "center", overflow: "hidden", gap: 4 },
  heroKicker: { color: "#FFD8D8", fontSize: 6, letterSpacing: 1.1, fontWeight: "700" },
  heroTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  heroSubtitle: { color: "#FFE4E4", fontSize: 8 },
  heroAction: { color: "#FFFFFF", fontSize: 8, fontWeight: "700", marginTop: 2 },
  heroArt: { position: "absolute", right: 22, top: 3, color: "rgba(255,255,255,0.24)", fontSize: 70 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 15, marginBottom: 8 },
  sectionTitle: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  sectionMore: { color: "#C7B4D7", fontSize: 7 },
  eventRail: { gap: 7 },
  eventCard: { width: 105, backgroundColor: "#38264A", borderRadius: 4, overflow: "hidden" },
  eventArt: { height: 70, alignItems: "center", justifyContent: "center" },
  eventIcon: { color: "#FFFFFF", fontSize: 32 },
  eventCopy: { padding: 7, gap: 4 },
  eventTitle: { color: "#FFFFFF", fontSize: 8, fontWeight: "700" },
  eventNote: { color: "#C8BDCF", fontSize: 6 },
  marketGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  goodCard: { width: "48%", flexGrow: 1, flexBasis: "45%", backgroundColor: "#38264A", borderRadius: 4, overflow: "hidden", paddingBottom: 7 },
  goodArt: { height: 80, alignItems: "center", justifyContent: "center" },
  goodArtPurple: { backgroundColor: "#5A3976" },
  goodArtOrange: { backgroundColor: "#80513D" },
  goodIcon: { color: "rgba(255,255,255,0.85)", fontSize: 38 },
  goodTitle: { color: "#FFFFFF", fontSize: 8, fontWeight: "700", marginHorizontal: 8, marginTop: 7 },
  goodNote: { color: "#C7B8D2", fontSize: 6, marginHorizontal: 8, marginTop: 3 },
  preview: { color: "#B6A6C4", fontSize: 7, lineHeight: 11, marginTop: 12 }
});