import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";

type ProfileIconKind = "force" | "invite" | "base" | "settings";

function ProfileGlyph({ kind }: { kind: ProfileIconKind }) {
  if (kind === "force") {
    return <View style={styles.forceGlyph}><View style={styles.forceRing}><View style={styles.forceCenter} /></View></View>;
  }
  if (kind === "invite") {
    return (
      <View style={styles.inviteGlyph}>
        <View style={styles.inviteLinkHorizontal} />
        <View style={styles.inviteLinkVertical} />
        <View style={[styles.inviteNode, styles.inviteNodeTop]} />
        <View style={[styles.inviteNode, styles.inviteNodeLeft]} />
        <View style={[styles.inviteNode, styles.inviteNodeRight]} />
      </View>
    );
  }
  if (kind === "base") {
    return (
      <View style={styles.baseGlyph}>
        <View style={styles.baseRoofLeft} />
        <View style={styles.baseRoofRight} />
        <View style={styles.baseBody} />
      </View>
    );
  }
  return <Text style={styles.settingsGlyph}>⚙</Text>;
}

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
        <ProfileGlyph kind="force" />
        <Text style={styles.menuTitle}>{t("我的原力值", "My Contribution Power")}</Text>
        <Text style={styles.menuValue}>534</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => openProtected("/invite")} style={styles.menuRow}>
        <ProfileGlyph kind="invite" />
        <Text style={styles.menuTitle}>{t("我的邀请码", "My invitation code")}</Text>
        <Text style={styles.menuValue}>{t("邀请好友", "Invite friends")}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => openProtected("/base")} style={styles.menuRow}>
        <ProfileGlyph kind="base" />
        <Text style={styles.menuTitle}>{t("星球基地", "Community base")}</Text>
        <Text style={styles.menuValue} />
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => openProtected("/settings")} style={styles.menuRow}>
        <ProfileGlyph kind="settings" />
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
  memberName: { color: "#333333", fontSize: 15, fontWeight: "700" },
  residentType: { color: "#888888", fontSize: 10 },
  avatarButton: { width: 50, height: 56, alignItems: "center", justifyContent: "center", transform: [{ translateY: -12 }] },
  avatarIcon: { width: 42, height: 50, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  avatarHead: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.7, borderColor: "#777777" },
  avatarShoulders: { width: 36, height: 20, borderWidth: 1.7, borderColor: "#777777", borderTopLeftRadius: 13, borderTopRightRadius: 13, borderBottomWidth: 0 },
  sectionHeading: { minHeight: 47, justifyContent: "center", marginTop: 62 },
  sectionTitle: { color: "#444444", fontSize: 12, fontWeight: "700" },
  assetRow: { flexDirection: "row", gap: 8, paddingBottom: 10 },
  assetTile: { flex: 1, minHeight: 82, backgroundColor: "#F1F1F1", borderRadius: 3, paddingHorizontal: 9, paddingVertical: 7, justifyContent: "space-between" },
  assetLabel: { color: "#666666", fontSize: 10 },
  assetValue: { color: "#333333", fontSize: 14, fontWeight: "700" },
  assetHint: { color: "#888888", fontSize: 8 },
  menuRow: { minHeight: 46, borderBottomWidth: 1, borderColor: "#E5E5E5", flexDirection: "row", alignItems: "center", gap: 10 },
  forceGlyph: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  forceRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: "#777777", alignItems: "center", justifyContent: "center" },
  forceCenter: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#777777" },
  inviteGlyph: { width: 22, height: 22, position: "relative" },
  inviteLinkHorizontal: { position: "absolute", height: 1.4, left: 6, right: 6, top: 10, backgroundColor: "#777777" },
  inviteLinkVertical: { position: "absolute", width: 1.4, height: 7, left: 10, top: 4, backgroundColor: "#777777" },
  inviteNode: { position: "absolute", width: 6, height: 6, borderRadius: 3, borderWidth: 1.2, borderColor: "#777777", backgroundColor: "#FFFFFF" },
  inviteNodeTop: { left: 8, top: 1 },
  inviteNodeLeft: { left: 2, top: 13 },
  inviteNodeRight: { right: 2, top: 13 },
  baseGlyph: { width: 22, height: 22, position: "relative", alignItems: "center" },
  baseRoofLeft: { position: "absolute", top: 5, left: 3, width: 10, height: 1.6, backgroundColor: "#777777", transform: [{ rotate: "-35deg" }] },
  baseRoofRight: { position: "absolute", top: 5, right: 3, width: 10, height: 1.6, backgroundColor: "#777777", transform: [{ rotate: "35deg" }] },
  baseBody: { position: "absolute", top: 8, width: 14, height: 11, borderWidth: 1.4, borderColor: "#777777", borderBottomWidth: 1.4 },
  settingsGlyph: { color: "#777777", fontSize: 17, width: 22, textAlign: "center" },
  menuTitle: { color: "#444444", fontSize: 11, flex: 1 },
  menuValue: { color: "#999999", fontSize: 9 },
  chevron: { color: "#888888", fontSize: 18, marginLeft: 1 }
});
