import { neon } from "@neondatabase/serverless";
import type { ReviewCursor } from "./cursor.js";

export interface ProjectionRecord<T> {
  payload: T;
  contentLocale: string;
  updatedAt: string;
}

export interface ReviewProjectionRecord<T> {
  payload: T;
  createdAt: string;
  id: string;
}

export interface PublicReadRepository {
  getApp(slug: string, locale: string, fallbackLocale: string): Promise<ProjectionRecord<unknown> | null>;
  getReviews(
    slug: string,
    locale: string,
    fallbackLocale: string,
    cursor: ReviewCursor | null,
    limit: number
  ): Promise<{ app: ProjectionRecord<unknown>; items: ReviewProjectionRecord<unknown>[] } | null>;
}

export function createNeonPublicReadRepository(connectionString: string): PublicReadRepository {
  const sql = neon(connectionString);

  return {
    async getApp(slug, locale, fallbackLocale) {
      const rows = await sql`
        SELECT payload, content_locale, updated_at
        FROM marketplace.public_app_detail_projections
        WHERE app_slug = ${slug}
          AND content_locale IN (${locale}, ${fallbackLocale})
        ORDER BY CASE WHEN content_locale = ${locale} THEN 0 ELSE 1 END
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        payload: row.payload,
        contentLocale: String(row.content_locale),
        updatedAt: new Date(String(row.updated_at)).toISOString()
      };
    },

    async getReviews(slug, locale, fallbackLocale, cursor, limit) {
      const appRows = await sql`
        SELECT payload, content_locale, updated_at
        FROM marketplace.public_app_detail_projections
        WHERE app_slug = ${slug}
          AND content_locale IN (${locale}, ${fallbackLocale})
        ORDER BY CASE WHEN content_locale = ${locale} THEN 0 ELSE 1 END
        LIMIT 1
      `;
      const appRow = appRows[0];
      if (!appRow) return null;
      const contentLocale = String(appRow.content_locale);
      const reviewRows = cursor
        ? await sql`
            SELECT review_id, created_at, payload
            FROM marketplace.public_app_review_projections
            WHERE app_slug = ${slug}
              AND content_locale = ${contentLocale}
              AND (created_at, review_id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)
            ORDER BY created_at DESC, review_id DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT review_id, created_at, payload
            FROM marketplace.public_app_review_projections
            WHERE app_slug = ${slug}
              AND content_locale = ${contentLocale}
            ORDER BY created_at DESC, review_id DESC
            LIMIT ${limit}
          `;
      return {
        app: {
          payload: appRow.payload,
          contentLocale,
          updatedAt: new Date(String(appRow.updated_at)).toISOString()
        },
        items: reviewRows.map((row) => ({
          id: String(row.review_id),
          createdAt: new Date(String(row.created_at)).toISOString(),
          payload: row.payload
        }))
      };
    }
  };
}
