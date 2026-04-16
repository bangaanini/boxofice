import { prisma } from "@/lib/prisma";
import {
  buildTelegramBotChatUrlForUsername,
  type TelegramRuntimeConfig,
} from "@/lib/telegram-miniapp";

export type TelegramBotSettingsSnapshot = {
  appShortName: string;
  affiliateGroupLabel: string;
  affiliateGroupUrl: string;
  affiliateLabel: string;
  affiliateUrl: string;
  brandName: string;
  botToken: string | null;
  botUsername: string | null;
  channelLabel: string;
  channelUrl: string;
  createdAt: Date;
  id: string;
  miniAppShortName: string | null;
  openAppLabel: string;
  openAppUrl: string;
  publicAppUrl: string | null;
  seoDescription: string;
  seoKeywords: string | null;
  seoTitle: string;
  searchLabel: string;
  searchUrl: string;
  slug: string;
  supportLabel: string;
  supportUrl: string;
  updatedAt: Date;
  vipLabel: string;
  vipUrl: string;
  webhookSecret: string | null;
  welcomeMessage: string;
};

export type TelegramBotRuntime = TelegramRuntimeConfig & {
  publicAppUrl: string;
};

export type TelegramBotSettingsResult = {
  runtime: TelegramBotRuntime;
  schemaIssue: string | null;
  schemaReady: boolean;
  settings: TelegramBotSettingsSnapshot;
};

export type SeoMetadataSnapshot = {
  appShortName: string;
  brandName: string;
  description: string;
  keywords: string[];
  title: string;
};

function isRecordWithCode(
  error: unknown,
): error is { code?: string; message?: string } {
  return typeof error === "object" && error !== null;
}

