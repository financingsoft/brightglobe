import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
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
  showHeader?: boolean;
};

export function AppScreen({ children, showHeader = false }: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {Platform.OS === "web" ? (
        <View style={styles.webStatusBar}>
          <View style={styles.statusSide}><Text style={styles.statusSymbols}>●●●  ◔</Text></View>
          <Text style={styles.statusTime}>6:00 PM</Text>
          <View style={[styles.statusSide, styles.statusRight]}>
            <Text style={styles.statusPercent}>100%</Text>
            <View style={styles.batteryBody}><View style={styles.batteryFill} /></View>
          </View>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {showHeader ? <BrandHeader /> : null}
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
        <Text style={styles.brandMarkText}>✦</Text>
      </View>
      <View style={styles.brandCopy}>
        <Text style={styles.brandName}>BrightGlobe</Text>
        <Text style={styles.brandTagline}>{t("brandTagline")}</Text>
      </View>
      <View style={styles.headerBadge}>
        <Text style={styles.headerBadgeGlyph}>⌁</Text>
      </View>
    </View>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  light = false
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <View style={styles.heading}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, light && styles.lightText]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.pageTitle, light && styles.lightText]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.pageSubtitle, light && styles.lightSubtitle]}>
          {subtitle}
        </Text>
      ) : null}
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
      {action ? <Text style={styles.sectionAction}>{action} ›</Text> : null}
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

export function ActionRow({
  icon,
  title,
  description,
  onPress,
  last = false,
  accent = "purple"
}: {
  icon: string;
  title: string;
  description?: string;
  onPress?: () => void;
  last?: boolean;
  accent?: "purple" | "gold" | "teal";
}) {
  const accentStyle =
    accent === "gold"
      ? styles.actionIconGold
      : accent === "teal"
        ? styles.actionIconTeal
        : styles.actionIconPurple;

  const content = (
    <>
      <View style={[styles.actionIcon, accentStyle]}>
        <Text style={styles.actionGlyph}>{icon}</Text>
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        {description ? (
          <Text style={styles.actionDescription}>{description}</Text>
        ) : null}
      </View>
      <Text style={styles.actionChevron}>›</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.actionRow, !last && styles.actionBorder]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.actionRow, !last && styles.actionBorder]}>
      {content}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  tone = "purple"
}: {
  label: string;
  onPress: () => void;
  tone?: "purple" | "light";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        tone === "light" && styles.primaryButtonLight,
        pressed && styles.buttonPressed
      ]}
    >
      <Text
        style={[
          styles.primaryButtonText,
          tone === "light" && styles.primaryButtonTextLight
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.primaryButtonArrow,
          tone === "light" && styles.primaryButtonTextLight
        ]}
      >
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  webStatusBar: { width: "100%", maxWidth: 390, height: 24, alignSelf: "center", paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF" },
  statusSide: { width: 70, flexDirection: "row", alignItems: "center" },
  statusSymbols: { color: "#111111", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  statusTime: { color: "#111111", fontSize: 9, fontWeight: "700" },
  statusRight: { justifyContent: "flex-end", gap: 3 },
  statusPercent: { color: "#111111", fontSize: 8, fontWeight: "600" },
  batteryBody: { width: 15, height: 7, borderWidth: 1, borderColor: "#111111", padding: 1, justifyContent: "center" },
  batteryFill: { width: "100%", height: "100%", backgroundColor: "#111111" },
  // Keep the app at a phone-sized reference width on tablet and desktop previews.
  scroll: { flex: 1, width: "100%", maxWidth: 390, alignSelf: "center" },
  content: {
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: 16,
    gap: 0
  },
  brandHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 2
  },
  brandMark: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center"
  },
  brandMarkText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  brandCopy: { flex: 1, gap: 2 },
  brandName: { color: colors.ink, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  brandTagline: { color: colors.inkMuted, fontSize: 8, fontWeight: "800", letterSpacing: 1.1 },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  headerBadgeGlyph: { color: colors.brand, fontSize: 23, lineHeight: 26 },
  heading: { gap: 6, marginTop: 2, marginBottom: 1 },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  pageTitle: { color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "900", letterSpacing: -0.7 },
  pageSubtitle: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  lightText: { color: "#FFFFFF" },
  lightSubtitle: { color: "#D8C9EA" },
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
    marginTop: 1,
    marginBottom: -4
  },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  sectionAction: { color: colors.brand, fontSize: 11, fontWeight: "800" },
  metricCard: { flex: 1, borderRadius: radii.md, padding: 14, gap: 6, minHeight: 96 },
  metricBlue: { backgroundColor: colors.brandSoft },
  metricTeal: { backgroundColor: colors.tealSoft },
  metricGold: { backgroundColor: colors.goldSoft },
  metricLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: "800" },
  metricValue: { color: colors.ink, fontSize: 23, fontWeight: "900", letterSpacing: -0.6 },
  metricFootnote: { color: colors.inkMuted, fontSize: 9 },
  pill: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  pillBlue: { backgroundColor: colors.brandSoft },
  pillGreen: { backgroundColor: colors.tealSoft },
  pillGold: { backgroundColor: colors.goldSoft },
  pillGray: { backgroundColor: "#F0EDF3" },
  pillText: { color: colors.ink, fontSize: 9, fontWeight: "900" },
  progressTrack: { height: 7, borderRadius: radii.pill, backgroundColor: "#EDE7F4", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.brand, borderRadius: radii.pill },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.inkMuted, fontSize: 12 },
  infoValue: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  actionRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  actionBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  actionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionIconPurple: { backgroundColor: colors.brandSoft },
  actionIconGold: { backgroundColor: colors.goldSoft },
  actionIconTeal: { backgroundColor: colors.tealSoft },
  actionGlyph: { color: colors.brandDark, fontSize: 19, fontWeight: "800" },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  actionDescription: { color: colors.inkMuted, fontSize: 10, lineHeight: 15 },
  actionChevron: { color: "#B1A6BD", fontSize: 25, lineHeight: 28 },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.brand
  },
  primaryButtonLight: { backgroundColor: "#FFFFFF" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  primaryButtonTextLight: { color: colors.brandDark },
  primaryButtonArrow: { color: "#FFFFFF", fontSize: 21, lineHeight: 22, marginTop: -2 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] }
});
