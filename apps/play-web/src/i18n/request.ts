import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = locale === "zh-CN"
    ? (await import("../messages/zh-CN.json")).default
    : (await import("../messages/en.json")).default;
  return { locale, messages, timeZone: "UTC" };
});
