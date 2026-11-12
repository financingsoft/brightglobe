import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { useI18n } from "@/i18n/locale";

type ScreenKind = "shopping" | "games" | "entertainment" | "reading" | "news" | "comics" | "music" | "bidding" | "treasure" | "finance" | "wellness";

function PageHeader({ title, onBack, onClose }: { title: string; onBack: () => void; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.headerAction}><Text style={styles.backGlyph}>‹</Text></Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <Pressable onPress={onClose} style={styles.headerAction}><Text style={styles.closeGlyph}>×</Text></Pressable>
    </View>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return <View style={styles.searchBar}><Text style={styles.searchGlyph}>⌕</Text><Text style={styles.searchPlaceholder}>{placeholder}</Text></View>;
}

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { locale } = useI18n();
  const router = useRouter();
  const [competitionTab, setCompetitionTab] = useState<"active" | "ended">("active");
  const t = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const names: Record<ScreenKind, [string, string]> = {
    shopping: ["购物", "Shopping"],
    games: ["游戏中心", "Game center"],
    entertainment: ["娱乐", "Entertainment"],
    reading: ["小说", "Reading"],
    news: ["资讯", "News"],
    comics: ["漫画", "Comics"],
    music: ["网易云音乐", "NetEase Cloud Music"],
    bidding: ["竞猜", "Competition"],
    treasure: ["挖宝", "Treasure hunt"],
    finance: ["来钱", "Finance"],
    wellness: ["健康", "Wellness"]
  };
  const allowed: ScreenKind[] = ["shopping", "games", "entertainment", "reading", "news", "comics", "music", "bidding", "treasure", "finance", "wellness"];
  const key: ScreenKind = typeof category === "string" && allowed.includes(category as ScreenKind) ? category as ScreenKind : "shopping";
  const title = t(names[key][0], names[key][1]);
  const openActivity = (name: string) => router.push({ pathname: "/activity", params: { title: name } });
  const go = (next: ScreenKind) => router.push({ pathname: "/category", params: { category: next } });

  const renderEntertainment = () => (
    <View style={styles.content}>
      <View style={styles.entertainmentGrid}>
        {[
          { key: "reading" as const, glyph: "▤", zh: "小说", en: "Reading" },
          { key: "comics" as const, glyph: "▧", zh: "漫画", en: "Comics" },
          { key: "news" as const, glyph: "▥", zh: "新闻", en: "News" },
          { key: "music" as const, glyph: "♫", zh: "音乐", en: "Music" }
        ].map((item) => (
          <Pressable key={item.zh} style={styles.entertainmentItem} onPress={() => go(item.key)}>
            <View style={styles.entertainmentIcon}><Text style={styles.entertainmentGlyph}>{item.glyph}</Text></View>
            <Text style={styles.entertainmentLabel}>{t(item.zh, item.en)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.featureBanner}>
        <Text style={styles.bannerCaption}>{t("精选内容", "FEATURED CONTENT")}</Text>
        <Text style={styles.bannerTitle}>{t("发现值得阅读与分享的内容", "Discover stories worth reading and sharing")}</Text>
        <Text style={styles.bannerSub}>{t("小说 · 漫画 · 资讯 · 音乐", "Reading · Comics · News · Music")}</Text>
      </View>
      <SectionTitle title={t("为你推荐", "Recommended")} />
      {["热门小说", "精选漫画", "今日资讯"].map((item) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.simpleRow}><Text style={styles.simpleIcon}>◇</Text><Text style={styles.simpleTitle}>{t(item, item)}</Text><Text style={styles.chevron}>›</Text></Pressable>
      ))}
    </View>
  );

  const renderShopping = () => (
    <View style={styles.content}>
      <SearchBar placeholder={t("输入商品名称", "Search products")} />
      <View style={styles.channelTabs}>
        {[["淘宝", "Taobao"], ["考拉", "Kaola"], ["严选", "NetEase Select"]].map(([zh, en], i) => <Text key={zh} style={[styles.channelTab, i === 0 && styles.channelTabActive]}>{t(zh, en)}</Text>)}
      </View>
      <View style={styles.shopCategories}>
        {["女装", "男装", "内衣", "美妆", "配饰", "鞋品", "居家", "数码"].map((item, i) => (
          <Pressable key={item} style={styles.shopCategory} onPress={() => openActivity(item)}>
            <View style={[styles.shopCategoryIcon, i % 2 === 0 ? styles.thumbCool : styles.thumbWarm]}><Text style={styles.shopCategoryGlyph}>{["♧", "◇", "○", "✧", "⌁", "◈", "⌂", "▣"][i]}</Text></View>
            <Text style={styles.shopCategoryLabel}>{t(item, ["Women", "Men", "Underwear", "Beauty", "Accessories", "Shoes", "Home", "Digital"][i])}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle title={t("精选推荐", "Featured picks")} />
      {["每日精选好物", "人气品牌优惠", "会员专属权益"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.productRow}>
          <View style={[styles.productThumb, i % 2 === 0 ? styles.thumbCool : styles.thumbWarm]}><Text style={styles.productGlyph}>◇</Text></View>
          <View style={styles.productCopy}><Text style={styles.productTitle}>{t(item, ["Daily picks", "Popular brand offers", "Member benefits"][i])}</Text><Text style={styles.productDescription}>{t("精选内容与优惠信息", "Selected offers and information")}</Text><Text style={styles.productPrice}>{t("活动详情 ›", "View details ›")}</Text></View>
        </Pressable>
      ))}
    </View>
  );

  const renderGames = () => (
    <View style={styles.content}>
      <View style={styles.gameBanner}>
        <Text style={styles.bannerCaption}>{t("网易游戏", "NETEASE GAMES")}</Text>
        <Text style={styles.bannerTitle}>{t("发现好玩的游戏", "Discover games to play")}</Text>
        <Text style={styles.bannerSub}>{t("精选游戏与社区互动", "Selected games and community activities")}</Text>
      </View>
      <View style={styles.channelTabs}>
        {[["网游", "Online"], ["小游戏", "Mini games"], ["收藏", "Saved"]].map(([zh, en], i) => <Text key={zh} style={[styles.channelTab, i === 0 && styles.channelTabActive]}>{t(zh, en)}</Text>)}
      </View>
      {["精选游戏挑战", "社区小游戏", "本周人气游戏"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.gameRow}>
          <View style={[styles.gameThumb, i % 2 === 0 ? styles.thumbCool : styles.thumbWarm]}><Text style={styles.gameGlyph}>{["✣", "◉", "★"][i]}</Text></View>
          <View style={styles.gameCopy}><Text style={styles.productTitle}>{t(item, ["Featured game challenges", "Community mini games", "Popular games this week"][i])}</Text><Text style={styles.productDescription}>{t("游戏介绍与参与方式", "Game details and participation")}</Text><Text style={styles.gameMeta}>★★★★★　{t("人气推荐", "Popular")}</Text></View>
          <Text style={styles.openButton}>{t("开启", "Open")}</Text>
        </Pressable>
      ))}
    </View>
  );

  const renderReading = () => (
    <View style={styles.content}>
      <View style={styles.channelTabs}>
        {["男频", "女频", "出版", "分类", "免费", "排行"].map((item, i) => <Text key={item} style={[styles.channelTab, i === 0 && styles.channelTabActive]}>{t(item, ["Men", "Women", "Books", "Genres", "Free", "Rank"][i])}</Text>)}
      </View>
      <SearchBar placeholder={t("输入书名或作者", "Search title or author")} />
      <View style={styles.featureBanner}>
        <Text style={styles.bannerCaption}>{t("精选书单", "EDITOR'S PICKS")}</Text>
        <Text style={styles.bannerTitle}>{t("海量免费小说、图书", "Books and stories to discover")}</Text>
        <Text style={styles.bannerSub}>{t("发现下一本值得阅读的作品", "Find your next great read")}</Text>
      </View>
      <SectionTitle title={t("阅读历史", "Reading history")} action={t("我的书架", "My shelf")} />
      <View style={styles.bookRow}>
        {["山海经异闻", "星际旅人", "世界尽头"].map((item, i) => <Pressable key={item} onPress={() => openActivity(item)} style={styles.bookCard}><View style={[styles.bookCover, i % 2 === 0 ? styles.thumbCool : styles.thumbWarm]}><Text style={styles.bookCoverGlyph}>▤</Text></View><Text style={styles.bookTitle}>{t(item, ["Legends", "Stellar traveler", "The edge of the world"][i])}</Text><Text style={styles.bookAuthor}>{t("精选作者", "Featured author")}</Text></Pressable>)}
      </View>
      <SectionTitle title={t("人气推荐", "Popular reads")} />
      {["今日热门作品", "编辑精选", "新书上架"].map(item => <Pressable key={item} onPress={() => openActivity(item)} style={styles.simpleRow}><Text style={styles.simpleIcon}>▤</Text><Text style={styles.simpleTitle}>{t(item, item)}</Text><Text style={styles.chevron}>›</Text></Pressable>)}
    </View>
  );

  const renderNews = () => (
    <View style={styles.content}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsTabs}>
        {["推荐", "头条", "视频", "体育", "娱乐", "区块链", "财经", "科技"].map((item, i) => <Text key={item} style={[styles.newsTab, i === 0 && styles.newsTabActive]}>{t(item, ["Top", "Headlines", "Video", "Sports", "Entertainment", "Web3", "Finance", "Tech"][i])}</Text>)}
      </ScrollView>
      <SearchBar placeholder={t("搜索新闻", "Search news")} />
      {["全球科技动态", "人工智能产业观察", "社区精选观点", "今日热点追踪"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.newsRow}>
          <View style={[styles.newsThumb, i % 2 === 0 ? styles.thumbCool : styles.thumbWarm]}><Text style={styles.newsGlyph}>▧</Text></View>
          <View style={styles.newsCopy}><Text style={styles.newsTitle}>{t(item, ["Global technology update", "AI industry watch", "Community perspectives", "Today's top stories"][i])}</Text><Text style={styles.newsDescription}>{t("精选资讯摘要与内容介绍，点击查看完整内容。", "Selected news summary and story details.")}</Text><Text style={styles.newsMeta}>BrightGlobe　{t("刚刚", "Just now")}</Text></View>
        </Pressable>
      ))}
    </View>
  );

  const renderComics = () => (
    <View style={styles.content}>
      <View style={styles.featureBanner}>
        <Text style={styles.bannerCaption}>{t("精品漫画", "FEATURED COMICS")}</Text>
        <Text style={styles.bannerTitle}>{t("海量精品动漫 / 漫画", "Discover comics and illustrated stories")}</Text>
        <Text style={styles.bannerSub}>{t("优质作品持续更新", "New stories updated regularly")}</Text>
      </View>
      <SearchBar placeholder={t("搜索漫画", "Search comics")} />
      <View style={styles.channelTabs}>
        {["推荐", "热血", "恋爱", "悬疑", "奇幻"].map((item, i) => <Text key={item} style={[styles.channelTab, i === 0 && styles.channelTabActive]}>{t(item, ["Top", "Action", "Romance", "Mystery", "Fantasy"][i])}</Text>)}
      </View>
      {["本周人气漫画", "编辑精选作品", "最新连载"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.comicRow}>
          <View style={[styles.comicThumb, i % 2 === 0 ? styles.thumbCool : styles.thumbWarm]}><Text style={styles.comicGlyph}>▧</Text></View>
          <View style={styles.productCopy}><Text style={styles.productTitle}>{t(item, ["Popular comics", "Editor's picks", "Latest series"][i])}</Text><Text style={styles.productDescription}>{t("作品简介与作者信息", "Story description and creator")}</Text><Text style={styles.productPrice}>{t("连载中", "Ongoing")}</Text></View>
        </Pressable>
      ))}
    </View>
  );

  const renderMusic = () => (
    <View style={styles.content}>
      <View style={styles.featureBanner}>
        <Text style={styles.bannerCaption}>NETEASE CLOUD MUSIC</Text>
        <Text style={styles.bannerTitle}>{t("音乐，让生活更有温度", "Music for every moment")}</Text>
        <Text style={styles.bannerSub}>{t("发现歌单与精选音乐", "Explore playlists and selected music")}</Text>
      </View>
      <SearchBar placeholder={t("搜索歌曲、歌单或歌手", "Search songs, playlists, or artists")} />
      <View style={styles.channelTabs}>
        {["推荐", "歌单", "排行榜", "电台"].map((item, i) => <Text key={item} style={[styles.channelTab, i === 0 && styles.channelTabActive]}>{t(item, ["Top", "Playlists", "Charts", "Radio"][i])}</Text>)}
      </View>
      <SectionTitle title={t("推荐歌单", "Recommended playlists")} action={t("更多", "More")} />
      <View style={styles.bookRow}>
        {["每日精选", "独立音乐", "轻松时刻"].map((item, i) => <Pressable key={item} onPress={() => openActivity(item)} style={styles.bookCard}><View style={[styles.bookCover, i % 2 === 0 ? styles.thumbCool : styles.thumbWarm]}><Text style={styles.bookCoverGlyph}>♫</Text></View><Text style={styles.bookTitle}>{t(item, ["Daily mix", "Indie music", "Easy listening"][i])}</Text><Text style={styles.bookAuthor}>{t("精选歌单", "Featured playlist")}</Text></Pressable>)}
      </View>
      <SectionTitle title={t("热门推荐", "Popular")} />
      {["新歌推荐", "经典回顾", "音乐专题"].map(item => <Pressable key={item} onPress={() => openActivity(item)} style={styles.simpleRow}><Text style={styles.simpleIcon}>♫</Text><Text style={styles.simpleTitle}>{t(item, item)}</Text><Text style={styles.chevron}>›</Text></Pressable>)}
    </View>
  );

  const renderBidding = () => (
    <View style={styles.content}>
      <View style={styles.featureBanner}>
        <Text style={styles.bannerCaption}>{t("体育赛事竞猜", "SPORTS CHALLENGE")}</Text>
        <Text style={styles.bannerTitle}>{t("参与竞猜互动", "Join the community challenge")}</Text>
        <Text style={styles.bannerSub}>{t("活动规则与参与说明", "Rules and participation details")}</Text>
        <Pressable onPress={() => openActivity(t("竞猜规则", "Challenge rules"))} style={styles.bannerAction}><Text style={styles.bannerActionText}>{t("详细规则", "Rules")} ›</Text></Pressable>
      </View>
      <View style={styles.toggleTabs}>
        <Pressable onPress={() => setCompetitionTab("active")} style={[styles.toggleTab, competitionTab === "active" && styles.toggleActive]}><Text style={[styles.toggleText, competitionTab === "active" && styles.toggleTextActive]}>{t("未完赛", "Ongoing")}</Text></Pressable>
        <Pressable onPress={() => setCompetitionTab("ended")} style={[styles.toggleTab, competitionTab === "ended" && styles.toggleActive]}><Text style={[styles.toggleText, competitionTab === "ended" && styles.toggleTextActive]}>{t("已完赛", "Completed")}</Text></Pressable>
      </View>
      <View style={styles.matchCard}>
        <Text style={styles.matchTitle}>{competitionTab === "active" ? t("本周社区竞猜活动", "This week's community challenge") : t("上期活动结果", "Previous challenge results")}</Text>
        <Text style={styles.matchMeta}>{t("活动时间与参与条件以页面规则为准", "See activity rules for timing and eligibility")}</Text>
        <View style={styles.matchTeams}><Text style={styles.team}>TEAM A</Text><Text style={styles.vs}>VS</Text><Text style={styles.team}>TEAM B</Text></View>
        <Pressable onPress={() => openActivity(t("竞猜参与详情", "Challenge details"))} style={styles.bannerAction}><Text style={styles.bannerActionText}>{t("查看详情", "View details")} ›</Text></Pressable>
      </View>
    </View>
  );

  const renderTreasure = () => (
    <View style={styles.content}>
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>{t("挖宝游戏规则", "Treasure hunt rules")}</Text>
        <Text style={styles.rulesText}>{t("完成指定任务解锁矿区，按照活动规则参与探索。", "Complete selected missions to unlock a zone and explore under the event rules.")}</Text>
        <Text style={styles.rulesText}>{t("奖励内容及参与资格以正式活动规则为准。", "Rewards and eligibility are subject to the published rules.")}</Text>
      </View>
      {[1, 2, 3].map((item) => (
        <View key={item} style={styles.mineZone}>
          <Text style={styles.zoneLock}>♙</Text>
          <View style={styles.zoneCopy}><Text style={styles.zoneTitle}>{t(`${item}号矿区`, `Zone ${item}`)}</Text><Text style={styles.zoneDescription}>{t(item === 1 ? "完成基础任务即可解锁" : "达到指定贡献条件后解锁", item === 1 ? "Complete the starter mission to unlock" : "Unlock after meeting contribution requirements")}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: item === 1 ? "52%" : "0%" }]} /></View></View>
          <Text style={styles.zoneState}>{item === 1 ? t("进行中", "Active") : t("未解锁", "Locked")}</Text>
        </View>
      ))}
    </View>
  );

  const renderUnavailable = () => (
    <View style={styles.unavailable}><Text style={styles.unavailableGlyph}>◇</Text><Text style={styles.unavailableTitle}>{t("服务暂未开放", "Not available yet")}</Text><Text style={styles.unavailableText}>{t("该分类保留原产品入口层级，BrightGlobe 暂未接入对应服务。", "This category is retained from the reference structure; BrightGlobe has not connected a corresponding service.")}</Text></View>
  );

  return (
    <AppScreen>
      <PageHeader title={title} onBack={() => router.back()} onClose={() => router.replace("/(tabs)")} />
      {key === "shopping" ? renderShopping()
        : key === "games" ? renderGames()
        : key === "entertainment" ? renderEntertainment()
        : key === "reading" ? renderReading()
        : key === "news" ? renderNews()
        : key === "comics" ? renderComics()
        : key === "music" ? renderMusic()
        : key === "bidding" ? renderBidding()
        : key === "treasure" ? renderTreasure()
        : renderUnavailable()}
    </AppScreen>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>{title}</Text>{action ? <Text style={styles.sectionAction}>{action} ›</Text> : null}</View>;
}

