import { Hono } from "hono";
import { z } from "zod";
import { decodeReviewCursor, encodeReviewCursor, type ReviewCursor } from "./cursor.js";
import { publicAppDetailSchema, publicReviewSchema } from "./contracts.js";
import type { PublicReadRepository } from "./repository.js";

export interface PublicReadConfig {
  defaultLocale: string;
  supportedLocales: string[];
  cursorSecret: string;
}

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,138}[a-z0-9])?$/;
const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;

function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  cacheControl = "no-store",
  extraHeaders: Record<string, string> = {}
): Response {
  const serialized = JSON.stringify(body);
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    "X-Request-Id": requestId,
    ...extraHeaders
  });
  return new Response(serialized, { status, headers });
}

async function successResponse(
  body: unknown,
  requestId: string,
  cacheControl: string,
  lastModified?: string,
  cacheTags: string[] = []
): Promise<Response> {
  const serialized = JSON.stringify(body);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  const etag = '"' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") + '"';
  const headers: Record<string, string> = { ETag: etag };
  if (lastModified) headers["Last-Modified"] = new Date(lastModified).toUTCString();
  if (cacheTags.length) headers["Cache-Tag"] = [...new Set(cacheTags)].join(",");
  return new Response(serialized, {
    status: 200,
    headers: new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Request-Id": requestId,
      ...headers
    })
  });
}

function parseLocale(value: string | undefined, config: PublicReadConfig): string | null {
  const locale = value ?? config.defaultLocale;
  if (!localePattern.test(locale) || !config.supportedLocales.includes(locale)) return null;
  return locale;
}

