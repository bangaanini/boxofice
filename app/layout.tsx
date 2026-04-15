import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";

import { HapticFeedback } from "@/components/feedback/haptic-feedback";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { TelegramAppChrome } from "@/components/telegram/telegram-app-chrome";
import { TelegramSessionSync } from "@/components/telegram/telegram-session-sync";
import { USER_SESSION_COOKIE } from "@/lib/user-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Box Office",
  description: "A metadata-first movie streaming app.",
};

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
        {hasUserSession ? <MobileBottomNav /> : null}
        <Script
          src="https://telegram.org/js/telegram-web-app.js?57"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
