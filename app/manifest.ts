import type { MetadataRoute } from "next";
import {
  getSeoMetadataSnapshot,
  getTelegramBotSettingsSafe,
} from "@/lib/telegram-bot-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const telegram = await getTelegramBotSettingsSafe();
  const seo = getSeoMetadataSnapshot(telegram.settings);

  return {
    name: seo.brandName,
    short_name: seo.appShortName,
    description: seo.description,
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    orientation: "portrait",
    lang: "id-ID",
    categories: ["entertainment", "video"],
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
