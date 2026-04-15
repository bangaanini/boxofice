import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getEnvPublicAppUrl } from "@/lib/telegram-bot-settings";

export const DEFAULT_VIP_PREVIEW_MINUTES = 3;
export const VIP_TOKEN_PREVIEW_GRACE_SECONDS = 20;
export const VIP_TOKEN_TTL_SECONDS = 60 * 60 * 6;

export type VipProgramSettingsSnapshot = {
  createdAt: Date;
  id: string;
  joinVipLabel: string;
  joinVipUrl: string;
  paywallDescription: string;
  paywallTitle: string;
  previewEnabled: boolean;
  previewLimitMinutes: number;
  slug: string;
  updatedAt: Date;
};

export type VipProgramSettingsResult = {
  schemaIssue: string | null;
  schemaReady: boolean;
  settings: VipProgramSettingsSnapshot;
};

export type VipStatusSnapshot = {
  active: boolean;
  expiresAt: Date | null;
  startedAt: Date | null;
};

type PlaybackAccessPayload = {
  exp: number;
  movieId: string | null;
  previewLimitSeconds: number;
  userId: string;
  vip: boolean;
};

const VIP_SETTINGS_SCHEMA_ISSUE =
  "Pengaturan VIP belum aktif penuh di database runtime. Jalankan migration terbaru agar preview dan paywall bisa dikontrol dari admin.";

function getOptionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function defaultJoinVipUrl() {
  return `${getEnvPublicAppUrl()}/vip`;
}

function isLegacyProfileVipUrl(value: string) {
  try {
    const url = new URL(value);
    const appUrl = new URL(getEnvPublicAppUrl());

    return url.origin === appUrl.origin && url.pathname === "/profile";
  } catch {
    return false;
  }
}

function createDefaultVipProgramSettings(): VipProgramSettingsSnapshot {
  return {
    createdAt: new Date(0),
    id: "vip-program-settings-fallback",
    joinVipLabel: "Buka VIP",
    joinVipUrl: defaultJoinVipUrl(),
    paywallDescription:
      "Preview gratis sudah selesai. Upgrade VIP untuk lanjut tanpa batas dan buka semua judul premium.",
    paywallTitle: "Lanjutkan dengan VIP",
    previewEnabled: true,
    previewLimitMinutes: DEFAULT_VIP_PREVIEW_MINUTES,
    slug: "default",
    updatedAt: new Date(0),
  };
}

function isRecordWithCode(
  error: unknown,
): error is { code?: string; message?: string } {
  return typeof error === "object" && error !== null;
}

function isMissingVipSchemaError(error: unknown) {
  if (!isRecordWithCode(error)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";

  return (
    message.includes("VipProgramSettings") ||
    message.includes("vipExpiresAt") ||
    message.includes("vipStartedAt")
  );
}

function normalizeJoinVipUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return defaultJoinVipUrl();
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return isLegacyProfileVipUrl(trimmed) ? defaultJoinVipUrl() : trimmed;
  }

  if (trimmed.startsWith("/")) {
    const normalized = `${getEnvPublicAppUrl()}${trimmed}`;
    return isLegacyProfileVipUrl(normalized) ? defaultJoinVipUrl() : normalized;
  }

  const normalized = `https://${trimmed}`;
  return isLegacyProfileVipUrl(normalized) ? defaultJoinVipUrl() : normalized;
}

export function isVipActive(expiresAt: Date | null | undefined) {
  return Boolean(expiresAt && expiresAt.getTime() > Date.now());
}

export function getVipStatus(input: {
  vipExpiresAt?: Date | null;
  vipStartedAt?: Date | null;
}): VipStatusSnapshot {
  return {
    active: isVipActive(input.vipExpiresAt),
    expiresAt: input.vipExpiresAt ?? null,
    startedAt: input.vipStartedAt ?? null,
  };
}

export async function ensureVipProgramSettings() {
  const existing = await prisma.vipProgramSettings.findUnique({
    where: { slug: "default" },
  });

  if (existing) {
    return existing;
  }

  const defaults = createDefaultVipProgramSettings();

  return prisma.vipProgramSettings.create({
    data: {
      joinVipLabel: defaults.joinVipLabel,
      joinVipUrl: defaults.joinVipUrl,
      paywallDescription: defaults.paywallDescription,
      paywallTitle: defaults.paywallTitle,
      previewEnabled: defaults.previewEnabled,
      previewLimitMinutes: defaults.previewLimitMinutes,
      slug: "default",
    },
  });
}

export async function getVipProgramSettingsSafe(): Promise<VipProgramSettingsResult> {
  try {
    const settings = await ensureVipProgramSettings();

    return {
      schemaIssue: null,
      schemaReady: true,
      settings: {
        ...settings,
        joinVipUrl: normalizeJoinVipUrl(settings.joinVipUrl),
      },
    };
  } catch (error) {
    if (!isMissingVipSchemaError(error)) {
      throw error;
    }

    return {
      schemaIssue: VIP_SETTINGS_SCHEMA_ISSUE,
      schemaReady: false,
      settings: createDefaultVipProgramSettings(),
    };
  }
}

export function resolvePreviewLimitSeconds(
  settings: Pick<VipProgramSettingsSnapshot, "previewEnabled" | "previewLimitMinutes">,
  vipActive: boolean,
) {
  if (vipActive || !settings.previewEnabled) {
    return 0;
  }

  return Math.max(0, settings.previewLimitMinutes) * 60;
}

function getPlaybackAccessSecret() {
  return (
    getOptionalEnv("STREAM_ACCESS_SECRET") ||
    getOptionalEnv("ADMIN_SESSION_SECRET") ||
    getOptionalEnv("TELEGRAM_WEBHOOK_SECRET") ||
    "boxofice-dev-secret"
  );
}

function signPlaybackBody(body: string) {
  return createHmac("sha256", getPlaybackAccessSecret())
    .update(body)
    .digest("base64url");
}

export function createPlaybackAccessToken(input: {
  movieId?: string | null;
  previewLimitSeconds: number;
  userId: string;
  vipActive: boolean;
}) {
  const expSeconds = input.vipActive
    ? Math.floor(Date.now() / 1000) + VIP_TOKEN_TTL_SECONDS
    : Math.floor(Date.now() / 1000) +
      Math.max(input.previewLimitSeconds + VIP_TOKEN_PREVIEW_GRACE_SECONDS, 45);
  const payload: PlaybackAccessPayload = {
    exp: expSeconds,
    movieId: input.movieId ?? null,
    previewLimitSeconds: input.previewLimitSeconds,
    userId: input.userId,
    vip: input.vipActive,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPlaybackBody(body);

  return {
    expiresAt: new Date(expSeconds * 1000),
    token: `${body}.${signature}`,
  };
}

export function verifyPlaybackAccessToken(token: string) {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    throw new Error("Token playback tidak valid.");
  }

  const expected = signPlaybackBody(body);
  const isValidSignature =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!isValidSignature) {
    throw new Error("Token playback tidak cocok.");
  }

  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as PlaybackAccessPayload;

  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error("Sesi preview sudah habis.");
  }

  return payload;
}
