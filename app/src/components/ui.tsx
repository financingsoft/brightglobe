import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";

type AppScreenProps = {
  children: ReactNode;
};

export function AppScreen({ children }: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function BrandHeader() {
  const { t } = useI18n();

  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>B</Text>
      </View>
      <View>
        <Text style={styles.brandName}>BrightGlobe</Text>
        <Text style={styles.brandTagline}>{t("brandTagline")}</Text>
      </View>
    </View>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.heading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Panel({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionHeading({
  title,
  action
}: {
  title: string;
  action?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function MetricCard({
  label,
  value,
  footnote,
  tone = "blue"
}: {
  label: string;
  value: string;
  footnote?: string;
  tone?: "blue" | "teal" | "gold";
}) {
  const toneStyle =
    tone === "teal"
      ? styles.metricTeal
      : tone === "gold"
        ? styles.metricGold
        : styles.metricBlue;

  return (
    <View style={[styles.metricCard, toneStyle]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {footnote ? <Text style={styles.metricFootnote}>{footnote}</Text> : null}
    </View>
  );
}

export function Pill({
  label,
  tone = "blue"
}: {
  label: string;
  tone?: "blue" | "green" | "gold" | "gray";
}) {
  const toneStyle =
    tone === "green"
      ? styles.pillGreen
      : tone === "gold"
        ? styles.pillGold
        : tone === "gray"
          ? styles.pillGray
          : styles.pillBlue;

  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function ProgressTrack({ progress }: { progress: number }) {
  const safeProgress = Math.max(0, Math.min(progress, 100));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: safeProgress + "%" }]} />
    </View>
  );
}

export function InfoRow({
  label,
  value,
  last = false
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 40,
    gap: spacing.lg
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: spacing.sm
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center"
  },
  brandMarkText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  brandName: { color: colors.ink, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  brandTagline: { color: colors.inkMuted, fontSize: 8, fontWeight: "800", letterSpacing: 1.15, marginTop: 2 },
  heading: { gap: 7, marginTop: spacing.sm, marginBottom: spacing.xs },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.25 },
  pageTitle: { color: colors.ink, fontSize: 27, lineHeight: 33, fontWeight: "800", letterSpacing: -0.8 },
  pageSubtitle: { color: colors.inkMuted, fontSize: 14, lineHeight: 21 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm
  },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  sectionAction: { color: colors.brand, fontSize: 12, fontWeight: "700" },
  metricCard: { flex: 1, borderRadius: radii.md, padding: spacing.lg, gap: 7, minHeight: 108 },
  metricBlue: { backgroundColor: colors.brandSoft },
  metricTeal: { backgroundColor: colors.tealSoft },
  metricGold: { backgroundColor: colors.goldSoft },
  metricLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "700" },
  metricValue: { color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.6 },
  metricFootnote: { color: colors.inkMuted, fontSize: 10 },
  pill: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  pillBlue: { backgroundColor: colors.brandSoft },
  pillGreen: { backgroundColor: colors.tealSoft },
  pillGold: { backgroundColor: colors.goldSoft },
  pillGray: { backgroundColor: "#EEF1F5" },
  pillText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: radii.pill, backgroundColor: "#E9EEF5", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.brand, borderRadius: radii.pill },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.inkMuted, fontSize: 13 },
  infoValue: { color: colors.ink, fontSize: 13, fontWeight: "700" }
});
