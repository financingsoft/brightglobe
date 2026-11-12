import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  AppScreen,
  PageHeading,
  Panel,
  Pill,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

export default function RewardsScreen() {
  const { locale, t } = useI18n();
  const router = useRouter();

  const benefits = [
    { icon: "✦", title: t("rewardOne"), description: t("rewardOneDesc"), tag: locale === "zh-CN" ? "创作者" : "CREATOR" },
    { icon: "▤", title: t("rewardTwo"), description: t("rewardTwoDesc"), tag: locale === "zh-CN" ? "学习" : "LEARNING" },
    { icon: "◉", title: t("rewardThree"), description: t("rewardThreeDesc"), tag: locale === "zh-CN" ? "活动" : "EVENTS" }
  ];

  return (
    <AppScreen>
      <PageHeading
        eyebrow={t("navBenefits").toUpperCase()}
        title={t("rewardsTitle")}
        subtitle={t("rewardsSubtitle")}
      />

      <View style={styles.eventHero}>
        <View style={styles.eventGlowOne} />
        <View style={styles.eventGlowTwo} />
        <View style={styles.eventBadge}>
          <Text style={styles.eventBadgeText}>{t("eventOfWeek")}</Text>
        </View>
        <Text style={styles.eventKicker}>BRIGHTGLOBE COMMUNITY</Text>
        <Text style={styles.eventTitle}>{t("eventTitle")}</Text>
        <Text style={styles.eventDescription}>{t("eventDescription")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/tasks")}
          style={({ pressed }) => [styles.eventButton, pressed && styles.pressed]}
        >
          <Text style={styles.eventButtonText}>{t("joinEvent")}  ›</Text>
        </Pressable>
        <Text style={styles.eventPlanet}>✧</Text>
      </View>

      <View style={styles.balanceStrip}>
        <View style={styles.balanceIcon}>
          <Text style={styles.balanceGlyph}>◆</Text>
        </View>
        <View style={styles.balanceCopy}>
          <Text style={styles.balanceLabel}>{t("availableBalance")}</Text>
          <Text style={styles.balanceValue}>2,480 <Text style={styles.balanceUnit}>{t("points")}</Text></Text>
        </View>
        <Pill label={t("preview")} tone="gold" />
      </View>

      <SectionHeading title={t("marketplace")} action={t("viewAll")} />
      <View style={styles.categoryGrid}>
        <View style={styles.categoryCard}>
          <Text style={styles.categoryIcon}>♧</Text>
          <Text style={styles.categoryTitle}>{locale === "zh-CN" ? "精选内容" : "Curated content"}</Text>
          <Text style={styles.categorySub}>{locale === "zh-CN" ? "发现优质资源" : "Discover resources"}</Text>
        </View>
        <View style={[styles.categoryCard, styles.categoryCardGold]}>
          <Text style={styles.categoryIcon}>♢</Text>
          <Text style={styles.categoryTitle}>{locale === "zh-CN" ? "会员权益" : "Member perks"}</Text>
          <Text style={styles.categorySub}>{locale === "zh-CN" ? "社区专属福利" : "Community benefits"}</Text>
        </View>
        <View style={[styles.categoryCard, styles.categoryCardBlue]}>
          <Text style={styles.categoryIcon}>◎</Text>
          <Text style={styles.categoryTitle}>{locale === "zh-CN" ? "线上活动" : "Online events"}</Text>
          <Text style={styles.categorySub}>{locale === "zh-CN" ? "与全球成员交流" : "Meet the community"}</Text>
        </View>
        <View style={[styles.categoryCard, styles.categoryCardTeal]}>
          <Text style={styles.categoryIcon}>✎</Text>
          <Text style={styles.categoryTitle}>{locale === "zh-CN" ? "创作者计划" : "Creator program"}</Text>
          <Text style={styles.categorySub}>{locale === "zh-CN" ? "展示你的作品" : "Showcase your work"}</Text>
        </View>
      </View>

      <SectionHeading title={t("rewardFeatured")} />
      {benefits.map((benefit, index) => (
        <Panel key={benefit.title} style={styles.benefitCard}>
          <View style={[styles.benefitArt, index === 1 && styles.benefitArtGold, index === 2 && styles.benefitArtTeal]}>
            <Text style={styles.benefitGlyph}>{benefit.icon}</Text>
          </View>
          <View style={styles.benefitCopy}>
            <Text style={styles.benefitTag}>{benefit.tag}</Text>
            <Text style={styles.benefitTitle}>{benefit.title}</Text>
            <Text style={styles.benefitDescription}>{benefit.description}</Text>
            <Text style={styles.benefitCost}>{index === 0 ? "500" : index === 1 ? "800" : "1,200"} {t("points")}</Text>
          </View>
          <Text style={styles.benefitArrow}>›</Text>
        </Panel>
      ))}

      <Text style={styles.disclaimer}>{t("redemptionNote")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  eventHero: {
    minHeight: 215,
    borderRadius: 23,
    padding: 19,
    overflow: "hidden",
    backgroundColor: "#261040",
    justifyContent: "space-between",
    gap: 9
  },
  eventGlowOne: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(155,75,224,0.32)", right: -25, top: -44 },
  eventGlowTwo: { position: "absolute", width: 115, height: 115, borderRadius: 58, backgroundColor: "rgba(218,72,191,0.18)", right: 85, bottom: -50 },
  eventBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.13)" },
  eventBadgeText: { color: "#F3DFFF", fontSize: 9, fontWeight: "900" },
  eventKicker: { color: "#C9A2F3", fontSize: 8, fontWeight: "900", letterSpacing: 1.5, marginTop: 4 },
  eventTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 27, fontWeight: "900", maxWidth: "76%" },
  eventDescription: { color: "#DAC7EA", fontSize: 10, lineHeight: 15, maxWidth: "80%" },
  eventButton: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  eventButtonText: { color: colors.brandDark, fontSize: 10, fontWeight: "900" },
  eventPlanet: { position: "absolute", right: 18, top: 67, color: "rgba(239,210,255,0.72)", fontSize: 58 },
  balanceStrip: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 17, minHeight: 79, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  balanceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" },
  balanceGlyph: { color: "#B97916", fontSize: 18, fontWeight: "900" },
  balanceCopy: { flex: 1, gap: 3 },
  balanceLabel: { color: colors.inkMuted, fontSize: 9, fontWeight: "800" },
  balanceValue: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  balanceUnit: { color: colors.inkMuted, fontSize: 9, fontWeight: "700" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  categoryCard: { width: "48%", flexGrow: 1, flexBasis: "45%", minHeight: 111, borderRadius: 17, backgroundColor: "#F1E8FF", padding: 13, justifyContent: "space-between" },
  categoryCardGold: { backgroundColor: "#FFF3DD" },
  categoryCardBlue: { backgroundColor: "#E9F0FF" },
  categoryCardTeal: { backgroundColor: "#E3F7F2" },
  categoryIcon: { color: colors.brand, fontSize: 23, fontWeight: "900" },
  categoryTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  categorySub: { color: colors.inkMuted, fontSize: 8, fontWeight: "600" },
  benefitCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  benefitArt: { width: 62, height: 66, borderRadius: 15, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  benefitArtGold: { backgroundColor: colors.goldSoft },
  benefitArtTeal: { backgroundColor: colors.tealSoft },
  benefitGlyph: { color: colors.brand, fontSize: 25, fontWeight: "900" },
  benefitCopy: { flex: 1, gap: 4 },
  benefitTag: { color: colors.brand, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  benefitTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  benefitDescription: { color: colors.inkMuted, fontSize: 9, lineHeight: 14 },
  benefitCost: { color: "#A66A15", fontSize: 9, fontWeight: "900", marginTop: 2 },
  benefitArrow: { color: "#B5A8C2", fontSize: 24 },
  disclaimer: { color: colors.inkMuted, fontSize: 9, lineHeight: 15 },
  pressed: { opacity: 0.82 }
});
