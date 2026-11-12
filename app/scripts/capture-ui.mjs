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
