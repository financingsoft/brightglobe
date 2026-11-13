import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function PassportScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("数据护照", "Contribution profile")}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.passport}>
        <Text style={styles.brand}>{t("BRIGHTGLOBE 社区档案", "BRIGHTGLOBE COMMUNITY PROFILE")}</Text>
        <Text style={styles.name}>{t("BrightGlobe 用户", "BrightGlobe Member")}</Text>
        <Text style={styles.memberNo}>ID: BG-00828</Text>
        <View style={styles.passportDivider} />
        <View style={styles.stats}><Text style={styles.statLabel}>{t("贡献等级", "Contribution level")}</Text><Text style={styles.statValue}>{t("探索者", "Explorer")}</Text></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("数据分析", "Participation analysis")}</Text>
        <Text style={styles.explain}>{t("以下为用户主动参与社区所产生的预览统计，不代表外部数据追踪。", "Preview statistics from voluntary community participation; no external tracking is represented.")}</Text>
        <View style={styles.analysis}>
          {[[t("浏览参与", "Reading"), "72"], [t("社区互动", "Interaction"), "58"], [t("学习参与", "Learning"), "46"], [t("活动参与", "Events"), "39"]].map(([label, value]) => (
            <View key={label} style={styles.analysisRow}><Text style={styles.analysisLabel}>{label}</Text><View style={styles.track}><View style={[styles.fill, { width: value + "%" }]} /></View><Text style={styles.analysisValue}>{value}</Text></View>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("我的权益", "My benefits")}</Text>
        <View style={styles.benefitRow}><Text style={styles.benefitTitle}>{t("社区活动优先参与", "Early access to community events")}</Text><Text style={styles.benefitStatus}>{t("预览", "Preview")}</Text></View>
        <View style={styles.benefitRow}><Text style={styles.benefitTitle}>{t("贡献者身份标识", "Contributor recognition")}</Text><Text style={styles.benefitStatus}>{t("预览", "Preview")}</Text></View>
      </View>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)" },
  back: { width: 28 }, backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "600" },
  passport: { borderWidth: 1, borderColor: "#DADADA", padding: 15, marginTop: 12 },
  brand: { color: "#A0B2D0", fontSize: 7, letterSpacing: 1 },
  name: { color: "#EAF2FF", fontSize: 14, fontWeight: "700", marginTop: 16 },
  memberNo: { color: "#96A9C8", fontSize: 8, marginTop: 5 },
  passportDivider: { height: 1, backgroundColor: "#E5E5E5", marginVertical: 12 },
  stats: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { color: "#A0B2D0", fontSize: 8 }, statValue: { color: "#EAF2FF", fontSize: 9, fontWeight: "700" },
  section: { borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)", paddingVertical: 13, gap: 9 },
  sectionTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  explain: { color: "#96A9C8", fontSize: 8, lineHeight: 13 },
  analysis: { gap: 9 },
  analysisRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  analysisLabel: { color: "#A0B2D0", fontSize: 8, width: 66 },
  track: { height: 6, backgroundColor: "rgba(21, 36, 62, 0.92)", flex: 1, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: "#888888" },
  analysisValue: { color: "#A0B2D0", fontSize: 8, width: 20, textAlign: "right" },
  benefitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 25 },
  benefitTitle: { color: "#B8C9E4", fontSize: 8 }, benefitStatus: { color: "#8A9DBD", fontSize: 7 }
});