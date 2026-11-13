import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { EarthBackground } from "@/components/earth/EarthBackground";
import { useI18n } from "@/i18n/locale";
import { useAuth } from "@/auth/session";
import { ApiError } from "@/services/api";
import {
  claimDailyCollection,
  formatBdBaseUnits,
  getBdAccount,
  type BdAccountSnapshot
} from "@/services/bd";

export default function HomeScreen() {
  const { locale } = useI18n();
  const router = useRouter();
  const isHomeFocused = useIsFocused();
  const { isAuthenticated, isPreviewAccount, user } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [account, setAccount] = useState<BdAccountSnapshot | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  useEffect(() => {
    let active = true;
    if (!isHomeFocused) return () => { active = false; };

    if (!isAuthenticated || isPreviewAccount) {
      setAccount(null);
      setAccountLoading(false);
      setAccountError(null);
      return () => { active = false; };
    }

    setAccountLoading(true);
    setAccountError(null);
    getBdAccount()
      .then((result) => {
        if (active) setAccount(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAccountError(error instanceof Error
          ? error.message
          : t("暂时无法读取黑钻账户。", "Unable to load the BD account."));
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });

    return () => { active = false; };
  }, [isHomeFocused, isAuthenticated, isPreviewAccount, user?.id, locale]);

  const requireLiveAccount = (action: () => void) => {
    if (!isAuthenticated || isPreviewAccount) {
      setShowLoginPrompt(true);
      return;
    }
    action();
  };

  const openPoints = () => requireLiveAccount(() => router.push("/points-record"));

  const handleEarthTap = async () => {
    if (!isAuthenticated || isPreviewAccount) {
      setShowLoginPrompt(true);
      return;
    }
    if (claiming || accountLoading) return;
    if (!account) {
      setClaimMessage(t("正在同步黑钻账户，请稍后再试。", "Syncing your BD account. Please try again."));
      return;
    }
    if (account.dailyCollection.status === "claimed") {
      setClaimMessage(t("今天已经收集过黑钻了。", "Today's Black Diamond has already been collected."));
      return;
    }
    if (account.dailyCollection.status === "not_configured") {
      setClaimMessage(t("每日收集活动尚未开放。", "Daily collection is not open yet."));
      return;
    }
    if (account.dailyCollection.status === "unavailable" || !account.dailyCollection.canClaim) {
      setClaimMessage(t("今日收集暂不可用，请稍后再来。", "Collection is currently unavailable. Please try again later."));
      return;
    }

    setClaiming(true);
    setClaimMessage(null);
    try {
      const result = await claimDailyCollection();
      setAccount(result);
      setClaimMessage(
        t("收集成功 +", "Collected +") +
        formatBdBaseUnits(result.creditedBaseUnits) +
        " BD"
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "ALREADY_COLLECTED") {
        const refreshed = await getBdAccount().catch(() => null);
        if (refreshed) setAccount(refreshed);
        setClaimMessage(t("今天已经收集过黑钻了。", "Today's Black Diamond has already been collected."));
      } else if (error instanceof ApiError && error.code === "DAILY_COLLECTION_NOT_CONFIGURED") {
        setClaimMessage(t("每日收集活动尚未开放。", "Daily collection is not open yet."));
      } else if (error instanceof ApiError && error.code === "DAILY_BUDGET_EXHAUSTED") {
        setClaimMessage(t("今日奖励额度已用完。", "Today's reward budget has been used."));
      } else if (error instanceof ApiError && error.status === 401) {
        setShowLoginPrompt(true);
      } else {
        setClaimMessage(t("领取失败，请检查网络后重试。", "Collection failed. Check your connection and try again."));
      }
    } finally {
      setClaiming(false);
    }
  };

  const isClaimed = account?.dailyCollection.status === "claimed";
  const earthActionLabel = !isAuthenticated || isPreviewAccount
    ? t("登录后点击地球收集黑钻", "Sign in, then tap the Earth to collect")
    : accountLoading
      ? t("正在同步账户…", "Syncing account…")
      : claiming
        ? t("正在收集黑钻…", "Collecting Black Diamond…")
        : isClaimed
          ? t("今日已收集", "Collected today")
          : account?.dailyCollection.status === "not_configured"
            ? t("每日收集暂未开放", "Daily collection is not open yet")
            : account?.dailyCollection.status === "unavailable"
              ? t("今日暂不可收集", "Collection unavailable today")
              : t("点击地球，收集黑钻", "Tap the Earth to collect Black Diamond");

  const activityItems = [
    {
      key: "invite",
      title: t("邀请好友", "Invite friends"),
      description: t("邀请更多伙伴加入 BrightGlobe", "Bring more people into BrightGlobe"),
      onPress: () => requireLiveAccount(() => router.push("/invite"))
    },
    {
      key: "tasks",
      title: t("探索活动", "Explore activities"),
      description: t("发现社区中的活动与任务", "Discover community activities"),
      onPress: () => router.push("/(tabs)/tasks")
    }
  ];

  return (
    <AppScreen>
      <View style={styles.balanceHeader}>
        <Pressable accessibilityRole="button" onPress={openPoints} style={styles.balancePill}>
          <View style={styles.balanceGem} />
          <Text style={styles.balanceLabel}>{t("黑钻账户", "BD ACCOUNT")}</Text>
          <Text style={styles.balanceValue}>
            {isAuthenticated && !isPreviewAccount && account
              ? formatBdBaseUnits(account.account.availableBaseUnits)
              : "—"}
          </Text>
          <Text style={styles.balanceArrow}>›</Text>
        </Pressable>
        <Text style={styles.balanceHint}>{t("平台内部奖励记录", "Internal platform reward account")}</Text>
      </View>

      <View style={styles.productionStage}>
        <EarthBackground active={isHomeFocused} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("点击地球收集黑钻", "Tap the Earth to collect Black Diamond")}
          accessibilityHint={earthActionLabel}
          disabled={claiming || accountLoading}
          onPress={handleEarthTap}
          style={({ pressed }) => [styles.globeTapTarget, pressed && styles.globePressed]}
        />
        <View pointerEvents="none" style={styles.earthEyebrow}>
          <Text style={styles.earthEyebrowTitle}>{t("BRIGHTGLOBE", "BRIGHTGLOBE")}</Text>
          <Text style={styles.earthEyebrowText}>{t("探索世界 · 收集黑钻", "EXPLORE THE EARTH · COLLECT BD")}</Text>
        </View>
        <View pointerEvents="none" style={styles.earthInstruction}>
          <View style={styles.tapIndicator}><View style={styles.tapIndicatorDot} /></View>
          <Text style={styles.earthActionLabel}>{earthActionLabel}</Text>
          {claimMessage ? <Text style={styles.claimMessage}>{claimMessage}</Text> : null}
          {!claimMessage && accountError
            ? <Text style={styles.claimMessage}>{accountError}</Text>
            : null}
        </View>
        <View pointerEvents="none" style={styles.earthFootnote}>
          <Text style={styles.earthFootnoteText}>
            {t("每日收集资格与奖励额度以账户服务端状态为准", "Daily eligibility and reward limits are verified by the account service")}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityRail}>
        {activityItems.map((item) => (
          <Pressable key={item.key} accessibilityRole="button" onPress={item.onPress} style={styles.activityTile}>
            <Text style={styles.activityTitle}>{item.title}</Text>
            <Text style={styles.activityDescription}>{item.description}</Text>
            <Text style={styles.activityLink}>{t("进入", "Open")} ›</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.announcementRow}>
        <View style={styles.announcementCopy}>
          <Text style={styles.announcementEyebrow}>{t("星球公告", "PLANET NEWS")}</Text>
          <Text style={styles.announcementTitle}>
            {t("星球秉持共建精神中，欢迎试用并留下宝贵建议", "BrightGlobe is built together. Try the app and share your feedback.")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("查看公告列表", "View announcements")}
          onPress={() => router.push("/announcements")}
          style={styles.announcementAction}
        >
          <Text style={styles.announcementActionText}>{t("查看", "View")} ›</Text>
        </Pressable>
      </View>

      <Modal visible={showLoginPrompt} transparent animationType="fade" onRequestClose={() => setShowLoginPrompt(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.loginDialog}>
            <Text style={styles.dialogTitle}>{t("请先登录", "Sign in required")}</Text>
            <Text style={styles.dialogCopy}>
              {t(
                "登录后才能读取真实黑钻账户并申请每日收集。预览模式不会伪造余额或奖励。",
                "Sign in to read your real BD account and request a daily collection. Preview mode never fabricates balances or rewards."
              )}
            </Text>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setShowLoginPrompt(false)} style={styles.dialogSecondary}>
                <Text style={styles.dialogSecondaryText}>{t("暂不登录", "Not now")}</Text>
              </Pressable>
              <Pressable onPress={() => { setShowLoginPrompt(false); router.push("/login"); }} style={styles.dialogPrimary}>
                <Text style={styles.dialogPrimaryText}>{t("登录账户", "Sign in")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  balanceHeader: { marginTop: 8, marginBottom: 12, alignItems: "flex-start", gap: 4 },
  balancePill: {
    minWidth: 190,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8DCE2",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8
  },
  balanceGem: {
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: "#535B66",
    transform: [{ rotate: "45deg" }]
  },
  balanceLabel: { color: "#727985", fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  balanceValue: { color: "#303843", fontSize: 12, fontWeight: "800", flex: 1, textAlign: "right" },
  balanceArrow: { color: "#A0A7B2", fontSize: 17 },
  balanceHint: { color: "#A0A7B2", fontSize: 7, marginLeft: 12 },
  productionStage: {
    height: 390,
    position: "relative",
    backgroundColor: "#030C1A",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 2,
    marginBottom: 12
  },
  globeTapTarget: {
    position: "absolute",
    top: 42,
    width: "82%",
    maxWidth: 310,
    height: 310,
    alignSelf: "center",
    borderRadius: 160,
    backgroundColor: "transparent",
    zIndex: 1
  },
  globePressed: { backgroundColor: "rgba(109, 181, 255, 0.055)" },
  earthEyebrow: { position: "absolute", left: 17, top: 17, zIndex: 3, gap: 5 },
  earthEyebrowTitle: { color: "#EAF4FF", fontSize: 11, fontWeight: "900", letterSpacing: 1.8 },
  earthEyebrowText: { color: "#8FAFCF", fontSize: 7, fontWeight: "700", letterSpacing: 1.1 },
  earthInstruction: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 29,
    alignItems: "center",
    zIndex: 3,
    gap: 5
  },
  tapIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(185, 220, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center"
  },
  tapIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D9EEFF"
  },
  earthActionLabel: { color: "#E9F4FF", fontSize: 11, fontWeight: "700", textAlign: "center" },
  claimMessage: { color: "#A9D1F8", fontSize: 9, textAlign: "center" },
  earthFootnote: { position: "absolute", bottom: 8, left: 8, right: 8, alignItems: "center", zIndex: 3 },
  earthFootnoteText: { color: "rgba(145, 178, 211, 0.72)", fontSize: 6, textAlign: "center" },
  activityRail: { gap: 10, paddingHorizontal: 2, paddingBottom: 8, alignItems: "flex-start" },
  announcementRow: {
    minHeight: 58,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E4E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 3
  },
  announcementCopy: { flex: 1, gap: 4 },
  announcementEyebrow: { color: "#9AA2AC", fontSize: 7, fontWeight: "800", letterSpacing: 1 },
  announcementTitle: { color: "#66707C", fontSize: 8, lineHeight: 13 },
  announcementAction: { minWidth: 50, height: 27, borderRadius: 14, borderWidth: 1, borderColor: "#D5DAE1", alignItems: "center", justifyContent: "center" },
  announcementActionText: { color: "#66707C", fontSize: 8, fontWeight: "700" },
  activityTile: {
    width: 158,
    minHeight: 72,
    borderRadius: 10,
    backgroundColor: "#F4F5F7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "space-between",
    gap: 6
  },
  activityTitle: { color: "#3D4550", fontSize: 10, fontWeight: "700" },
  activityDescription: { color: "#9299A4", fontSize: 8 },
  activityLink: { color: "#58616D", fontSize: 8, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center", padding: 28 },
  loginDialog: { width: "100%", maxWidth: 320, borderRadius: 12, backgroundColor: "#FFFFFF", padding: 20, alignItems: "center" },
  dialogTitle: { color: "#303843", fontSize: 15, fontWeight: "700" },
  dialogCopy: { color: "#78818D", fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 12 },
  dialogActions: { flexDirection: "row", gap: 9, width: "100%", marginTop: 18 },
  dialogSecondary: { flex: 1, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#CBD0D7", justifyContent: "center", alignItems: "center" },
  dialogSecondaryText: { color: "#727985", fontSize: 9 },
  dialogPrimary: { flex: 1, height: 36, borderRadius: 18, backgroundColor: "#394554", justifyContent: "center", alignItems: "center" },
  dialogPrimaryText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" }
});
