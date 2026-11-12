import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.description}>This BrightGlobe route does not exist.</Text>
      <Link href="/" style={styles.link}>Return home</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.canvas },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  description: { color: colors.inkMuted, fontSize: 13, marginTop: 8, marginBottom: 18 },
  link: { color: colors.brand, fontSize: 14, fontWeight: "800" }
});
