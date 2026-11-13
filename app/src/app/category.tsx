import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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

function WireframeImage({ width, height, cover = false }: { width?: number; height: number; cover?: boolean }) {
  const canvasWidth = width ?? 320;
  return (
    <View style={[styles.wireframeImage, { height }, width ? { width } : styles.wireframeStretch, cover && styles.wireframeCover]}>
      <View style={{ position: "absolute", top: height * 0.16, right: canvasWidth * 0.2, width: height * 0.09, height: height * 0.09, borderRadius: height * 0.05, backgroundColor: "rgba(107, 128, 161, 0.38)" }} />
      <View style={{ position: "absolute", bottom: -height * 0.08, left: -canvasWidth * 0.12, width: 0, height: 0, borderLeftWidth: canvasWidth * 0.34, borderRightWidth: canvasWidth * 0.34, borderBottomWidth: height * 0.62, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#69B3D5" }} />
      <View style={{ position: "absolute", bottom: -height * 0.1, right: -canvasWidth * 0.13, width: 0, height: 0, borderLeftWidth: canvasWidth * 0.38, borderRightWidth: canvasWidth * 0.38, borderBottomWidth: height * 0.48, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#318FC0" }} />
    </View>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  const [query, setQuery] = useState("");
  return (
    <View style={styles.searchBar}>
      <Text style={styles.searchGlyph}>⌕</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder={placeholder} placeholderTextColor="#A0A0A0" style={styles.searchInput} returnKeyType="search" />
    </View>
  );
}

function ChannelTabs({ items, active, onSelect }: { items: { key: string; label: string }[]; active: string; onSelect: (key: string) => void }) {
  return (
    <View style={styles.channelTabs}>
      {items.map((item) => (
        <Pressable key={item.key} onPress={() => onSelect(item.key)} style={[styles.channelTabButton, active === item.key && styles.channelTabButtonActive]}>
          <Text style={[styles.channelTab, active === item.key && styles.channelTabActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { locale } = useI18n();
  const router = useRouter();
  const [competitionTab, setCompetitionTab] = useState<"active" | "ended">("active");
  const [shopChannel, setShopChannel] = useState("taobao");
  const [gameChannel, setGameChannel] = useState("online");
  const [readingChannel, setReadingChannel] = useState("male");
  const [newsChannel, setNewsChannel] = useState("recommend");
  const [comicsChannel, setComicsChannel] = useState("featured");
  const [musicChannel, setMusicChannel] = useState("featured");
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
        <WireframeImage height={111} cover />
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
      <ChannelTabs active={shopChannel} onSelect={setShopChannel} items={[
        { key: "taobao", label: t("淘宝", "Taobao") },
        { key: "kaola", label: t("考拉", "Kaola") },
        { key: "select", label: t("严选", "NetEase Select") }
      ]} />
      <View style={styles.shopCategories}>
        {["女装", "男装", "内衣", "美妆", "配饰", "鞋品", "居家", "数码"].map((item, i) => (
          <Pressable key={item} style={styles.shopCategory} onPress={() => openActivity(item)}>
            <WireframeImage width={37} height={28} />
            <Text style={styles.shopCategoryLabel}>{t(item, ["Women", "Men", "Underwear", "Beauty", "Accessories", "Shoes", "Home", "Digital"][i])}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle title={t("精选推荐", "Featured picks")} />
      {["每日精选好物", "人气品牌优惠", "会员专属权益"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.productRow}>
          <WireframeImage width={60} height={60} />
          <View style={styles.productCopy}><Text style={styles.productTitle}>{t(item, ["Daily picks", "Popular brand offers", "Member benefits"][i])}</Text><Text style={styles.productDescription}>{t("精选内容与优惠信息", "Selected offers and information")}</Text><Text style={styles.productPrice}>{t("活动详情 ›", "View details ›")}</Text></View>
        </Pressable>
      ))}
    </View>
  );

  const renderGames = () => (
    <View style={styles.content}>
      <View style={styles.gameBanner}>
        <WireframeImage height={112} cover />
        <Text style={styles.bannerCaption}>{t("网易游戏", "NETEASE GAMES")}</Text>
        <Text style={styles.bannerTitle}>{t("发现好玩的游戏", "Discover games to play")}</Text>
        <Text style={styles.bannerSub}>{t("精选游戏与社区互动", "Selected games and community activities")}</Text>
      </View>
      <ChannelTabs active={gameChannel} onSelect={setGameChannel} items={[
        { key: "online", label: t("网游", "Online") },
        { key: "mini", label: t("小游戏", "Mini games") },
        { key: "saved", label: t("收藏", "Saved") }
      ]} />
      {["精选游戏挑战", "社区小游戏", "本周人气游戏"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.gameRow}>
          <WireframeImage width={54} height={54} />
          <View style={styles.gameCopy}><Text style={styles.productTitle}>{t(item, ["Featured game challenges", "Community mini games", "Popular games this week"][i])}</Text><Text style={styles.productDescription}>{t("游戏介绍与参与方式", "Game details and participation")}</Text><Text style={styles.gameMeta}>★★★★★　{t("人气推荐", "Popular")}</Text></View>
          <Text style={styles.openButton}>{t("开启", "Open")}</Text>
        </Pressable>
      ))}
    </View>
  );

  const renderReading = () => (
    <View style={styles.content}>
      <ChannelTabs active={readingChannel} onSelect={setReadingChannel} items={[
        { key: "male", label: t("男频", "Men") },
        { key: "female", label: t("女频", "Women") },
        { key: "books", label: t("出版", "Books") },
        { key: "genres", label: t("分类", "Genres") },
        { key: "free", label: t("免费", "Free") },
        { key: "rank", label: t("排行", "Rank") }
      ]} />
      <SearchBar placeholder={t("输入书名或作者", "Search title or author")} />
      <View style={styles.featureBanner}>
        <WireframeImage height={111} cover />
        <Text style={styles.bannerCaption}>{t("精选书单", "EDITOR'S PICKS")}</Text>
        <Text style={styles.bannerTitle}>{t("海量免费小说、图书", "Books and stories to discover")}</Text>
        <Text style={styles.bannerSub}>{t("发现下一本值得阅读的作品", "Find your next great read")}</Text>
      </View>
      <SectionTitle title={t("阅读历史", "Reading history")} action={t("我的书架", "My shelf")} />
      <View style={styles.bookRow}>
        {["山海经异闻", "星际旅人", "世界尽头"].map((item, i) => <Pressable key={item} onPress={() => openActivity(item)} style={styles.bookCard}><WireframeImage width={84} height={96} /><Text style={styles.bookTitle}>{t(item, ["Legends", "Stellar traveler", "The edge of the world"][i])}</Text><Text style={styles.bookAuthor}>{t("精选作者", "Featured author")}</Text></Pressable>)}
      </View>
      <SectionTitle title={t("人气推荐", "Popular reads")} />
      {["今日热门作品", "编辑精选", "新书上架"].map(item => <Pressable key={item} onPress={() => openActivity(item)} style={styles.simpleRow}><Text style={styles.simpleIcon}>▤</Text><Text style={styles.simpleTitle}>{t(item, item)}</Text><Text style={styles.chevron}>›</Text></Pressable>)}
    </View>
  );

  const renderNews = () => (
    <View style={styles.content}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newsTabs}>
        {[
          ["recommend", "推荐", "Top"], ["headlines", "头条", "Headlines"], ["video", "视频", "Video"],
          ["sports", "体育", "Sports"], ["entertainment", "娱乐", "Entertainment"], ["web3", "区块链", "Web3"],
          ["finance", "财经", "Finance"], ["tech", "科技", "Tech"]
        ].map(([key, zh, en]) => (
          <Pressable key={key} onPress={() => setNewsChannel(key)} style={[styles.newsTabButton, newsChannel === key && styles.newsTabButtonActive]}>
            <Text style={[styles.newsTab, newsChannel === key && styles.newsTabActive]}>{t(zh, en)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <SearchBar placeholder={t("搜索新闻", "Search news")} />
      {["全球科技动态", "人工智能产业观察", "社区精选观点", "今日热点追踪"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.newsRow}>
          <WireframeImage width={80} height={58} />
          <View style={styles.newsCopy}><Text style={styles.newsTitle}>{t(item, ["Global technology update", "AI industry watch", "Community perspectives", "Today's top stories"][i])}</Text><Text style={styles.newsDescription}>{t("精选资讯摘要与内容介绍，点击查看完整内容。", "Selected news summary and story details.")}</Text><Text style={styles.newsMeta}>BrightGlobe　{t("刚刚", "Just now")}</Text></View>
        </Pressable>
      ))}
    </View>
  );

  const renderComics = () => (
    <View style={styles.content}>
      <View style={styles.featureBanner}>
        <WireframeImage height={111} cover />
        <Text style={styles.bannerCaption}>{t("精品漫画", "FEATURED COMICS")}</Text>
        <Text style={styles.bannerTitle}>{t("海量精品动漫 / 漫画", "Discover comics and illustrated stories")}</Text>
        <Text style={styles.bannerSub}>{t("优质作品持续更新", "New stories updated regularly")}</Text>
      </View>
      <SearchBar placeholder={t("搜索漫画", "Search comics")} />
      <ChannelTabs active={comicsChannel} onSelect={setComicsChannel} items={[
        { key: "featured", label: t("推荐", "Top") },
        { key: "action", label: t("热血", "Action") },
        { key: "romance", label: t("恋爱", "Romance") },
        { key: "mystery", label: t("悬疑", "Mystery") },
        { key: "fantasy", label: t("奇幻", "Fantasy") }
      ]} />
      {["本周人气漫画", "编辑精选作品", "最新连载"].map((item, i) => (
        <Pressable key={item} onPress={() => openActivity(item)} style={styles.comicRow}>
          <WireframeImage width={58} height={66} />
          <View style={styles.productCopy}><Text style={styles.productTitle}>{t(item, ["Popular comics", "Editor's picks", "Latest series"][i])}</Text><Text style={styles.productDescription}>{t("作品简介与作者信息", "Story description and creator")}</Text><Text style={styles.productPrice}>{t("连载中", "Ongoing")}</Text></View>
        </Pressable>
      ))}
    </View>
  );

  const renderMusic = () => (
    <View style={styles.content}>
      <View style={styles.featureBanner}>
        <WireframeImage height={111} cover />
        <Text style={styles.bannerCaption}>NETEASE CLOUD MUSIC</Text>
        <Text style={styles.bannerTitle}>{t("音乐，让生活更有温度", "Music for every moment")}</Text>
        <Text style={styles.bannerSub}>{t("发现歌单与精选音乐", "Explore playlists and selected music")}</Text>
      </View>
      <SearchBar placeholder={t("搜索歌曲、歌单或歌手", "Search songs, playlists, or artists")} />
      <ChannelTabs active={musicChannel} onSelect={setMusicChannel} items={[
        { key: "featured", label: t("推荐", "Top") },
        { key: "playlists", label: t("歌单", "Playlists") },
        { key: "charts", label: t("排行榜", "Charts") },
        { key: "radio", label: t("电台", "Radio") }
      ]} />
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
        <WireframeImage height={111} cover />
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
  header: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", marginBottom: 7 },
  headerAction: { width: 28, height: 34, justifyContent: "center" }, backGlyph: { color: "#EAF2FF", fontSize: 27, lineHeight: 30 }, closeGlyph: { color: "#C9D9F2", fontSize: 24, lineHeight: 27, textAlign: "right" },
  headerTitle: { color: "#EAF2FF", fontSize: 13, fontWeight: "600", flex: 1, textAlign: "center" },
  content: { flex: 1 },
  searchBar: { height: 29, borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)", borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, marginTop: 5, marginBottom: 7 },
  searchGlyph: { color: "#8A9DBD", fontSize: 15, marginRight: 6 }, searchPlaceholder: { color: "#8A9DBD", fontSize: 8 },
  searchInput: { flex: 1, color: "#C9D9F2", fontSize: 8, paddingVertical: 0 },
  channelTabButton: { minWidth: 42, minHeight: 30, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  channelTabButtonActive: { borderBottomWidth: 2, borderBottomColor: "#555555" },
  channelTabs: { flexDirection: "row", minHeight: 31, alignItems: "center", justifyContent: "space-around", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.16)" },
  channelTab: { color: "#96A9C8", fontSize: 8 }, channelTabActive: { color: "#EAF2FF", fontWeight: "700" },
  shopCategories: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 7, borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.14)" },
  shopCategory: { width: "25%", alignItems: "center", paddingVertical: 5, gap: 4 },
  shopCategoryIcon: { width: 33, height: 33, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  shopCategoryGlyph: { color: "#FFFFFF", fontSize: 17 }, shopCategoryLabel: { color: "#B8C9E4", fontSize: 7 },
  wireframeImage: { backgroundColor: "rgba(22, 36, 61, 0.92)", overflow: "hidden", position: "relative" },
  wireframeStretch: { alignSelf: "stretch" },
  wireframeCover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  thumbCool: { backgroundColor: "rgba(22, 36, 61, 0.92)" }, thumbWarm: { backgroundColor: "rgba(22, 36, 61, 0.92)" },
  sectionHeading: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.16)" },
  sectionHeadingText: { color: "#E1EBFC", fontSize: 9, fontWeight: "700" }, sectionAction: { color: "#96A9C8", fontSize: 7 },
  productRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.12)", paddingVertical: 6 },
  productThumb: { width: 60, height: 60, alignItems: "center", justifyContent: "center" }, productGlyph: { color: "#FFFFFF", fontSize: 25 },
  productCopy: { flex: 1, gap: 4 }, productTitle: { color: "#E1EBFC", fontSize: 9, fontWeight: "700" }, productDescription: { color: "#8A9DBD", fontSize: 7 }, productPrice: { color: "#A0B2D0", fontSize: 7 },
  gameBanner: { minHeight: 112, backgroundColor: "rgba(22, 36, 61, 0.92)", justifyContent: "center", padding: 13, gap: 5, position: "relative", overflow: "hidden" },
  bannerCaption: { color: "#A0B2D0", fontSize: 6, letterSpacing: 1, fontWeight: "700" }, bannerTitle: { color: "#E1EBFC", fontSize: 13, fontWeight: "700" }, bannerSub: { color: "#A0B2D0", fontSize: 7 },
  gameRow: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.14)" },
  gameThumb: { width: 54, height: 54, borderRadius: 9, justifyContent: "center", alignItems: "center" }, gameGlyph: { color: "#FFFFFF", fontSize: 23 },
  gameCopy: { flex: 1, gap: 4 }, gameMeta: { color: "#8A9DBD", fontSize: 7 }, openButton: { borderWidth: 1, borderColor: "rgba(165, 192, 233, 0.32)", borderRadius: 13, paddingHorizontal: 11, paddingVertical: 5, color: "#B8C9E4", fontSize: 7 },
  featureBanner: { minHeight: 111, backgroundColor: "rgba(22, 36, 61, 0.92)", justifyContent: "center", padding: 13, gap: 5, marginVertical: 6, position: "relative", overflow: "hidden" },
  bannerAction: { alignSelf: "flex-start", marginTop: 3, borderWidth: 1, borderColor: "rgba(165, 192, 233, 0.32)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  bannerActionText: { color: "#B8C9E4", fontSize: 7 },
  entertainmentGrid: { flexDirection: "row", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.16)", paddingVertical: 9 },
  entertainmentItem: { flex: 1, alignItems: "center", gap: 5 },
  entertainmentIcon: { width: 33, height: 33, borderRadius: 17, backgroundColor: "rgba(22, 36, 61, 0.92)", justifyContent: "center", alignItems: "center" }, entertainmentGlyph: { color: "#C9D9F2", fontSize: 17 }, entertainmentLabel: { color: "#B8C9E4", fontSize: 7 },
  simpleRow: { minHeight: 40, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.14)", gap: 8 }, simpleIcon: { color: "#A0B2D0", fontSize: 16, width: 22 }, simpleTitle: { color: "#C9D9F2", flex: 1, fontSize: 8 }, chevron: { color: "#8A9DBD", fontSize: 17 },
  newsTabs: { gap: 12, alignItems: "center", paddingHorizontal: 5 }, newsTabButton: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent" }, newsTabButtonActive: { borderBottomColor: "#555555" }, newsTab: { color: "#96A9C8", fontSize: 8 }, newsTabActive: { color: "#EAF2FF", fontWeight: "700" },
  newsRow: { minHeight: 81, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.14)", gap: 8, paddingVertical: 7 },
  newsThumb: { width: 80, height: 58, alignItems: "center", justifyContent: "center" }, newsGlyph: { color: "#FFFFFF", fontSize: 23 },
  newsCopy: { flex: 1, gap: 5 }, newsTitle: { color: "#E3EDFF", fontSize: 8, fontWeight: "700" }, newsDescription: { color: "#8A9DBD", fontSize: 7, lineHeight: 11 }, newsMeta: { color: "#788CAB", fontSize: 6 },
  comicRow: { minHeight: 83, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.14)", paddingVertical: 7 },
  comicThumb: { width: 58, height: 66, alignItems: "center", justifyContent: "center" }, comicGlyph: { color: "#FFFFFF", fontSize: 22 },
  bookRow: { flexDirection: "row", gap: 12, paddingVertical: 9 }, bookCard: { width: 84, gap: 4 }, bookCover: { height: 96, alignItems: "center", justifyContent: "center" }, bookCoverGlyph: { color: "#FFFFFF", fontSize: 23 }, bookTitle: { color: "#C9D9F2", fontSize: 7, fontWeight: "600" }, bookAuthor: { color: "#8A9DBD", fontSize: 6 },
  toggleTabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)", marginTop: 8 }, toggleTab: { flex: 1, alignItems: "center", paddingVertical: 9 }, toggleActive: { borderBottomColor: "#555555", borderBottomWidth: 2 }, toggleText: { color: "#8A9DBD", fontSize: 8 }, toggleTextActive: { color: "#E1EBFC", fontWeight: "700" },
  matchCard: { marginTop: 10, borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.18)", padding: 11, gap: 8 }, matchTitle: { color: "#E1EBFC", fontSize: 9, fontWeight: "700" }, matchMeta: { color: "#8A9DBD", fontSize: 7 }, matchTeams: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 9, backgroundColor: "rgba(22, 36, 61, 0.92)" }, team: { color: "#C9D9F2", fontSize: 9, fontWeight: "700" }, vs: { color: "#8A9DBD", fontSize: 8 },
  rulesCard: { borderWidth: 1, borderColor: "rgba(156, 183, 224, 0.23)", borderRadius: 5, padding: 12, marginTop: 8, gap: 7 }, rulesTitle: { color: "#E1EBFC", fontSize: 9, fontWeight: "700" }, rulesText: { color: "#96A9C8", fontSize: 7, lineHeight: 12 },
  mineZone: { minHeight: 67, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "rgba(156, 183, 224, 0.16)", gap: 10 }, zoneLock: { width: 36, textAlign: "center", color: "#C9D9F2", fontSize: 23 }, zoneCopy: { flex: 1, gap: 4 }, zoneTitle: { color: "#E1EBFC", fontSize: 9, fontWeight: "700" }, zoneDescription: { color: "#8A9DBD", fontSize: 7 }, progressTrack: { height: 5, backgroundColor: "rgba(21, 36, 62, 0.92)", overflow: "hidden" }, progressFill: { height: 5, backgroundColor: "#526887" }, zoneState: { color: "#8A9DBD", fontSize: 7 },
  unavailable: { alignItems: "center", paddingVertical: 48, gap: 9 }, unavailableGlyph: { color: "#8A9DBD", fontSize: 29 }, unavailableTitle: { color: "#C9D9F2", fontSize: 11, fontWeight: "700" }, unavailableText: { color: "#8A9DBD", fontSize: 8, textAlign: "center", lineHeight: 13, marginHorizontal: 15 }
});