import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "zh-CN";

const messages = {
  en: {
    brandTagline: "GLOBAL CONTRIBUTION NETWORK",
    navHome: "Home",
    navTasks: "Tasks",
    navRewards: "Rewards",
    navWallet: "Wallet",
    navProfile: "Profile",
    homeEyebrow: "YOUR CONTRIBUTION, YOUR IMPACT",
    homeTitle: "Build a brighter world.",
    homeSubtitle: "Small actions. Shared progress. Global impact.",
    contributionPower: "Contribution power",
    experience: "Experience",
    currentLevel: "Current level",
    todayProgress: "Today's progress",
    checkinComplete: "Daily check-in",
    weeklyActivity: "Weekly activity",
    dailyTask: "Daily missions",
    viewAll: "View all",
    tasksTitle: "Make your next move count.",
    tasksSubtitle: "Take part in the community and grow your contribution.",
    dailyMission: "Daily check-in",
    exploreMission: "Explore the community",
    inviteMission: "Invite a friend",
    points: "points",
    xp: "XP",
    completed: "Completed",
    available: "Available",
    rewardsTitle: "Rewards with purpose.",
    rewardsSubtitle: "Use eligible platform points for community perks.",
    featured: "Featured rewards",
    redemptionNote: "Redemption options and availability may vary by region.",
    walletTitle: "Your reward wallet.",
    walletSubtitle: "A transparent view of your platform reward activity.",
    availableBalance: "Available balance",
    rewardPoints: "Reward points",
    pointsExplainer: "Platform points are internal reward units. They are not cash, deposits, investments, or guaranteed returns.",
    transactionHistory: "Recent activity",
    noTransactions: "No transactions yet. Eligible activity will appear here.",
    profileTitle: "Your BrightGlobe profile.",
    profileSubtitle: "Manage your preferences and account experience.",
    memberLabel: "Community member",
    accountStatus: "Account status",
    language: "App language",
    languageDesc: "Choose the language used across the app.",
    switchLanguage: "Switch language",
    english: "English",
    chinese: "简体中文",
    preview: "Preview data",
    noToken: "No token or investment features are enabled in this starter app.",
    levelLabel: "Level",
    pointsLabel: "Points",
    missionHint: "Complete a mission to build experience and contribution.",
    taskDailyDetail: "Daily participation",
    taskExploreDetail: "Discover topics and communities",
    taskInviteDetail: "Share BrightGlobe with someone",
    demoMemberName: "BrightGlobe Member",
    rewardOne: "Community spotlight",
    rewardOneDesc: "A featured profile placement for eligible creators.",
    rewardTwo: "Learning bundle",
    rewardTwoDesc: "Curated learning resources from community partners.",
    rewardThree: "Event access",
    rewardThreeDesc: "Priority access to selected online community events.",
    notConnected: "Not connected",
    apiNotice: "Account and reward data will connect to the BrightGlobe API in a later milestone.",
    notFoundTitle: "Page not found",
    notFoundDescription: "This BrightGlobe route does not exist.",
    goHome: "Return home"
  },
  "zh-CN": {
    brandTagline: "全球贡献者网络",
    navHome: "首页",
    navTasks: "任务",
    navRewards: "奖励",
    navWallet: "钱包",
    navProfile: "我的",
    homeEyebrow: "你的贡献，创造真实影响",
    homeTitle: "一起创造更美好的世界。",
    homeSubtitle: "从每个小行动开始，让全球贡献汇聚成改变。",
    contributionPower: "贡献力",
    experience: "经验值",
    currentLevel: "当前等级",
    todayProgress: "今日进度",
    checkinComplete: "每日签到",
    weeklyActivity: "本周活动",
    dailyTask: "每日任务",
    viewAll: "查看全部",
    tasksTitle: "让每一次行动都有价值。",
    tasksSubtitle: "参与社区活动，持续积累你的贡献。",
    dailyMission: "每日签到",
    exploreMission: "探索社区",
    inviteMission: "邀请一位朋友",
    points: "积分",
    xp: "经验值",
    completed: "已完成",
    available: "可参与",
    rewardsTitle: "让贡献获得回馈。",
    rewardsSubtitle: "使用符合规则的平台积分兑换社区权益。",
    featured: "精选奖励",
    redemptionNote: "兑换项目和可用情况可能因地区而异。",
    walletTitle: "你的奖励钱包。",
    walletSubtitle: "清晰查看平台奖励及相关活动记录。",
    availableBalance: "可用余额",
    rewardPoints: "奖励积分",
    pointsExplainer: "平台积分属于内部奖励单位，不是现金、存款、投资，也不代表保证收益。",
    transactionHistory: "最近活动",
    noTransactions: "暂无交易记录。符合规则的活动将在这里显示。",
    profileTitle: "你的 BrightGlobe 主页。",
    profileSubtitle: "管理偏好设置和账户体验。",
    memberLabel: "社区成员",
    accountStatus: "账户状态",
    language: "应用语言",
    languageDesc: "选择整个应用使用的语言。",
    switchLanguage: "切换语言",
    english: "English",
    chinese: "简体中文",
    preview: "预览数据",
    noToken: "当前启动骨架尚未启用代币或投资功能。",
    levelLabel: "等级",
    pointsLabel: "积分",
    missionHint: "完成任务可积累经验并提升贡献。",
    taskDailyDetail: "完成每日参与",
    taskExploreDetail: "发现感兴趣的话题与社区",
    taskInviteDetail: "邀请朋友加入 BrightGlobe",
    demoMemberName: "BrightGlobe 社区成员",
    rewardOne: "社区精选展示",
    rewardOneDesc: "符合条件的创作者可获得主页展示机会。",
    rewardTwo: "学习资源礼包",
    rewardTwoDesc: "社区合作伙伴提供的精选学习资源。",
    rewardThree: "活动参与资格",
    rewardThreeDesc: "优先参与部分线上社区活动。",
    notConnected: "尚未连接",
    apiNotice: "账户和奖励数据将在后续里程碑接入 BrightGlobe API。",
    notFoundTitle: "页面不存在",
    notFoundDescription: "你访问的 BrightGlobe 页面不存在。",
    goHome: "返回首页"
  }
} as const;

export type TranslationKey = keyof typeof messages.en;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => messages[locale][key]
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useI18n must be used within LocaleProvider.");
  }
  return context;
}
