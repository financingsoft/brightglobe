import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

export default function ProfileScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const openProtected = (route: "/settings" | "/wallet" | "/passport" | "/force-record" | "/invite" | "/base") => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    router.push(route);
  };
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  return (
    <AppScreen>
      <View style={styles.identityRow}>
        <View style={styles.identityCopy}>
          <Text style={styles.memberName}>{t("BrightGlobe 用户", "BrightGlobe Member")}</Text>
          <Text style={styles.residentType}>{t("星球居民", "Community resident")}</Text>
        </View>
        <Pressable onPress={() => openProtected("/settings")} style={styles.avatarButton}>
          <View style={styles.avatarIcon}>
            <View style={styles.avatarHead} />
            <View style={styles.avatarShoulders} />
          </View>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{t("我的资产", "My assets")}</Text>
      </View>
      <View style={styles.assetRow}>
        <Pressable onPress={() => openProtected("/wallet")} style={styles.assetTile}>
          <Text style={styles.assetLabel}>{t("我的钱包", "My wallet")}</Text>
          <Text style={styles.assetValue}>122.90001</Text>
          <Text style={styles.assetHint}>{t("查看记录", "View records")} ›</Text>
        </Pressable>
        <Pressable onPress={() => openProtected("/passport")} style={styles.assetTile}>
          <Text style={styles.assetLabel}>{t("数据护照", "Data passport")}</Text>
          <Text style={styles.assetValue}>{t("已建立", "Created")}</Text>
          <Text style={styles.assetHint}>{t("查看护照", "View passport")} ›</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => openProtected("/force-record")} style={styles.menuRow}>
        <Text style={styles.menuIcon}>◎</Text>
        <Text style={styles.menuTitle}>{t("我的原力值", "My Contribution Power")}</Text>
        <Text style={styles.menuValue}>534</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => openProtected("/invite")} style={styles.menuRow}>
        <Text style={styles.menuIcon}>♧</Text>
        <Text style={styles.menuTitle}>{t("我的邀请码", "My invitation code")}</Text>
        <Text style={styles.menuValue}>{t("邀请好友", "Invite friends")}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => openProtected("/base")} style={styles.menuRow}>
        <Text style={styles.menuIcon}>⌂</Text>
        <Text style={styles.menuTitle}>{t("星球基地", "Community base")}</Text>
        <Text style={styles.menuValue} />
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => openProtected("/settings")} style={styles.menuRow}>
        <Text style={styles.menuIcon}>⚙</Text>
        <Text style={styles.menuTitle}>{t("设置", "Settings")}</Text>
        <Text style={styles.menuValue} />
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identityRow: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#E2E2E2" },
  identityCopy: { gap: 5 },
  memberName: { color: "#333333", fontSize: 13, fontWeight: "700" },
  residentType: { color: "#888888", fontSize: 8 },
  avatarButton: { width: 37, height: 37, alignItems: "center", justifyContent: "center" },
  avatarIcon: { width: 28, height: 29, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  avatarHead: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.7, borderColor: "#777777" },
  avatarShoulders: { width: 25, height: 14, borderWidth: 1.7, borderColor: "#777777", borderTopLeftRadius: 13, borderTopRightRadius: 13, borderBottomWidth: 0 },
  sectionHeading: { minHeight: 27, justifyContent: "center" },
  sectionTitle: { color: "#444444", fontSize: 10, fontWeight: "700" },
  assetRow: { flexDirection: "row", gap: 8, paddingBottom: 7 },
  assetTile: { flex: 1, minHeight: 60, backgroundColor: "#F1F1F1", borderRadius: 3, paddingHorizontal: 9, paddingVertical: 7, justifyContent: "space-between" },
  assetLabel: { color: "#666666", fontSize: 8 },
  assetValue: { color: "#333333", fontSize: 12, fontWeight: "700" },
  assetHint: { color: "#888888", fontSize: 7 },
  menuRow: { minHeight: 40, borderBottomWidth: 1, borderColor: "#E5E5E5", flexDirection: "row", alignItems: "center", gap: 10 },
  menuIcon: { color: "#777777", fontSize: 18, width: 22, textAlign: "center" },
  menuTitle: { color: "#444444", fontSize: 10, flex: 1 },
  menuValue: { color: "#999999", fontSize: 8 },
  chevron: { color: "#888888", fontSize: 18, marginLeft: 1 }
});
