"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PortalLocale = "en" | "zh-CN";
type LocaleContextValue = { locale: PortalLocale; setLocale: (locale: PortalLocale) => void };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function PortalLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PortalLocale>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem("globe-play-locale");
    if (stored === "en" || stored === "zh-CN") setLocaleState(stored);
  }, []);
  const setLocale = (next: PortalLocale) => {
    window.localStorage.setItem("globe-play-locale", next);
    setLocaleState(next);
  };
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function usePortalLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("PortalLocaleProvider is missing.");
  return value;
}

export function tx(locale: PortalLocale, english: string, chinese: string) {
  return locale === "zh-CN" ? chinese : english;
}
