import { createPublicReadApp } from "./app.js";
import { createNeonPublicReadRepository } from "./repository.js";

interface Env {
  DATABASE_URL?: string;
  PUBLIC_CURSOR_SECRET?: string;
  DEFAULT_LOCALE?: string;
  SUPPORTED_LOCALES?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const databaseUrl = env.DATABASE_URL?.trim();
    const cursorSecret = env.PUBLIC_CURSOR_SECRET?.trim();
    if (!databaseUrl || !cursorSecret || cursorSecret.length < 32) {
      return Response.json({
        error: {
          code: "SERVICE_CONFIGURATION_ERROR",
          message: "The public catalogue service is not configured."
        }
      }, {
        status: 503,
        headers: { "Cache-Control": "no-store" }
      });
    }

    const supportedLocales = (env.SUPPORTED_LOCALES ?? "en,zh-CN")
      .split(",").map((locale) => locale.trim()).filter(Boolean);
    const defaultLocale = env.DEFAULT_LOCALE ?? "en";
    if (!supportedLocales.includes(defaultLocale)) {
      return Response.json({
        error: { code: "SERVICE_CONFIGURATION_ERROR", message: "The default locale is not supported." }
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const app = createPublicReadApp(createNeonPublicReadRepository(databaseUrl), {
      defaultLocale,
      supportedLocales,
      cursorSecret
    });
    return app.fetch(request);
  }
};
