import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { locale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const definitions: Record<string, { zh: string; en: string; items: [string, string][] }> = {
    shopping: { zh: "购物", en: "Shopping", items: [["精选商城", "Featured marketplace"], ["每日优惠", "Daily offers"], ["合作品牌任务", "Partner missions"]] },
    games: { zh: "游戏", en: "Games", items: [["社区小游戏", "Community mini games"], ["游戏挑战", "Game challenges"], ["玩家活动", "Player events"]] },
    entertainment: { zh: "娱乐", en: "Entertainment", items: [["小说", "Reading"], ["漫画", "Comics"], ["新闻", "News"], ["音乐", "Music"]] },
    finance: { zh: "来钱", en: "Finance", items: [["金融合作服务", "Financial partner services"], ["办卡与服务", "Card and services"]] },
    wellness: { zh: "健康", en: "Wellness", items: [["健康生活", "Healthy living"], ["健康任务", "Wellness missions"]] }
  };
  const key = category && definitions[category] ? category : "shopping";
  const current = definitions[key];
  return (
    <AppScreen>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable><Text style={styles.headerTitle}>{locale === "zh-CN" ? current.zh : current.en}</Text><View style={styles.back} /></View>
      <View style={styles.list}>
        {current.items.map(([zh, en]) => (
          <Pressable key={zh} onPress={() => router.push(`/activity?title=${encodeURIComponent(locale === "zh-CN" ? zh : en)}`)} style={styles.row}>
            <Text style={styles.rowIcon}>◇</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>{t(zh, en)}</Text><Text style={styles.rowMeta}>{t("查看任务详情与参与规则", "View mission details and participation rules")}</Text></View><Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.preview}>{t("分类页面结构依据公开 PRD；具体服务内容为 BrightGlobe 产品映射预览。", "Page structure follows the public PRD; service content is a BrightGlobe mapping preview.")}</Text>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD" },
  back: { width: 28 }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 }, headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600" },
  list: { borderTopWidth: 1, borderColor: "#E0E0E0", marginTop: 8 },
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderColor: "#E7E7E7" },
  rowIcon: { color: "#555555", fontSize: 18, width: 25, textAlign: "center" },
  rowCopy: { flex: 1, gap: 4 }, rowTitle: { color: "#444444", fontSize: 9, fontWeight: "600" }, rowMeta: { color: "#999999", fontSize: 7 }, chevron: { color: "#999999", fontSize: 18 },
  preview: { color: "#AAAAAA", fontSize: 7, lineHeight: 12, marginTop: 12 }
});