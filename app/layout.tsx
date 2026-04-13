import type { Metadata } from "next";
import "video.js/dist/video-js.css";
import "videojs-hls-quality-selector/dist/videojs-hls-quality-selector.css";

import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Box Office",
  description: "A metadata-first movie streaming app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
