import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const appRoot = resolve(process.env.BRIGHTGLOBE_WEB_EXPORT_DIR ?? resolve(process.cwd(), "dist"));
const outputRoot = resolve(process.cwd(), "artifacts/ui-baseline");
const basePath = "/brightglobe";
const port = 4173;

const referenceImages = [
  ["reference-login-fig11.png", "https://image.woshipm.com/wp-files/2018/10/Gd17d1oR62KMpTyLRRtW.png"],
  ["reference-invite-fig16.png", "https://image.woshipm.com/wp-files/2018/10/Q46DJneg8QEV4V9o6ENP.png"],
  ["reference-home-fig12.png", "https://image.woshipm.com/wp-files/2018/10/WloTKKM6kTz2nVfwapX7.png"],
  ["reference-home-activity-fig13.png", "https://image.woshipm.com/wp-files/2018/10/VKZ3IfsoETBUvC4Bekrm.png"],
  ["reference-force-checkin-fig14.png", "https://image.woshipm.com/wp-files/2018/10/aVB8QLvGZjzTxGbVpmC7.png"],
  ["reference-force-categories-fig15.png", "https://image.woshipm.com/wp-files/2018/10/Jy4zbKG97rtEITCfksjS.png"],
  ["reference-force-production-2018.jpg", "https://image.woshipm.com/wp-files/2018/03/F7K5tusDLJ06kqxK9D4S.jpg"],
  ["reference-my-fig17.png", "https://image.woshipm.com/wp-files/2018/10/xnHGvSmbqNyOrSb6Genl.png"],
  ["reference-activity-skin-2018.jpg", "https://image.woshipm.com/wp-files/2018/10/HhRbQVojaZC1O8IsF6RT.jpeg"]
];
await mkdir(outputRoot, { recursive: true });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp"
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === basePath || pathname === `${basePath}/`) pathname = "/";
    else if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);

    let filePath = resolve(appRoot, `.${pathname}`);
    if (!filePath.startsWith(appRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const fileInfo = await stat(filePath);
      if (fileInfo.isDirectory()) filePath = resolve(filePath, "index.html");
    } catch {
      // Expo's static export emits most route documents as <route>.html.
      const htmlRoute = resolve(appRoot, `.${pathname}.html`);
      try {
        await stat(htmlRoute);
        filePath = htmlRoute;
      } catch {
        // Only unknown paths should fall back to the app shell.
        filePath = resolve(appRoot, "index.html");
      }
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(500);
    response.end("Preview server error");
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(port, "127.0.0.1", resolveListen);
});

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

