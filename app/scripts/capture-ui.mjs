import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const appRoot = resolve(process.env.BRIGHTGLOBE_WEB_EXPORT_DIR ?? resolve(process.cwd(), "dist"));
const outputRoot = resolve(process.cwd(), "artifacts/ui-baseline");
const basePath = "/brightglobe";
const port = 4173;

const referenceImages = [
  ["reference-home-fig12.png", "https://image.woshipm.com/wp-files/2018/10/WloTKKM6kTz2nVfwapX7.png"],
  ["reference-home-activity-fig13.png", "https://image.woshipm.com/wp-files/2018/10/VKZ3IfsoETBUvC4Bekrm.png"],
  ["reference-force-checkin-fig14.png", "https://image.woshipm.com/wp-files/2018/10/aVB8QLvGZjzTxGbVpmC7.png"],
  ["reference-force-categories-fig15.png", "https://image.woshipm.com/wp-files/2018/10/Jy4zbKG97rtEITCfksjS.png"],
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
      // Expo Router uses client-side navigation. Unknown page paths fall back to index.html.
      filePath = resolve(appRoot, "index.html");
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
    ["login-375x667.png", "/login"],
    ["points-record-375x667.png", "/wallet"],
    ["force-record-375x667.png", "/force-record"],
    ["announcements-375x667.png", "/announcements"],
    ["announcement-detail-375x667.png", "/announcement-detail"],
    ["invite-375x667.png", "/invite"],
    ["passport-375x667.png", "/passport"],
    ["community-base-375x667.png", "/base"],
    ["settings-375x667.png", "/settings"],
    ["benefits-375x667.png", "/rewards"],
    ["activity-detail-375x667.png", "/activity"],
    ["shopping-375x667.png", "/category"]
  ];

  for (const [fileName, route] of routeCaptures) {
    await page.goto(`http://127.0.0.1:${port}${basePath}${route}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(180);
    await page.screenshot({ path: resolve(outputRoot, fileName) });
  }

  // Exercise real in-app navigation for parameterized destinations (no query-string hydration shortcuts).
  await page.goto(`http://127.0.0.1:${port}${basePath}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("进入本地预览账户", { exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByText("发现原力", { exact: true }).last().click();
  await page.waitForTimeout(250);
  await page.getByText("签到", { exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(outputRoot, "check-in-dialog-375x667.png") });
  await page.getByText("不用了", { exact: true }).click();
  await page.waitForTimeout(180);

  const captureCategoryFromForce = async (label, fileName) => {
    await page.getByText(label, { exact: true }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(outputRoot, fileName) });
    await page.getByText("‹", { exact: true }).click();
    await page.waitForTimeout(180);
  };

  await captureCategoryFromForce("购物", "shopping-from-force-375x667.png");
  await captureCategoryFromForce("游戏", "games-from-force-375x667.png");
  await page.getByText("娱乐", { exact: true }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: resolve(outputRoot, "entertainment-375x667.png") });

  for (const [label, fileName] of [
    ["小说", "reading-375x667.png"],
    ["漫画", "comics-375x667.png"],
    ["新闻", "news-375x667.png"],
    ["音乐", "music-375x667.png"]
  ]) {
    await page.getByText("‹", { exact: true }).click();
    await page.waitForTimeout(160);
    await page.getByText(label, { exact: true }).click();
    await page.waitForTimeout(180);
    await page.screenshot({ path: resolve(outputRoot, fileName) });
  }

  await page.getByText("‹", { exact: true }).click();
  await page.waitForTimeout(180);
  await page.getByText("‹", { exact: true }).click();
  await page.waitForTimeout(180);
  await captureCategoryFromForce("来钱", "finance-unavailable-375x667.png");
  await captureCategoryFromForce("健康", "wellness-unavailable-375x667.png");

  await page.getByText("邀请好友", { exact: true }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: resolve(outputRoot, "invite-from-force-375x667.png") });
  await page.getByText("‹", { exact: true }).click();
  await page.waitForTimeout(180);
  await page.getByText("关注微信公众号", { exact: true }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: resolve(outputRoot, "official-follow-activity-375x667.png") });

  // Follow the Home announcement entry to its list and detail screens.
  await page.getByText("‹", { exact: true }).click();
  await page.waitForTimeout(180);
  await page.getByText("首页", { exact: true }).last().click();
  await page.waitForTimeout(180);
  await page.getByText("更多", { exact: true }).click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: resolve(outputRoot, "announcements-from-home-375x667.png") });
  await page.getByText("立即查看", { exact: true }).first().click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: resolve(outputRoot, "announcement-detail-from-home-375x667.png") });

  if (consoleErrors.length > 0) {  if (consoleErrors.length > 0) {
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
