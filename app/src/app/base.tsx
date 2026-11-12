import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function CommunityBaseScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("星球基地", "Community base")}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.hero}>
        <Text style={styles.title}>BrightGlobe</Text>
        <Text style={styles.subtitle}>{t("全球贡献者网络，共建开放的社区生态", "A global contributor network building an open community ecosystem")}</Text>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>12,085</Text><Text style={styles.metricLabel}>{t("社区总贡献", "Total contributions")}</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>328</Text><Text style={styles.metricLabel}>{t("昨日贡献", "Yesterday")}</Text></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("个人价值挖掘", "Contributor value")}</Text>
        <Text style={styles.copy}>{t("每一次阅读、分享、讨论和协作，都构成社区的共同价值。BrightGlobe 通过透明的贡献记录，让参与者看到自己的投入与成长。", "Reading, sharing, discussing, and collaborating all create community value. BrightGlobe makes participation visible through transparent contribution records.")}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("核心技术", "Core technology")}</Text>
        <View style={styles.item}><Text style={styles.itemTitle}>{t("统一身份与贡献档案", "Unified identity and contribution profile")}</Text><Text style={styles.itemCopy}>{t("连接用户、内容、活动与贡献记录。", "Connects members, content, activities, and contribution records.")}</Text></View>
        <View style={styles.item}><Text style={styles.itemTitle}>{t("开放内容与社区服务", "Open content and community services")}</Text><Text style={styles.itemCopy}>{t("支持多语言内容、任务与互动服务。", "Supports multilingual content, missions, and community interactions.")}</Text></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("建设规划", "Development plan")}</Text>
        <Text style={styles.copy}>{t("持续完善贡献系统、内容发现、社区活动和成员权益。以上为产品介绍预览。", "Continue improving contribution systems, content discovery, community events, and member benefits. This is a product overview preview.")}</Text>
      </View>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  back: { width: 28 }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600" },
  hero: { alignItems: "center", paddingVertical: 17, gap: 6 },
  title: { color: "#333333", fontSize: 19, fontWeight: "700" }, subtitle: { color: "#888888", fontSize: 8, textAlign: "center" },
  metrics: { flexDirection: "row", borderWidth: 1, borderColor: "#DDDDDD", paddingVertical: 14 },
  metric: { flex: 1, alignItems: "center", gap: 4 },
  metricValue: { color: "#333333", fontSize: 16, fontWeight: "700" }, metricLabel: { color: "#888888", fontSize: 7 },
  section: { borderBottomWidth: 1, borderColor: "#E2E2E2", paddingVertical: 12, gap: 8 },
  sectionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" },
  copy: { color: "#777777", fontSize: 8, lineHeight: 14 },
  item: { borderTopWidth: 1, borderColor: "#EEEEEE", paddingTop: 8, gap: 4 },
  itemTitle: { color: "#555555", fontSize: 8, fontWeight: "600" }, itemCopy: { color: "#888888", fontSize: 7 }
});