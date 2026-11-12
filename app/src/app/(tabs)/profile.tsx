import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n, type Locale } from "@/i18n/locale";

export default function ProfileScreen() {
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  const toggleLanguage = (nextLocale: Locale) => setLocale(nextLocale);

  const openPreview = (title: string, detail: string) => {
    Alert.alert(title, detail);
  };

  return (
    <AppScreen>
      <View style={styles.profileHeader}>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{t("BrightGlobe 用户", "BrightGlobe Member")}</Text>
          <View style={styles.memberType}>
            <Text style={styles.memberTypeText}>{t("星球居民 · 探索者", "Planet resident · Explorer")}</Text>
          </View>
          <Text style={styles.memberId}>ID: BG-00828</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarGlyph}>♙</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("我的资产", "My assets")}</Text>
      </View>
      <View style={styles.assetCards}>
        <Pressable onPress={() => router.push("/wallet")} style={styles.assetCard}>
          <View style={[styles.assetIcon, styles.assetIconPurple]}>
            <Text style={styles.assetGlyph}>◆</Text>
          </View>
          <Text style={styles.assetTitle}>{t("我的积分", "My points")}</Text>
          <Text style={styles.assetValue}>2,480</Text>
          <Text style={styles.assetMeta}>{t("查看记录", "View record")} ›</Text>
        </Pressable>
        <Pressable
          onPress={() => openPreview(t("贡献档案", "Contribution passport"), t("展示你的社区参与、兴趣和贡献记录。此页面将在后续版本接入完整数据。", "Your community activity, interests, and contribution record will be available in a later release."))}
          style={styles.assetCard}
        >
          <View style={[styles.assetIcon, styles.assetIconGold]}>
            <Text style={[styles.assetGlyph, styles.assetGlyphGold]}>▤</Text>
          </View>
          <Text style={styles.assetTitle}>{t("贡献档案", "Contribution passport")}</Text>
          <Text style={styles.assetValue}>{t("探索者", "Explorer")}</Text>
          <Text style={styles.assetMeta}>{t("查看档案", "View passport")} ›</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push("/tasks")} style={styles.menuRow}>
        <View style={styles.menuIcon}><Text style={styles.menuGlyph}>◉</Text></View>
        <Text style={styles.menuTitle}>{t("我的贡献力", "My contribution power")}</Text>
        <Text style={styles.menuValue}>1,280</Text>
        <Text style={styles.menuArrow}>›</Text>
      </Pressable>
      <Pressable onPress={() => openPreview(t("我的邀请码", "My invitation code"), t("你的邀请码：BG828。邀请入口将在账户服务上线后启用。", "Your invitation code: BG828. Invitations will be enabled when account services launch."))} style={styles.menuRow}>
        <View style={styles.menuIcon}><Text style={styles.menuGlyph}>♧</Text></View>
        <Text style={styles.menuTitle}>{t("我的邀请码", "My invitation code")}</Text>
        <Text style={styles.menuValue}>{t("邀请好友", "Invite friends")}</Text>
        <Text style={styles.menuArrow}>›</Text>
      </Pressable>
      <Pressable onPress={() => openPreview(t("星球基地", "Planet base"), t("了解 BrightGlobe 社区愿景、贡献体系和发展规划。", "Learn about BrightGlobe's community vision, contribution system, and roadmap."))} style={styles.menuRow}>
        <View style={styles.menuIcon}><Text style={styles.menuGlyph}>⌂</Text></View>
        <Text style={styles.menuTitle}>{t("星球基地", "Planet base")}</Text>
        <Text style={styles.menuValue}></Text>
        <Text style={styles.menuArrow}>›</Text>
      </Pressable>
      <Pressable onPress={() => openPreview(t("账户设置", "Account settings"), t("账户安全、通知及其他偏好设置将在后续版本开放。", "Account security, notifications, and additional preferences will be available in a later release."))} style={styles.menuRow}>
        <View style={styles.menuIcon}><Text style={styles.menuGlyph}>⚙</Text></View>
        <Text style={styles.menuTitle}>{t("设置", "Settings")}</Text>
        <Text style={styles.menuValue}></Text>
        <Text style={styles.menuArrow}>›</Text>
      </Pressable>

      <View style={styles.languageBox}>
        <View style={styles.languageHeader}>
          <Text style={styles.sectionTitle}>{t("语言设置", "Language")}</Text>
          <Text style={styles.languageCaption}>{t("简体中文 / English", "Simplified Chinese / English")}</Text>
        </View>
        <View style={styles.languageOptions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: locale === "zh-CN" }}
            onPress={() => toggleLanguage("zh-CN")}
            style={[styles.languageButton, locale === "zh-CN" && styles.languageButtonActive]}
          >
            <Text style={[styles.languageText, locale === "zh-CN" && styles.languageTextActive]}>简体中文</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: locale === "en" }}
            onPress={() => toggleLanguage("en")}
            style={[styles.languageButton, locale === "en" && styles.languageButtonActive]}
          >
            <Text style={[styles.languageText, locale === "en" && styles.languageTextActive]}>English</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.bottomNote}>{t("BrightGlobe · 全球贡献者网络", "BrightGlobe · Global Contribution Network")} · 0.1.0</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  profileHeader: { minHeight: 104, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, paddingVertical: 9 },
  profileCopy: { flex: 1, gap: 6 },
  profileName: { color: "#39343D", fontSize: 18, fontWeight: "900" },
  memberType: { alignSelf: "flex-start", borderRadius: 4, backgroundColor: "#F1E7F8", paddingHorizontal: 8, paddingVertical: 4 },
  memberTypeText: { color: "#8150A4", fontSize: 8, fontWeight: "800" },
  memberId: { color: "#AAA4AF", fontSize: 8 },
  avatar: { width: 55, height: 55, borderRadius: 28, backgroundColor: "#F1E7F8", borderWidth: 1, borderColor: "#E5D8EF", alignItems: "center", justifyContent: "center" },
  avatarGlyph: { color: colors.brand, fontSize: 29 },
  sectionHeader: { borderBottomWidth: 1, borderColor: "#EEEAF1", paddingBottom: 9, marginTop: 3 },
  sectionTitle: { color: "#55505A", fontSize: 12, fontWeight: "900" },
  assetCards: { flexDirection: "row", gap: 9, paddingBottom: 10 },
  assetCard: { flex: 1, minHeight: 137, borderWidth: 1, borderColor: "#EEEAF1", borderRadius: 9, padding: 12, justifyContent: "space-between", backgroundColor: "#FFFFFF" },
  assetIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  assetIconPurple: { backgroundColor: "#F1E7F8" },
  assetIconGold: { backgroundColor: "#FFF3E0" },
  assetGlyph: { color: colors.brand, fontSize: 17 },
  assetGlyphGold: { color: "#B47A2F" },
  assetTitle: { color: "#716A78", fontSize: 9, fontWeight: "700", marginTop: 8 },
  assetValue: { color: "#39343D", fontSize: 16, fontWeight: "900", marginTop: 3 },
  assetMeta: { color: colors.brand, fontSize: 8, fontWeight: "800", marginTop: 6 },
  menuRow: { minHeight: 53, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "#EEEAF1", gap: 9 },
  menuIcon: { width: 27, alignItems: "center" },
  menuGlyph: { color: "#8F8499", fontSize: 18 },
  menuTitle: { color: "#4C4652", fontSize: 11, fontWeight: "700", flex: 1 },
  menuValue: { color: "#AAA4AF", fontSize: 9, fontWeight: "700" },
  menuArrow: { color: "#B9B3BD", fontSize: 21, paddingLeft: 2 },
  languageBox: { marginTop: 13, borderWidth: 1, borderColor: "#EEEAF1", borderRadius: 9, padding: 12 },
  languageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  languageCaption: { color: "#A29BA7", fontSize: 8 },
  languageOptions: { flexDirection: "row", gap: 8, marginTop: 10 },
  languageButton: { flex: 1, height: 33, borderRadius: 5, borderWidth: 1, borderColor: "#E9E5ED", justifyContent: "center", alignItems: "center" },
  languageButtonActive: { borderColor: colors.brand, backgroundColor: "#F7F0FB" },
  languageText: { color: "#99939E", fontSize: 9, fontWeight: "700" },
  languageTextActive: { color: colors.brandDark },
  bottomNote: { color: "#BCB6C1", fontSize: 8, textAlign: "center", paddingVertical: 10 }
});
