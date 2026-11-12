import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  InfoRow,
  PageHeading,
  Panel,
  Pill,
  SectionHeading
} from "@/components/ui";
import { colors } from "@/constants/theme";
import { useI18n, type Locale } from "@/i18n/locale";

export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();

  const chooseLanguage = (nextLocale: Locale) => {
    setLocale(nextLocale);
  };

  return (
    <AppScreen>
      <PageHeading title={t("profileTitle")} subtitle={t("profileSubtitle")} />

      <Panel style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>BG</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.memberName}>{t("demoMemberName")}</Text>
          <Text style={styles.memberLabel}>{t("memberLabel")}</Text>
        </View>
        <Pill label={t("preview")} tone="gold" />
      </Panel>

      <SectionHeading title={t("language")} />
      <Panel>
        <Text style={styles.languageDescription}>{t("languageDesc")}</Text>
        <View style={styles.languageOptions}>
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
        </View>
      </Panel>

      <SectionHeading title={t("accountStatus")} />
      <Panel>
        <InfoRow label={t("memberLabel")} value={t("notConnected")} last />
      </Panel>

      <Panel style={styles.noticePanel}>
        <Text style={styles.noticeTitle}>{t("apiNotice")}</Text>
        <Text style={styles.noticeBody}>{t("noToken")}</Text>
      </Panel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  profileCopy: { flex: 1, gap: 4 },
  memberName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  memberLabel: { color: colors.inkMuted, fontSize: 11 },
  languageDescription: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  languageOptions: { flexDirection: "row", gap: 10, marginTop: 5 },
  languageButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  languageButtonActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  languageButtonText: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  languageButtonTextActive: { color: colors.brandDark },
  check: { color: colors.brand, fontSize: 15, fontWeight: "800" },
  noticePanel: { backgroundColor: "#F9FBFE" },
  noticeTitle: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  noticeBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 17 }
});
