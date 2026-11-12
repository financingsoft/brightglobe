import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ActionRow,
  AppScreen,
  PageHeading,
  Panel,
  Pill,
  ProgressTrack,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n, type Locale } from "@/i18n/locale";

export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();

  const chooseLanguage = (nextLocale: Locale) => {
    setLocale(nextLocale);
  };

  return (
    <AppScreen>
      <PageHeading
        eyebrow={t("navMe").toUpperCase()}
        title={t("profileTitle")}
        subtitle={t("profileSubtitle")}
      />

      <View style={styles.memberCard}>
        <View style={styles.memberGlow} />
        <View style={styles.memberTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>BG</Text>
          </View>
          <View style={styles.memberCopy}>
            <Text style={styles.memberName}>{t("demoMemberName")}</Text>
            <Text style={styles.memberLabel}>{t("memberLabel")} · ID BG-00828</Text>
          </View>
          <Pill label={t("preview")} tone="gold" />
        </View>
        <View style={styles.memberStats}>
          <View style={styles.memberStat}>
            <Text style={styles.memberStatValue}>1,280</Text>
            <Text style={styles.memberStatLabel}>{t("contributionPower")}</Text>
          </View>
          <View style={styles.memberStatDivider} />
          <View style={styles.memberStat}>
            <Text style={styles.memberStatValue}>860</Text>
            <Text style={styles.memberStatLabel}>{t("experience")}</Text>
          </View>
          <View style={styles.memberStatDivider} />
          <View style={styles.memberStat}>
            <Text style={styles.memberStatValue}>2,480</Text>
            <Text style={styles.memberStatLabel}>{t("rewardPoints")}</Text>
          </View>
        </View>
        <View style={styles.levelProgress}>
          <View style={styles.levelProgressTop}>
            <Text style={styles.levelProgressLabel}>{t("profileProgress")}</Text>
            <Text style={styles.levelProgressValue}>LEVEL 04</Text>
          </View>
          <ProgressTrack progress={68} />
        </View>
      </View>

      <SectionHeading title={t("profileAssets")} />
      <Panel style={styles.menuPanel}>
        <ActionRow
          icon="▤"
          title={t("profileAssets")}
          description={locale === "zh-CN" ? "查看社区积分、经验值和奖励活动。" : "View points, experience, and reward activity."}
          onPress={() => router.push("/wallet")}
        />
        <ActionRow
          icon="↗"
          title={t("profileInvite")}
          description={locale === "zh-CN" ? "邀请朋友加入 BrightGlobe 社区。" : "Invite friends to join BrightGlobe."}
          onPress={() => router.push("/tasks")}
        />
        <ActionRow
          icon="◎"
          title={t("profileBase")}
          description={locale === "zh-CN" ? "返回社区首页，发现精选动态。" : "Return to the community home."}
          onPress={() => router.push("/")}
          last
          accent="teal"
        />
      </Panel>

      <SectionHeading title={t("profileSettings")} />
      <Panel style={styles.settingsPanel}>
        <Text style={styles.settingTitle}>{t("language")}</Text>
        <Text style={styles.languageDescription}>{t("languageDesc")}</Text>
        <View style={styles.languageOptions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: locale === "zh-CN" }}
            onPress={() => chooseLanguage("zh-CN")}
            style={[styles.languageButton, locale === "zh-CN" && styles.languageButtonActive]}
          >
            <Text style={[styles.languageButtonText, locale === "zh-CN" && styles.languageButtonTextActive]}>
              {t("chinese")}
            </Text>
            {locale === "zh-CN" ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: locale === "en" }}
            onPress={() => chooseLanguage("en")}
            style={[styles.languageButton, locale === "en" && styles.languageButtonActive]}
          >
            <Text style={[styles.languageButtonText, locale === "en" && styles.languageButtonTextActive]}>
              {t("english")}
            </Text>
            {locale === "en" ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        </View>
      </Panel>

      <Panel style={styles.aboutCard}>
        <View style={styles.aboutMark}>
          <Text style={styles.aboutMarkText}>✦</Text>
        </View>
        <View style={styles.aboutCopy}>
          <Text style={styles.aboutTitle}>{t("profileAbout")}</Text>
          <Text style={styles.aboutBody}>BrightGlobe · Global Contribution Network</Text>
        </View>
        <Text style={styles.aboutVersion}>0.1.0</Text>
      </Panel>

      <Text style={styles.disclaimer}>{t("apiNotice")}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  memberCard: { backgroundColor: colors.violetDeep, borderRadius: 22, padding: 17, overflow: "hidden", gap: 16 },
  memberGlow: { position: "absolute", width: 175, height: 175, borderRadius: 88, backgroundColor: "rgba(155,90,224,0.2)", right: -25, top: -70 },
  memberTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#A66BE5", borderWidth: 1, borderColor: "#D0A8FA", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  memberCopy: { flex: 1, gap: 4 },
  memberName: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  memberLabel: { color: "#CBB6DE", fontSize: 8, fontWeight: "700" },
  memberStats: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  memberStat: { flex: 1, gap: 5 },
  memberStatValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  memberStatLabel: { color: "#CBB6DE", fontSize: 8, fontWeight: "700" },
  memberStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  levelProgress: { gap: 8 },
  levelProgressTop: { flexDirection: "row", justifyContent: "space-between" },
  levelProgressLabel: { color: "#CBB6DE", fontSize: 8, fontWeight: "700" },
  levelProgressValue: { color: "#E7D7F6", fontSize: 8, fontWeight: "900" },
  menuPanel: { paddingVertical: 5, gap: 0 },
  settingsPanel: { gap: 9 },
  settingTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  languageDescription: { color: colors.inkMuted, fontSize: 9, lineHeight: 14 },
  languageOptions: { flexDirection: "row", gap: 9, marginTop: 3 },
  languageButton: { flex: 1, minHeight: 42, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  languageButtonActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  languageButtonText: { color: colors.inkMuted, fontSize: 10, fontWeight: "800" },
  languageButtonTextActive: { color: colors.brandDark },
  check: { color: colors.brand, fontSize: 14, fontWeight: "900" },
  aboutCard: { flexDirection: "row", alignItems: "center", padding: 13, gap: 10 },
  aboutMark: { width: 37, height: 37, borderRadius: 13, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  aboutMarkText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  aboutCopy: { flex: 1, gap: 3 },
  aboutTitle: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  aboutBody: { color: colors.inkMuted, fontSize: 8 },
  aboutVersion: { color: colors.inkMuted, fontSize: 8, fontWeight: "800" },
  disclaimer: { color: colors.inkMuted, fontSize: 9, lineHeight: 14 }
});
