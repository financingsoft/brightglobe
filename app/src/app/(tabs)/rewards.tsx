import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

export default function RewardsScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const events = [
    { icon: "🏆", title: t("社区贡献榜", "Community ranking"), note: t("贡献力挑战赛", "Contribution challenge"), color: "#F6C9D5" },
    { icon: "💎", title: t("积分寻宝", "Point treasure hunt"), note: t("发现隐藏奖励", "Find hidden rewards"), color: "#D4C5F6" },
    { icon: "🎁", title: t("幸运抽奖", "Lucky draw"), note: t("参与活动赢好礼", "Join and win rewards"), color: "#F5D7A9" }
  ];

  const goods = [
    { icon: "🎧", title: t("精选会员礼包", "Member bundle"), note: t("社区专属权益", "Community privileges"), points: "800" },
    { icon: "📚", title: t("学习资源合集", "Learning collection"), note: t("精选内容与课程", "Curated content and courses"), points: "500" },
    { icon: "🎮", title: t("游戏体验礼包", "Game experience pack"), note: t("社区合作内容", "Community partner content"), points: "1,200" },
    { icon: "🎟", title: t("线上活动门票", "Online event pass"), note: t("优先参与活动", "Priority event access"), points: "600" }
  ];

  return (
    <AppScreen>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t("玩转积分", "Play with points")}</Text>
        <Pressable onPress={() => router.push("/wallet")} style={styles.pointsButton}>
          <Text style={styles.pointsButtonIcon}>◆</Text>
          <Text style={styles.pointsButtonText}>2,480</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push("/tasks")} style={styles.promoBanner}>
        <View style={styles.promoGlow} />
        <Text style={styles.promoKicker}>BRIGHTGLOBE SPECIAL</Text>
        <Text style={styles.promoTitle}>{t("让每一份贡献都有回馈", "Rewards for every contribution")}</Text>
        <Text style={styles.promoText}>{t("参与活动、积累积分，解锁社区专属体验", "Join activities, earn points, and unlock community experiences")}</Text>
        <View style={styles.promoButton}>
          <Text style={styles.promoButtonText}>{t("立即参与", "Explore now")} ›</Text>
        </View>
        <Text style={styles.promoGem}>◆</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("积分活动", "Point activities")}</Text>
        <Text style={styles.sectionMore}>{t("更多", "More")} ›</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRail}>
        {events.map((event) => (
          <Pressable key={event.title} onPress={() => router.push("/tasks")} style={styles.eventCard}>
            <View style={[styles.eventArt, { backgroundColor: event.color }]}>
              <Text style={styles.eventArtIcon}>{event.icon}</Text>
            </View>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventNote}>{event.note}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("星球集市", "Planet marketplace")}</Text>
        <Text style={styles.sectionMore}>{t("全部", "All")} ›</Text>
      </View>
      <View style={styles.marketGrid}>
        {goods.map((good, index) => (
          <Pressable
            key={good.title}
            onPress={() => router.push("/wallet")}
            style={styles.goodsCard}
          >
            <View style={[styles.goodsArt, index % 2 === 0 ? styles.goodsArtPurple : styles.goodsArtGold]}>
              <Text style={styles.goodsIcon}>{good.icon}</Text>
            </View>
            <Text style={styles.goodsTitle}>{good.title}</Text>
            <Text style={styles.goodsNote}>{good.note}</Text>
            <View style={styles.goodsBottom}>
              <Text style={styles.goodsPoints}>{good.points} {t("积分", "pts")}</Text>
              <Text style={styles.goodsArrow}>›</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.disclaimer}>{t("当前展示为预览权益，具体兑换规则以 BrightGlobe 平台正式规则为准。", "Preview catalog. Eligibility and redemption depend on BrightGlobe platform rules.")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pageTitle: { color: "#302A37", fontSize: 20, fontWeight: "900" },
  pointsButton: { minHeight: 30, borderRadius: 18, borderWidth: 1, borderColor: "#E6DDED", backgroundColor: "#FBF8FD", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 5 },
  pointsButtonIcon: { color: colors.brand, fontSize: 10 },
  pointsButtonText: { color: "#6B3F8A", fontSize: 10, fontWeight: "900" },
  promoBanner: { height: 154, borderRadius: 12, backgroundColor: "#351447", overflow: "hidden", padding: 15, justifyContent: "space-between" },
  promoGlow: { position: "absolute", right: -15, top: -50, width: 185, height: 185, borderRadius: 92, backgroundColor: "rgba(183,89,224,0.25)" },
  promoKicker: { color: "#D1A9E5", fontSize: 7, fontWeight: "900", letterSpacing: 1.5 },
  promoTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", maxWidth: "78%" },
  promoText: { color: "#D9C3E7", fontSize: 9, lineHeight: 14, maxWidth: "78%" },
  promoButton: { backgroundColor: "#FFFFFF", borderRadius: 13, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6 },
  promoButtonText: { color: "#643184", fontSize: 8, fontWeight: "900" },
  promoGem: { position: "absolute", right: 21, top: 48, color: "rgba(241,207,255,0.25)", fontSize: 67 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 1 },
  sectionTitle: { color: "#413A47", fontSize: 13, fontWeight: "900" },
  sectionMore: { color: colors.brand, fontSize: 9, fontWeight: "800" },
  eventRail: { gap: 9, paddingBottom: 1 },
  eventCard: { width: 112, borderWidth: 1, borderColor: "#EEE9F1", borderRadius: 9, overflow: "hidden", backgroundColor: "#FFFFFF", paddingBottom: 9 },
  eventArt: { height: 76, alignItems: "center", justifyContent: "center" },
  eventArtIcon: { fontSize: 31 },
  eventTitle: { color: "#39333F", fontSize: 9, fontWeight: "900", marginHorizontal: 8, marginTop: 8 },
  eventNote: { color: "#9B95A0", fontSize: 7, marginHorizontal: 8, marginTop: 3 },
  marketGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  goodsCard: { width: "48%", flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderColor: "#ECE8EF", borderRadius: 9, overflow: "hidden", backgroundColor: "#FFFFFF", paddingBottom: 8 },
  goodsArt: { height: 98, alignItems: "center", justifyContent: "center" },
  goodsArtPurple: { backgroundColor: "#F1E7F8" },
  goodsArtGold: { backgroundColor: "#FFF2DB" },
  goodsIcon: { fontSize: 37 },
  goodsTitle: { color: "#36313B", fontSize: 10, fontWeight: "900", marginHorizontal: 9, marginTop: 8 },
  goodsNote: { color: "#9D97A2", fontSize: 8, marginHorizontal: 9, marginTop: 3 },
  goodsBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 9, marginTop: 8 },
  goodsPoints: { color: colors.brand, fontSize: 9, fontWeight: "900" },
  goodsArrow: { color: "#AAA3AF", fontSize: 18 },
  disclaimer: { color: "#AAA4AF", fontSize: 8, lineHeight: 13, marginTop: -4 }
});
