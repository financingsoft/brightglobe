import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function ActivityScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const { locale } = useI18n();
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const pageTitle = typeof title === "string" ? title : t("社区活动", "Community activity");
  return (
    <AppScreen>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable><Text style={styles.headerTitle}>{pageTitle}</Text><View style={styles.back} /></View>
      <View style={styles.banner}><Text style={styles.bannerGlyph}>◇</Text><Text style={styles.bannerTitle}>{pageTitle}</Text><Text style={styles.bannerSub}>{t("参与 BrightGlobe 社区任务，记录你的每一份贡献。", "Take part in BrightGlobe missions and track your contribution.")}</Text></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>{t("活动说明", "Activity details")}</Text><Text style={styles.copy}>{t("本页面用于承载任务或活动的详情、参与条件和奖励说明。当前数据为演示信息，真实服务与奖励规则尚未接入。", "This page contains activity details, eligibility, and reward terms. The content is demo data; live services and rewards are not connected.")}</Text></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>{t("参与规则", "Participation rules")}</Text><Text style={styles.copy}>{t("完成指定步骤后，系统会记录任务状态。具体条件以 BrightGlobe 正式发布的规则为准。", "Complete the listed steps to record a mission state. Final eligibility is governed by BrightGlobe's published rules.")}</Text></View>
      <Pressable onPress={() => setShowInfo(true)} style={styles.action}><Text style={styles.actionText}>{t("查看参与状态", "Check participation status")}</Text></Pressable>
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}><View style={styles.scrim}><View style={styles.dialog}><Text style={styles.dialogTitle}>{t("预览状态", "Preview status")}</Text><Text style={styles.copy}>{t("任务服务暂未连接，因此不会提交或发放真实奖励。", "The task service is not connected; no activity is submitted and no real reward is credited.")}</Text><Pressable onPress={() => setShowInfo(false)} style={styles.action}><Text style={styles.actionText}>{t("知道了", "Got it")}</Text></Pressable></View></View></Modal>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  back: { width: 28 }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 }, headerTitle: { color: "#333333", fontSize: 12, fontWeight: "600" },
  banner: { backgroundColor: "#F1F1F1", alignItems: "center", padding: 18, marginTop: 9, gap: 7 },
  bannerGlyph: { color: "#555555", fontSize: 28 }, bannerTitle: { color: "#333333", fontSize: 13, fontWeight: "700" }, bannerSub: { color: "#777777", fontSize: 8, textAlign: "center" },
  section: { borderBottomWidth: 1, borderColor: "#E4E4E4", paddingVertical: 13, gap: 7 },
  sectionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" }, copy: { color: "#777777", fontSize: 8, lineHeight: 14 },
  action: { height: 34, borderRadius: 18, backgroundColor: "#555555", alignItems: "center", justifyContent: "center", marginTop: 14, paddingHorizontal: 12 },
  actionText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 28 },
  dialog: { backgroundColor: "#FFFFFF", width: "100%", maxWidth: 300, borderRadius: 8, padding: 19, alignItems: "center" }, dialogTitle: { color: "#333333", fontSize: 12, fontWeight: "700" }
});