function isMissingTelegramBotSchemaError(error: unknown) {
  if (!isRecordWithCode(error)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  return (
    typeof error.message === "string" &&
    error.message.includes("TelegramBotSettings")
  );
}

function getOptionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function getEnvPublicAppUrl() {
  return (
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeUrl(process.env.APP_URL) ||
    normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeUrl(process.env.VERCEL_URL) ||
    "https://example.com"
  );
}

function getEnvRuntimeConfig(): TelegramBotRuntime {
  return {
    botToken: getOptionalEnv("TELEGRAM_BOT_TOKEN") || "",
    botUsername: getOptionalEnv("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "") || "",
    miniAppShortName: getOptionalEnv("TELEGRAM_MINI_APP_SHORT_NAME"),
    publicAppUrl: getEnvPublicAppUrl(),
    webhookSecret: getOptionalEnv("TELEGRAM_WEBHOOK_SECRET") || "",
  };
}

function createDefaultTelegramBotSettings(): TelegramBotSettingsSnapshot {
  const runtime = getEnvRuntimeConfig();
  const defaultSeoDescription =
    "Layar BoxOffice adalah Mini App Telegram untuk nonton film Box Office, cari judul favorit, buka akses VIP, dan jalankan affiliate langsung dari Telegram.";

  return {
    appShortName: "Layar BoxOffice",
    affiliateGroupLabel: "🏠 Group Affiliate",
    affiliateGroupUrl: buildTelegramBotChatUrlForUsername(runtime.botUsername),
    affiliateLabel: "💰 Gabung Affiliate",
    affiliateUrl: `${runtime.publicAppUrl}/affiliate`,
    brandName: "Layar BoxOffice",
    botToken: null,
    botUsername: null,
    channelLabel: "🎥 Film Box Office",
    channelUrl: buildTelegramBotChatUrlForUsername(runtime.botUsername),
    createdAt: new Date(0),
    id: "telegram-bot-settings-fallback",
    miniAppShortName: null,
    openAppLabel: "🎬 Buka",
    openAppUrl: runtime.publicAppUrl,
    publicAppUrl: null,
    seoDescription: defaultSeoDescription,
    seoKeywords:
      "layar boxoffice, telegram mini app, nonton film telegram, film box office, vip film, affiliate telegram",
    seoTitle: "Layar BoxOffice",
    searchLabel: "🔎 Cari Judul",
    searchUrl: `${runtime.publicAppUrl}/search`,
    slug: "default",
    supportLabel: "📞 Hubungi Admin",
    supportUrl: buildTelegramBotChatUrlForUsername(runtime.botUsername),
    updatedAt: new Date(0),
    vipLabel: "💎 Join VIP",
    vipUrl: `${runtime.publicAppUrl}/vip`,
    webhookSecret: null,
    welcomeMessage:
      "👋 Hai {first_name}! Selamat datang di Box Office.\n\n🎬 Nonton film Box Office langsung dari Telegram.\n🔥 Tanpa ribet • Full HD • Update setiap hari\n\n📌 Cara pakai:\n• Buka -> langsung mulai nonton\n• Cari Judul -> cari film favoritmu\n• Gabung Affiliate -> mulai bangun komisi dari Telegram\n• Film Box Office -> lihat update kanal utama\n• Hubungi Admin -> kalau ada kendala\n• Join VIP -> buka akses premium\n\nPilih menu di bawah dan mulai sekarang!",
  };
}

function resolveRuntimeFromSettings(
  settings: Pick<
    TelegramBotSettingsSnapshot,
    "botToken" | "botUsername" | "miniAppShortName" | "publicAppUrl" | "webhookSecret"
  >,
) {
  const env = getEnvRuntimeConfig();

  return {
    botToken: settings.botToken?.trim() || env.botToken || "",
    botUsername:
      settings.botUsername?.trim().replace(/^@/, "") || env.botUsername || "",
    miniAppShortName: settings.miniAppShortName?.trim() || env.miniAppShortName,
    publicAppUrl: normalizeUrl(settings.publicAppUrl) || env.publicAppUrl,
    webhookSecret: settings.webhookSecret?.trim() || env.webhookSecret || "",
  } satisfies TelegramBotRuntime;
}

function fillUrlFromRuntime(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function isTelegramChatUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "t.me" || url.hostname === "telegram.me";
  } catch {
    return false;
  }
}

function fillWebAppUrlFromRuntime(value: string, fallback: string) {
  const trimmed = value.trim();

  if (!trimmed || isTelegramChatUrl(trimmed)) {
    return fallback;
  }

  return trimmed;
}

function isLegacyInternalVipUrl(value: string, runtime: TelegramBotRuntime) {
  try {
    const url = new URL(value);
    const appUrl = new URL(runtime.publicAppUrl);

    return url.origin === appUrl.origin && url.pathname === "/profile";
  } catch {
    return false;
  }
}

function withDerivedLinks(
  settings: TelegramBotSettingsSnapshot,
  runtime: TelegramBotRuntime,
) {
  const vipFallbackUrl = `${runtime.publicAppUrl}/vip`;
  const resolvedVipUrl = fillWebAppUrlFromRuntime(
    settings.vipUrl,
    vipFallbackUrl,
  );

  return {
    ...settings,
    affiliateGroupUrl: fillUrlFromRuntime(
      settings.affiliateGroupUrl,
      buildTelegramBotChatUrlForUsername(runtime.botUsername),
    ),
    affiliateUrl: fillWebAppUrlFromRuntime(
      settings.affiliateUrl,
      `${runtime.publicAppUrl}/affiliate`,
    ),
    channelUrl: fillUrlFromRuntime(
      settings.channelUrl,
      buildTelegramBotChatUrlForUsername(runtime.botUsername),
    ),
    openAppUrl: fillWebAppUrlFromRuntime(
      settings.openAppUrl,
      runtime.publicAppUrl,
    ),
    searchUrl: fillWebAppUrlFromRuntime(
      settings.searchUrl,
      `${runtime.publicAppUrl}/search`,
    ),
    supportUrl: fillUrlFromRuntime(
      settings.supportUrl,
      buildTelegramBotChatUrlForUsername(runtime.botUsername),
    ),
    vipUrl: isLegacyInternalVipUrl(resolvedVipUrl, runtime)
      ? vipFallbackUrl
      : resolvedVipUrl,
  };
}

export async function ensureTelegramBotSettings() {
  const existing = await prisma.telegramBotSettings.findUnique({
    where: { slug: "default" },
  });

  if (existing) {
    return existing;
  }

  const defaults = createDefaultTelegramBotSettings();

  return prisma.telegramBotSettings.create({
    data: {
      appShortName: defaults.appShortName,
      affiliateGroupLabel: defaults.affiliateGroupLabel,
      affiliateGroupUrl: defaults.affiliateGroupUrl,
      affiliateLabel: defaults.affiliateLabel,
      affiliateUrl: defaults.affiliateUrl,
      brandName: defaults.brandName,
      botToken: defaults.botToken,
      botUsername: defaults.botUsername,
      channelLabel: defaults.channelLabel,
      channelUrl: defaults.channelUrl,
      miniAppShortName: defaults.miniAppShortName,
      openAppLabel: defaults.openAppLabel,
      openAppUrl: defaults.openAppUrl,
      publicAppUrl: defaults.publicAppUrl,
      seoDescription: defaults.seoDescription,
      seoKeywords: defaults.seoKeywords,
      seoTitle: defaults.seoTitle,
      searchLabel: defaults.searchLabel,
      searchUrl: defaults.searchUrl,
      supportLabel: defaults.supportLabel,
      supportUrl: defaults.supportUrl,
      vipLabel: defaults.vipLabel,
      vipUrl: defaults.vipUrl,
      webhookSecret: defaults.webhookSecret,
      welcomeMessage: defaults.welcomeMessage,
    },
  });
}

export async function getTelegramBotSettingsSafe(): Promise<TelegramBotSettingsResult> {
  try {
    const rawSettings = await ensureTelegramBotSettings();
    const runtime = resolveRuntimeFromSettings(rawSettings);
    const settings = withDerivedLinks(rawSettings, runtime);

    return {
      runtime,
      schemaIssue: null,
      schemaReady: true,
      settings,
    };
  } catch (error) {
    if (!isMissingTelegramBotSchemaError(error)) {
      throw error;
    }

    const settings = createDefaultTelegramBotSettings();
    const runtime = resolveRuntimeFromSettings(settings);

    return {
      runtime,
      schemaIssue:
        "Tabel Telegram bot settings belum ada di database runtime. Jalankan migration terbaru agar pengaturan bot aktif penuh.",
      schemaReady: false,
      settings: withDerivedLinks(settings, runtime),
    };
  }
}

export function renderTelegramWelcomeMessage(
  template: string,
  input: {
    firstName?: string | null;
    username?: string | null;
  },
) {
  return template
    .replace(/\{first_name\}/gi, input.firstName?.trim() || "teman")
    .replace(
      /\{username\}/gi,
      input.username?.trim()
        ? `@${input.username.trim().replace(/^@/, "")}`
        : "teman",
    );
}

export function getSeoMetadataSnapshot(
  settings: Pick<
    TelegramBotSettingsSnapshot,
    "appShortName" | "brandName" | "seoDescription" | "seoKeywords" | "seoTitle"
  >,
): SeoMetadataSnapshot {
  const description = settings.seoDescription.trim();
  const keywords = settings.seoKeywords
    ?.split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

  return {
    appShortName: settings.appShortName.trim() || settings.brandName.trim() || "Layar BoxOffice",
    brandName: settings.brandName.trim() || "Layar BoxOffice",
    description,
    keywords,
    title: settings.seoTitle.trim() || settings.brandName.trim() || "Layar BoxOffice",
  };
}
