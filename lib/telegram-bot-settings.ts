import { prisma } from "@/lib/prisma";
import {
  buildTelegramBotChatUrlForUsername,
  type TelegramRuntimeConfig,
} from "@/lib/telegram-miniapp";

export type TelegramInlineButtonConfig = {
  enabled: boolean;
  id: string;
  label: string;
  url: string;
};

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
  inlineButtons: TelegramInlineButtonConfig[];
  miniAppShortName: string | null;
  ownerTelegramId: string | null;
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

type TelegramBotSettingsRecord = Omit<
  TelegramBotSettingsSnapshot,
  "inlineButtons"
> & {
  inlineButtons: unknown;
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
    (error.message.includes("TelegramBotSettings") ||
      error.message.includes("ownerTelegramId") ||
      error.message.includes("inlineButtons"))
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

const TELEGRAM_INLINE_BUTTON_SLOT_IDS = Array.from(
  { length: 10 },
  (_, index) => `button${index + 1}`,
);

type LegacyButtonFieldMap = {
  labelKey:
    | "affiliateGroupLabel"
    | "affiliateLabel"
    | "channelLabel"
    | "openAppLabel"
    | "searchLabel"
    | "supportLabel"
    | "vipLabel";
  urlKey:
    | "affiliateGroupUrl"
    | "affiliateUrl"
    | "channelUrl"
    | "openAppUrl"
    | "searchUrl"
    | "supportUrl"
    | "vipUrl";
};

const LEGACY_INLINE_BUTTON_FIELD_MAP: LegacyButtonFieldMap[] = [
  { labelKey: "openAppLabel", urlKey: "openAppUrl" },
  { labelKey: "searchLabel", urlKey: "searchUrl" },
  { labelKey: "affiliateLabel", urlKey: "affiliateUrl" },
  { labelKey: "affiliateGroupLabel", urlKey: "affiliateGroupUrl" },
  { labelKey: "channelLabel", urlKey: "channelUrl" },
  { labelKey: "supportLabel", urlKey: "supportUrl" },
  { labelKey: "vipLabel", urlKey: "vipUrl" },
];

function createEmptyInlineButton(index: number): TelegramInlineButtonConfig {
  return {
    enabled: false,
    id: TELEGRAM_INLINE_BUTTON_SLOT_IDS[index] ?? `button${index + 1}`,
    label: "",
    url: "",
  };
}

type TelegramLegacyButtonFields = Pick<
  TelegramBotSettingsSnapshot,
  | "affiliateGroupLabel"
  | "affiliateGroupUrl"
  | "affiliateLabel"
  | "affiliateUrl"
  | "channelLabel"
  | "channelUrl"
  | "openAppLabel"
  | "openAppUrl"
  | "searchLabel"
  | "searchUrl"
  | "supportLabel"
  | "supportUrl"
  | "vipLabel"
  | "vipUrl"
>;

export function buildLegacyInlineButtonsFromSettings(
  settings: TelegramLegacyButtonFields,
): TelegramInlineButtonConfig[] {
  return TELEGRAM_INLINE_BUTTON_SLOT_IDS.map((buttonId, index) => {
    const legacyMap = LEGACY_INLINE_BUTTON_FIELD_MAP[index];

    if (!legacyMap) {
      return createEmptyInlineButton(index);
    }

    const label = settings[legacyMap.labelKey]?.trim() ?? "";
    const url = settings[legacyMap.urlKey]?.trim() ?? "";

    return {
      enabled: Boolean(label && url),
      id: buttonId,
      label,
      url,
    };
  });
}

function normalizeInlineButtons(
  value: unknown,
  fallbackButtons: TelegramInlineButtonConfig[],
): TelegramInlineButtonConfig[] {
  if (!Array.isArray(value)) {
    return fallbackButtons;
  }

  return TELEGRAM_INLINE_BUTTON_SLOT_IDS.map((buttonId, index) => {
    const fallback = fallbackButtons[index] ?? createEmptyInlineButton(index);
    const rawButton = value[index];

    if (!rawButton || typeof rawButton !== "object" || Array.isArray(rawButton)) {
      return fallback;
    }

    const input = rawButton as Record<string, unknown>;
    const label =
      typeof input.label === "string" ? input.label.trim() : fallback.label;
    const url = typeof input.url === "string" ? input.url.trim() : fallback.url;
    const hasContent = Boolean(label && url);

    return {
      enabled:
        typeof input.enabled === "boolean"
          ? input.enabled && hasContent
          : fallback.enabled && hasContent,
      id:
        typeof input.id === "string" && input.id.trim()
          ? input.id.trim()
          : buttonId,
      label,
      url,
    };
  });
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
    "Layar Box Office adalah Mini App Telegram untuk nonton film box office terupdate, cari judul favorit, buka akses VIP, dan jalankan affiliate langsung dari Telegram.";
  const defaults = {
    appShortName: "Layar Box Office",
    affiliateGroupLabel: "🏠 Group Affiliate",
    affiliateGroupUrl: buildTelegramBotChatUrlForUsername(runtime.botUsername),
    affiliateLabel: "💰 Gabung Affiliate",
    affiliateUrl: `${runtime.publicAppUrl}/affiliate`,
    brandName: "Layar Box Office",
    botToken: null,
    botUsername: null,
    channelLabel: "🎥 Layar Box Office",
    channelUrl: buildTelegramBotChatUrlForUsername(runtime.botUsername),
    createdAt: new Date(0),
    id: "telegram-bot-settings-fallback",
    miniAppShortName: null,
    ownerTelegramId: getOptionalEnv("TELEGRAM_BOT_OWNER_TELEGRAM_ID"),
    openAppLabel: "🎬 Buka",
    openAppUrl: runtime.publicAppUrl,
    publicAppUrl: null,
    seoDescription: defaultSeoDescription,
    seoKeywords:
      "layar box office, layarbox.app, telegram mini app, nonton film telegram, film box office, vip film, affiliate telegram",
    seoTitle: "Layar Box Office",
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
      "👋 Hai {first_name}! Selamat datang di Layar Box Office.\n\n🎬 Nonton film box office langsung dari Telegram.\n🔥 Tanpa ribet • Full HD • Update setiap hari\n\n📌 Cara pakai:\n• Buka -> langsung mulai nonton\n• Cari Judul -> cari film favoritmu\n• Gabung Affiliate -> mulai bangun komisi dari Telegram\n• Layar Box Office -> lihat update kanal utama\n• Hubungi Admin -> kalau ada kendala\n• Join VIP -> buka akses premium\n\nPilih menu di bawah dan mulai sekarang!",
  } satisfies Omit<TelegramBotSettingsSnapshot, "inlineButtons">;

  return {
    ...defaults,
    inlineButtons: buildLegacyInlineButtonsFromSettings(defaults),
  };
}

export function getFallbackTelegramBotSettingsResult(
  schemaIssue: string | null = null,
): TelegramBotSettingsResult {
  const settings = createDefaultTelegramBotSettings();
  const runtime = resolveRuntimeFromSettings(settings);

  return {
    runtime,
    schemaIssue,
    schemaReady: false,
    settings: withDerivedLinks(settings, runtime),
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
  settings: TelegramBotSettingsRecord,
  runtime: TelegramBotRuntime,
): TelegramBotSettingsSnapshot {
  const vipFallbackUrl = `${runtime.publicAppUrl}/vip`;
  const resolvedVipUrl = fillWebAppUrlFromRuntime(
    settings.vipUrl,
    vipFallbackUrl,
  );

  const derivedSettings = {
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

  return {
    ...derivedSettings,
    inlineButtons: normalizeInlineButtons(
      settings.inlineButtons,
      buildLegacyInlineButtonsFromSettings(derivedSettings),
    ),
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
      inlineButtons: defaults.inlineButtons as unknown as object,
      miniAppShortName: defaults.miniAppShortName,
      ownerTelegramId: defaults.ownerTelegramId,
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

    return getFallbackTelegramBotSettingsResult(
      "Tabel Telegram bot settings belum ada di database runtime. Jalankan migration terbaru agar pengaturan bot aktif penuh.",
    );
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
    appShortName: settings.appShortName.trim() || settings.brandName.trim() || "Layar Box Office",
    brandName: settings.brandName.trim() || "Layar Box Office",
    description,
    keywords,
    title: settings.seoTitle.trim() || settings.brandName.trim() || "Layar Box Office",
  };
}
