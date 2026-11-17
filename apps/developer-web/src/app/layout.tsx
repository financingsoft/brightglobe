import type { Metadata } from "next";
import "./globals.css";
import { PortalLocaleProvider } from "@/components/locale";

export const metadata: Metadata = {
  title: { default: "Globe Play Developer Console", template: "%s | Globe Play" },
  description: "Manage your Globe Play publisher organization.",
  robots: { index: false, follow: false, noarchive: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PortalLocaleProvider>{children}</PortalLocaleProvider></body>
    </html>
  );
}