const styles = StyleSheet.create({
  header: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#DDDDDD", marginBottom: 7 },
  headerAction: { width: 28, height: 34, justifyContent: "center" }, backGlyph: { color: "#333333", fontSize: 27, lineHeight: 30 }, closeGlyph: { color: "#555555", fontSize: 24, lineHeight: 27, textAlign: "right" },
  headerTitle: { color: "#333333", fontSize: 13, fontWeight: "600", flex: 1, textAlign: "center" },
  content: { flex: 1 },
  searchBar: { height: 29, borderWidth: 1, borderColor: "#DCDCDC", borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, marginTop: 5, marginBottom: 7 },
  searchGlyph: { color: "#999999", fontSize: 15, marginRight: 6 }, searchPlaceholder: { color: "#A0A0A0", fontSize: 8 },
  channelTabs: { flexDirection: "row", minHeight: 31, alignItems: "center", justifyContent: "space-around", borderBottomWidth: 1, borderColor: "#E5E5E5" },
  channelTab: { color: "#888888", fontSize: 8, paddingVertical: 8 }, channelTabActive: { color: "#333333", fontWeight: "700", borderBottomWidth: 2, borderBottomColor: "#555555" },
  shopCategories: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 7, borderBottomWidth: 1, borderColor: "#E7E7E7" },
  shopCategory: { width: "25%", alignItems: "center", paddingVertical: 5, gap: 4 },
  shopCategoryIcon: { width: 33, height: 33, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  shopCategoryGlyph: { color: "#FFFFFF", fontSize: 17 }, shopCategoryLabel: { color: "#666666", fontSize: 7 },
  thumbCool: { backgroundColor: "#66AFC7" }, thumbWarm: { backgroundColor: "#CF9569" },
  sectionHeading: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#E5E5E5" },
  sectionHeadingText: { color: "#444444", fontSize: 9, fontWeight: "700" }, sectionAction: { color: "#888888", fontSize: 7 },
  productRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderColor: "#EAEAEA", paddingVertical: 6 },
  productThumb: { width: 60, height: 60, alignItems: "center", justifyContent: "center" }, productGlyph: { color: "#FFFFFF", fontSize: 25 },
  productCopy: { flex: 1, gap: 4 }, productTitle: { color: "#444444", fontSize: 9, fontWeight: "700" }, productDescription: { color: "#999999", fontSize: 7 }, productPrice: { color: "#777777", fontSize: 7 },
  gameBanner: { minHeight: 112, backgroundColor: "#4E9CC0", justifyContent: "center", padding: 13, gap: 5 },
  bannerCaption: { color: "rgba(255,255,255,0.82)", fontSize: 6, letterSpacing: 1, fontWeight: "700" }, bannerTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }, bannerSub: { color: "rgba(255,255,255,0.85)", fontSize: 7 },
  gameRow: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderColor: "#E8E8E8" },
  gameThumb: { width: 54, height: 54, borderRadius: 9, justifyContent: "center", alignItems: "center" }, gameGlyph: { color: "#FFFFFF", fontSize: 23 },
  gameCopy: { flex: 1, gap: 4 }, gameMeta: { color: "#A0A0A0", fontSize: 7 }, openButton: { borderWidth: 1, borderColor: "#AAAAAA", borderRadius: 13, paddingHorizontal: 11, paddingVertical: 5, color: "#666666", fontSize: 7 },
  featureBanner: { minHeight: 111, backgroundColor: "#5F9FC0", justifyContent: "center", padding: 13, gap: 5, marginVertical: 6 },
  bannerAction: { alignSelf: "flex-start", marginTop: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.85)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  bannerActionText: { color: "#FFFFFF", fontSize: 7 },
  entertainmentGrid: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E5E5E5", paddingVertical: 9 },
  entertainmentItem: { flex: 1, alignItems: "center", gap: 5 },
  entertainmentIcon: { width: 33, height: 33, borderRadius: 17, backgroundColor: "#F0F0F0", justifyContent: "center", alignItems: "center" }, entertainmentGlyph: { color: "#555555", fontSize: 17 }, entertainmentLabel: { color: "#666666", fontSize: 7 },
  simpleRow: { minHeight: 40, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "#E9E9E9", gap: 8 }, simpleIcon: { color: "#777777", fontSize: 16, width: 22 }, simpleTitle: { color: "#555555", flex: 1, fontSize: 8 }, chevron: { color: "#999999", fontSize: 17 },
  newsTabs: { gap: 14, alignItems: "center", paddingHorizontal: 5 }, newsTab: { color: "#888888", fontSize: 8, paddingVertical: 8 }, newsTabActive: { color: "#333333", fontWeight: "700" },
  newsRow: { minHeight: 81, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "#E9E9E9", gap: 8, paddingVertical: 7 },
  newsThumb: { width: 80, height: 58, alignItems: "center", justifyContent: "center" }, newsGlyph: { color: "#FFFFFF", fontSize: 23 },
  newsCopy: { flex: 1, gap: 5 }, newsTitle: { color: "#454545", fontSize: 8, fontWeight: "700" }, newsDescription: { color: "#999999", fontSize: 7, lineHeight: 11 }, newsMeta: { color: "#AAAAAA", fontSize: 6 },
  comicRow: { minHeight: 83, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderColor: "#E8E8E8", paddingVertical: 7 },
  comicThumb: { width: 58, height: 66, alignItems: "center", justifyContent: "center" }, comicGlyph: { color: "#FFFFFF", fontSize: 22 },
  bookRow: { flexDirection: "row", gap: 12, paddingVertical: 9 }, bookCard: { width: 84, gap: 4 }, bookCover: { height: 96, alignItems: "center", justifyContent: "center" }, bookCoverGlyph: { color: "#FFFFFF", fontSize: 23 }, bookTitle: { color: "#555555", fontSize: 7, fontWeight: "600" }, bookAuthor: { color: "#999999", fontSize: 6 },
  toggleTabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E3E3E3", marginTop: 8 }, toggleTab: { flex: 1, alignItems: "center", paddingVertical: 9 }, toggleActive: { borderBottomColor: "#555555", borderBottomWidth: 2 }, toggleText: { color: "#999999", fontSize: 8 }, toggleTextActive: { color: "#444444", fontWeight: "700" },
  matchCard: { marginTop: 10, borderWidth: 1, borderColor: "#E0E0E0", padding: 11, gap: 8 }, matchTitle: { color: "#444444", fontSize: 9, fontWeight: "700" }, matchMeta: { color: "#999999", fontSize: 7 }, matchTeams: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 9, backgroundColor: "#F3F3F3" }, team: { color: "#555555", fontSize: 9, fontWeight: "700" }, vs: { color: "#999999", fontSize: 8 },
  rulesCard: { borderWidth: 1, borderColor: "#DDDDDD", borderRadius: 5, padding: 12, marginTop: 8, gap: 7 }, rulesTitle: { color: "#444444", fontSize: 9, fontWeight: "700" }, rulesText: { color: "#888888", fontSize: 7, lineHeight: 12 },
  mineZone: { minHeight: 67, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "#E6E6E6", gap: 10 }, zoneLock: { width: 36, textAlign: "center", color: "#555555", fontSize: 23 }, zoneCopy: { flex: 1, gap: 4 }, zoneTitle: { color: "#444444", fontSize: 9, fontWeight: "700" }, zoneDescription: { color: "#999999", fontSize: 7 }, progressTrack: { height: 5, backgroundColor: "#EEEEEE", overflow: "hidden" }, progressFill: { height: 5, backgroundColor: "#888888" }, zoneState: { color: "#999999", fontSize: 7 },
  unavailable: { alignItems: "center", paddingVertical: 48, gap: 9 }, unavailableGlyph: { color: "#999999", fontSize: 29 }, unavailableTitle: { color: "#555555", fontSize: 11, fontWeight: "700" }, unavailableText: { color: "#999999", fontSize: 8, textAlign: "center", lineHeight: 13, marginHorizontal: 15 }
});