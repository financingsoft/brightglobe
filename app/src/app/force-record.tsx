import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function ForceRecordScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const rows = tab === "active"
    ? [
        { title: t("每日签到", "Daily check-in"), date: t("2018-09-22 19:20生效", "Effective Sep 22, 19:20"), value: t("魔法原力+3", "Magic Power +3") },
        { title: t("邀请好友", "Invite friends"), date: t("2018-09-20 19:20生效", "Effective Sep 20, 19:20"), value: t("永生原力+2", "Permanent Power +2") },
        { title: t("阅读精选内容", "Read selected content"), date: t("2018-09-19 09:10生效", "Effective Sep 19, 09:10"), value: t("永生原力+5", "Permanent Power +5") }
      ]
    : [
        { title: t("早期体验任务", "Early access mission"), date: t("已于2018-09-01失效", "Expired Sep 1"), value: t("永生原力+10", "Permanent Power +10") }
      ];

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{t("原力记录", "Power record")}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.summary}>
        <Text style={styles.label}>{t("生效原力值", "Effective Power")}</Text>
        <Text style={styles.value}>534</Text>
        <Text style={styles.meta}>{t("未生效原力值 0", "Inactive Power 0")}</Text>
      </View>
      <View style={styles.explain}>
        <Text style={styles.sectionTitle}>{t("原力简介", "About Contribution Power")}</Text>
        <Text style={styles.explainText}>{t("原力是影响社区奖励获取的贡献指标。不同任务产生的贡献值可能具有不同的有效期和规则。", "Contribution Power reflects activity in the BrightGlobe community. Different missions may have different validity periods and rules.")}</Text>
      </View>
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("active")} style={[styles.tab, tab === "active" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>{t("生效中的原力记录", "Effective records")}</Text>
        </Pressable>
        <Pressable onPress={() => setTab("inactive")} style={[styles.tab, tab === "inactive" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "inactive" && styles.tabTextActive]}>{t("未生效的原力记录", "Inactive records")}</Text>
        </Pressable>
      </View>
      {rows.map((row, i) => (
        <View key={row.title + row.date} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.rowDate}>{row.date}</Text>
          </View>
          <Text style={styles.rowValue}>{row.value}</Text>
        </View>
      ))}
      <Text style={styles.preview}>{t("示例记录，仅用于页面预览。", "Sample records for UI preview only.")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)" },
  back: { width: 28, alignItems: "flex-start" },
  backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "600" },
  summary: { paddingVertical: 15, borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)", gap: 4 },
  label: { color: "#A0B2D0", fontSize: 9 },
  value: { color: "#EAF2FF", fontSize: 24, fontWeight: "700" },
  meta: { color: "#96A9C8", fontSize: 8 },
  explain: { paddingVertical: 13, borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)", gap: 7 },
  sectionTitle: { color: "#E1EBFC", fontSize: 10, fontWeight: "700" },
  explainText: { color: "#A0B2D0", fontSize: 8, lineHeight: 14 },
  tabs: { height: 38, flexDirection: "row", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)" },
  tab: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#555555" },
  tabText: { color: "#8A9DBD", fontSize: 8 },
  tabTextActive: { color: "#EAF2FF", fontWeight: "700" },
  row: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowBorder: { borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.12)" },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { color: "#E1EBFC", fontSize: 9, fontWeight: "600" },
  rowDate: { color: "#8A9DBD", fontSize: 7 },
  rowValue: { color: "#A0B2D0", fontSize: 8 },
  preview: { color: "#788CAB", fontSize: 7, marginTop: 12 }
});