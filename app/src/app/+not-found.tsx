import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { useI18n } from "@/i18n/locale";
import { StarfieldBackground } from "@/components/StarfieldBackground";

export default function NotFoundScreen() {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <StarfieldBackground />
      <Text style={styles.title}>{t("notFoundTitle")}</Text>
      <Text style={styles.description}>{t("notFoundDescription")}</Text>
      <Link href="/" style={styles.link}>{t("goHome")}</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "transparent" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  description: { color: colors.inkMuted, fontSize: 13, marginTop: 8, marginBottom: 18 },
  link: { color: colors.brand, fontSize: 14, fontWeight: "800" }
});