try {
  const page = await browser.newPage({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });

  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}${basePath}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(outputRoot, "home-375x667.png") });

  const forceTab = page.getByText("发现原力", { exact: true }).last();
  await forceTab.click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(outputRoot, "discover-force-375x667.png") });

  const profileTab = page.getByText("我的", { exact: true }).last();
  await profileTab.click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(outputRoot, "my-375x667.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${port}${basePath}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(outputRoot, "home-390x844.png") });

  // Capture all routes in the V1.6 acceptance matrix at a fixed phone viewport.
  await page.setViewportSize({ width: 375, height: 667 });
  const routeCaptures = [
    ["login-375x667.png", "/login", "登录注册"],
    ["wallet-375x667.png", "/wallet", "我的钱包"],
    ["points-record-375x667.png", "/points-record", "黑钻记录"],
    ["force-record-375x667.png", "/force-record", "原力记录"],
    ["announcements-375x667.png", "/announcements", "星球公告"],
    ["announcement-detail-375x667.png", "/announcement-detail", "公告详情"],
    ["invite-375x667.png", "/invite", "邀请码"],
    ["passport-375x667.png", "/passport", "数据护照"],
    ["community-base-375x667.png", "/base", "星球基地"],
    ["settings-375x667.png", "/settings", "账户设置"],
    ["benefits-375x667.png", "/rewards", "玩转黑钻"],
    ["activity-detail-375x667.png", "/activity", "社区活动"],
    ["official-follow-375x667.png", "/official-follow", "关注微信公众号"],
    ["shopping-375x667.png", "/category", "购物"]
  ];

  for (const [fileName, route, expectedTitle] of routeCaptures) {
    await page.goto(`http://127.0.0.1:${port}${basePath}${route}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(300);
    try {
      await page.getByText(expectedTitle, { exact: true }).first().waitFor({ state: "visible", timeout: 8000 });
    } catch {
      const bodyText = (await page.locator("body").innerText()).slice(0, 1200);
      await page.screenshot({ path: resolve(outputRoot, `route-debug-${fileName}`) });
      console.error(`ROUTE ASSERTION FAILED ${route} expected=${expectedTitle} body=${bodyText} pageErrors=${consoleErrors.join(" | ")}`);
      throw new Error(`Route ${route} did not render expected title: ${expectedTitle}`);
    }
    await page.screenshot({ path: resolve(outputRoot, fileName) });
  }

  await page.goto(`http://127.0.0.1:${port}${basePath}/force-record`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("未生效的原力记录", { exact: true }).click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: resolve(outputRoot, "force-record-inactive-375x667.png") });

  // The local preview shortcut is disabled in all normal builds. Enable it only
  // in this CI export, then enter it before testing the logged-in settings flow.
  await page.goto(`http://127.0.0.1:${port}${basePath}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("进入本地预览账户", { exact: true }).click();
  await page.goto(`http://127.0.0.1:${port}${basePath}/settings`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("退出登录", { exact: true }).click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: resolve(outputRoot, "logout-confirmation-375x667.png") });

  // Exercise real in-app navigation for parameterized destinations (no query-string hydration shortcuts).
  const waitForPath = async (suffix) => page.waitForURL((url) => url.pathname.endsWith(suffix), { timeout: 15000 });
  const waitForCategory = async (categoryId) => page.waitForURL(
    (url) => url.pathname.endsWith("/category") && url.searchParams.get("category") === categoryId,
    { timeout: 15000 }
  );
  const visibleText = (value) => page.getByText(value, { exact: true }).filter({ visible: true });
  const waitForTasks = async () => {
    await waitForPath("/tasks");
    await visibleText("发现原力").last().waitFor({ state: "visible", timeout: 10000 });
  };

  const tapInAppBack = async () => {
    await visibleText("‹").last().click();
  };

  await page.goto(`http://127.0.0.1:${port}${basePath}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("进入本地预览账户", { exact: true }).click();
  await visibleText("发现原力").last().waitFor({ state: "visible", timeout: 10000 });
  await visibleText("发现原力").last().click();
  await waitForTasks();
  await page.getByText("签到", { exact: true }).click();
  await page.getByText("签到成功", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: resolve(outputRoot, "check-in-dialog-375x667.png") });
  await page.getByText("不用了", { exact: true }).click();
  await waitForTasks();

  const captureCategoryFromForce = async (label, categoryId, fileName, expectedHeading = label) => {
    await visibleText(label).last().click();
    await waitForCategory(categoryId);
    await visibleText(expectedHeading).first().waitFor({ state: "visible", timeout: 10000 });
    await page.screenshot({ path: resolve(outputRoot, fileName) });
    await tapInAppBack();
    await waitForTasks();
  };

  await captureCategoryFromForce("购物", "shopping", "shopping-from-force-375x667.png");
  await captureCategoryFromForce("游戏", "games", "games-from-force-375x667.png", "游戏中心");

  await visibleText("娱乐").last().click();
  await waitForCategory("entertainment");
  await visibleText("小说").first().waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: resolve(outputRoot, "entertainment-375x667.png") });

  const entertainmentDestinations = [
    ["小说", "reading", "reading-375x667.png", "小说"],
    ["漫画", "comics", "comics-375x667.png", "漫画"],
    ["新闻", "news", "news-375x667.png", "资讯"],
    ["音乐", "music", "music-375x667.png", "网易云音乐"]
  ];
  for (let index = 0; index < entertainmentDestinations.length; index += 1) {
    const [label, categoryId, fileName, expectedHeading] = entertainmentDestinations[index];
    await visibleText(label).last().click();
    await waitForCategory(categoryId);
    await visibleText(expectedHeading).first().waitFor({ state: "visible", timeout: 10000 });
    await page.screenshot({ path: resolve(outputRoot, fileName) });
    if (index < entertainmentDestinations.length - 1) {
      await tapInAppBack();
      await waitForCategory("entertainment");
    }
  }

  await tapInAppBack();
  await waitForCategory("entertainment");
  await tapInAppBack();
  await waitForTasks();
  await captureCategoryFromForce("来钱", "finance", "finance-unavailable-375x667.png");
  await captureCategoryFromForce("健康", "wellness", "wellness-unavailable-375x667.png");

  await page.getByText("邀请好友", { exact: true }).click();
  await waitForPath("/invite");
  await page.getByText("邀请码", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: resolve(outputRoot, "invite-from-force-375x667.png") });
  await tapInAppBack();
  await waitForTasks();

  await page.getByText("关注微信公众号", { exact: true }).click();
  await waitForPath("/official-follow");
  await visibleText("关注微信公众号").last().waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: resolve(outputRoot, "official-follow-375x667.png") });
  await page.getByPlaceholder("请输入公众号提供的验证码").fill("BG2026");
  await page.getByText("提交验证", { exact: true }).click();
  await page.getByText("验证成功", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: resolve(outputRoot, "official-follow-verified-375x667.png") });
  await tapInAppBack();
  await waitForTasks();

  // Follow the Home announcement entry to its list and detail screens.
  await page.getByText("首页", { exact: true }).last().click();
  await page.getByText("星球秉持共建精神中，欢迎试用并留下宝贵建议", { exact: false }).waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("button", { name: "查看公告列表", exact: true }).click();
  await waitForPath("/announcements");
  await page.getByText("星球公告", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: resolve(outputRoot, "announcements-from-home-375x667.png") });
  await page.getByRole("button", { name: "查看公告详情", exact: true }).first().click();
  await waitForPath("/announcement-detail");
  await page.getByText("公告详情", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: resolve(outputRoot, "announcement-detail-from-home-375x667.png") });

  if (consoleErrors.length > 0) {
    throw new Error(`Browser runtime errors:\n${consoleErrors.join("\n")}`);
  }

  for (const [fileName, url] of referenceImages) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await writeFile(resolve(outputRoot, fileName), Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.warn(`Reference image not downloaded: ${fileName}: ${String(error)}`);
    }
  }

  const sourceNotes = [
    "# NetEase Planet V1.6 visual references",
    "",
    "The home, discover-force, and my files are screenshots captured from the BrightGlobe preview.",
    "The reference files are source wireframes / historical visual references, not pixel-to-pixel production screenshots.",
    "",
    ...referenceImages.map(([name, url]) => `- ${name}: ${url}`),
    ""
  ].join("\n");
  await writeFile(resolve(outputRoot, "REFERENCE-SOURCES.md"), sourceNotes);
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(`Captured NetEase Planet V1.6 UI baselines in ${outputRoot}`);