function requestId(request: Request): string {
  const supplied = request.headers.get("X-Request-Id");
  return supplied && /^[A-Za-z0-9._-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function notFound(id: string): Response {
  return jsonResponse({
    error: { code: "NOT_FOUND", message: "The requested public resource was not found.", requestId: id }
  }, 404, id);
}

export function createPublicReadApp(repository: PublicReadRepository, config: PublicReadConfig) {
  const app = new Hono();

  app.get("/health/live", (context) => context.json({ status: "ok" }));

  app.get("/api/v1/play/apps/:slug", async (context) => {
    const id = requestId(context.req.raw);
    const slug = context.req.param("slug");
    if (!slugPattern.test(slug)) return notFound(id);
    const locale = parseLocale(context.req.query("locale"), config);
    if (!locale) return jsonResponse({
      error: { code: "INVALID_LOCALE", message: "The requested locale is not supported.", requestId: id }
    }, 400, id);

    try {
      const record = await repository.getApp(slug, locale, config.defaultLocale);
      if (!record) return notFound(id);
      const parsed = publicAppDetailSchema.safeParse(record.payload);
      if (!parsed.success || parsed.data.slug !== slug || parsed.data.contentLocale !== record.contentLocale) {
        console.error("[globe-play] Invalid public app projection", { requestId: id, slug });
        return jsonResponse({
          error: { code: "PUBLIC_PROJECTION_UNAVAILABLE", message: "The public resource is temporarily unavailable.", requestId: id }
        }, 503, id);
      }
      return successResponse({
        data: parsed.data,
        meta: { schemaVersion: 1, contentLocale: record.contentLocale, requestedLocale: locale }
      }, id, "public, max-age=0, s-maxage=600, stale-while-revalidate=1200", record.updatedAt, [
        "app:" + slug,
        "app:" + slug + ":rating",
        "developer:" + parsed.data.publisher.slug,
        ...parsed.data.categories.map((category) => "category:" + category.slug),
        "locale:" + record.contentLocale
      ]);
    } catch (error) {
      console.error("[globe-play] Public app read failed", { requestId: id, error });
      return jsonResponse({
        error: { code: "SERVICE_UNAVAILABLE", message: "The public catalogue is temporarily unavailable.", requestId: id }
      }, 503, id);
    }
  });

  app.get("/api/v1/play/apps/:slug/reviews", async (context) => {
    const id = requestId(context.req.raw);
    const slug = context.req.param("slug");
    if (!slugPattern.test(slug)) return notFound(id);
    const locale = parseLocale(context.req.query("locale"), config);
    if (!locale) return jsonResponse({
      error: { code: "INVALID_LOCALE", message: "The requested locale is not supported.", requestId: id }
    }, 400, id);

    const rawLimit = Number(context.req.query("limit") ?? "20");
    if (!Number.isFinite(rawLimit) || !Number.isInteger(rawLimit)) return jsonResponse({
      error: { code: "INVALID_LIMIT", message: "The page size must be an integer.", requestId: id }
    }, 400, id);
    const limit = Math.max(1, Math.min(20, rawLimit));
    let cursor: ReviewCursor | null = null;
    const rawCursor = context.req.query("cursor");
    if (rawCursor) {
      try {
        cursor = await decodeReviewCursor(rawCursor, config.cursorSecret);
        if (cursor.appSlug !== slug || cursor.locale !== locale) throw new Error("Cursor scope mismatch.");
      } catch {
        return jsonResponse({
          error: { code: "INVALID_CURSOR", message: "The pagination cursor is invalid.", requestId: id }
        }, 400, id);
      }
    }

    try {
      const page = await repository.getReviews(slug, locale, config.defaultLocale, cursor, limit + 1);
      if (!page) return notFound(id);
      const appProjection = publicAppDetailSchema.safeParse(page.app.payload);
      if (!appProjection.success || appProjection.data.slug !== slug || appProjection.data.contentLocale !== page.app.contentLocale) {
        console.error("[globe-play] Invalid public app projection for reviews", { requestId: id, slug });
        return jsonResponse({
          error: { code: "PUBLIC_PROJECTION_UNAVAILABLE", message: "The public resource is temporarily unavailable.", requestId: id }
        }, 503, id);
      }
      const items: z.infer<typeof publicReviewSchema>[] = [];
      for (const record of page.items.slice(0, limit)) {
        const parsed = publicReviewSchema.safeParse(record.payload);
        if (!parsed.success || parsed.data.id !== record.id || parsed.data.createdAt !== record.createdAt) {
          console.error("[globe-play] Invalid public review projection", { requestId: id, slug });
          return jsonResponse({
            error: { code: "PUBLIC_PROJECTION_UNAVAILABLE", message: "The public resource is temporarily unavailable.", requestId: id }
          }, 503, id);
        }
        items.push(parsed.data);
      }
      const hasNextPage = page.items.length > limit;
      const last = hasNextPage ? page.items[limit - 1] : undefined;
      const nextCursor = last ? await encodeReviewCursor({
        version: 1,
        appSlug: slug,
        locale,
        createdAt: last.createdAt,
        id: last.id
      }, config.cursorSecret) : null;
      const data = {
        app: { slug: appProjection.data.slug, name: appProjection.data.name },
        ...(appProjection.data.rating ? { rating: appProjection.data.rating } : {}),
        items,
        pageInfo: { nextCursor, hasNextPage }
      };
      return successResponse({
        data,
        meta: { schemaVersion: 1, contentLocale: page.app.contentLocale, requestedLocale: locale }
      }, id, "public, max-age=0, s-maxage=120, stale-while-revalidate=240", page.app.updatedAt, [
        "app:" + slug,
        "app:" + slug + ":reviews",
        "app:" + slug + ":rating",
        "locale:" + page.app.contentLocale
      ]);
    } catch (error) {
      console.error("[globe-play] Public review read failed", { requestId: id, error });
      return jsonResponse({
        error: { code: "SERVICE_UNAVAILABLE", message: "Public reviews are temporarily unavailable.", requestId: id }
      }, 503, id);
    }
  });

  app.notFound((context) => notFound(requestId(context.req.raw)));
  app.onError((error, context) => {
    const id = requestId(context.req.raw);
    console.error("[globe-play] Unhandled request error", { requestId: id, error });
    return jsonResponse({
      error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed.", requestId: id }
    }, 500, id);
  });

  return app;
}
