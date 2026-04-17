import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";

import { HapticFeedback } from "@/components/feedback/haptic-feedback";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { TelegramAppChrome } from "@/components/telegram/telegram-app-chrome";
import { TelegramSessionSync } from "@/components/telegram/telegram-session-sync";
import { SimpleToastViewport } from "@/components/ui/simple-toast";
import {
  getFallbackTelegramBotSettingsResult,
  getSeoMetadataSnapshot,
  getTelegramBotSettingsSafe,
} from "@/lib/telegram-bot-settings";
import { USER_SESSION_COOKIE } from "@/lib/user-auth";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const telegram = await getTelegramBotSettingsSafe().catch(() =>
    getFallbackTelegramBotSettingsResult(
      "Database runtime tidak tersedia saat metadata dirender.",
    ),
  );
  const seo = getSeoMetadataSnapshot(telegram.settings);
  const appUrl = telegram.runtime.publicAppUrl;

  return {
    metadataBase: appUrl ? new URL(appUrl) : undefined,
    applicationName: seo.brandName,
    alternates: {
      canonical: "/",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: seo.appShortName,
    },
    category: "entertainment",
    description: seo.description,
    keywords: seo.keywords,
    openGraph: {
      description: seo.description,
      images: [
        {
          alt: `${seo.brandName} preview`,
          url: "/opengraph-image.jpg",
        },
      ],
      siteName: seo.brandName,
      title: seo.title,
      type: "website",
      url: "/",
    },
    robots: {
      follow: true,
      index: true,
    },
    title: {
      default: seo.title,
      template: `%s | ${seo.brandName}`,
    },
    twitter: {
      card: "summary_large_image",
      description: seo.description,
      images: ["/twitter-image.jpg"],
      title: seo.title,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const hasUserSession = Boolean(cookieStore.get(USER_SESSION_COOKIE)?.value);

  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <TelegramAppChrome />
        <TelegramSessionSync />
        <HapticFeedback />
        <SimpleToastViewport />
        {hasUserSession ? <MobileBottomNav /> : null}
        <Script
          src="https://telegram.org/js/telegram-web-app.js?57"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
