"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildLegacyInlineButtonsFromSettings,
  type TelegramInlineButtonConfig,
} from "@/lib/telegram-bot-settings";
import {
  PARTNER_BOT_OVERRIDE_KEYS,
  type PartnerBotSettingsOverrides,
} from "@/lib/telegram-partner-bots";
import { requireUserSession } from "@/lib/user-auth";

type PartnerBotOverrideKey = (typeof PARTNER_BOT_OVERRIDE_KEYS)[number];

function readTextField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function sanitizeRedirectBotId(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  return raw || "";
}

function redirectToPartnerSettings(input: {
  botId?: string;
  message: string;
  status: "error" | "ok";
}) {
  const params = new URLSearchParams({
    partner: input.status,
    message: input.message,
  });

  if (input.botId) {
    params.set("bot", input.botId);
  }

  redirect(`/partner-bot/settings?${params.toString()}`);
}

function validateOptionalUrl(value: string, label: string, botId: string) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }

    if (
      (url.hostname === "t.me" || url.hostname === "telegram.me") &&
      url.searchParams.has("startapp")
    ) {
      redirectToPartnerSettings({
        botId,
        message: `${label} tidak boleh memakai link t.me dengan startapp. Gunakan URL web app langsung.`,
        status: "error",
      });
    }

    return url.toString();
  } catch {
    redirectToPartnerSettings({
      botId,
      message: `${label} wajib berupa URL yang valid.`,
      status: "error",
    });
  }
}

function readPartnerInlineButtons(formData: FormData, botId: string) {
  const buttons: TelegramInlineButtonConfig[] = [];

  for (let index = 0; index < 10; index += 1) {
    const buttonNumber = index + 1;
    const label = readTextField(formData, `buttonLabel_${buttonNumber}`);
    const url = readTextField(formData, `buttonUrl_${buttonNumber}`);
    const enabled = formData.get(`buttonEnabled_${buttonNumber}`) === "on";

    if (enabled && !label) {
      redirectToPartnerSettings({
        botId,
        message: `Label tombol ${buttonNumber} wajib diisi jika tombol diaktifkan.`,
        status: "error",
      });
    }

    if (enabled && !url) {
      redirectToPartnerSettings({
        botId,
        message: `URL tombol ${buttonNumber} wajib diisi jika tombol diaktifkan.`,
        status: "error",
      });
    }

    const normalizedUrl = url
      ? (validateOptionalUrl(url, `URL tombol ${buttonNumber}`, botId) ?? "")
      : "";

    buttons.push({
      enabled: enabled && Boolean(label && normalizedUrl),
      id: `button${buttonNumber}`,
      label,
      url: normalizedUrl,
    });
  }

  return buttons;
}

export async function savePartnerBotSettingsAction(formData: FormData) {
  const user = await requireUserSession();
  const partnerBotId = sanitizeRedirectBotId(formData.get("partnerBotId"));

  if (!partnerBotId) {
    redirectToPartnerSettings({
      message: "Bot partner tidak ditemukan.",
      status: "error",
    });
  }

  const partnerBot = await prisma.partnerBot.findFirst({
    where: {
      id: partnerBotId,
      ownerUserId: user.id,
    },
    select: {
      id: true,
      settingsOverrides: true,
    },
  });

  if (!partnerBot) {
    redirectToPartnerSettings({
      botId: partnerBotId,
      message: "Kamu tidak punya akses ke bot ini.",
      status: "error",
    });
    return;
  }

  const urlLabels: Partial<Record<PartnerBotOverrideKey, string>> = {
    affiliateGroupUrl: "URL grup affiliate",
    affiliateUrl: "URL tombol affiliate",
    channelUrl: "URL channel film",
    openAppUrl: "URL tombol buka",
    searchUrl: "URL tombol cari",
    supportUrl: "URL support admin",
    vipUrl: "URL tombol VIP",
  };

  const overrides: PartnerBotSettingsOverrides = {};

  for (const key of PARTNER_BOT_OVERRIDE_KEYS) {
    const rawValue = readTextField(formData, key);

    if (!rawValue) {
      continue;
    }

    const normalizedValue = urlLabels[key]
      ? validateOptionalUrl(rawValue, urlLabels[key], partnerBotId)
      : rawValue;

    if (!normalizedValue) {
      continue;
    }

    overrides[key] = normalizedValue;
  }

  const welcomeMessage = overrides.welcomeMessage?.trim();

  if (welcomeMessage && welcomeMessage.length < 20) {
    redirectToPartnerSettings({
      botId: partnerBotId,
      message: "Pesan sambutan minimal 20 karakter.",
      status: "error",
    });
  }

  const inlineButtons = readPartnerInlineButtons(formData, partnerBotId);
  const hasActiveButton = inlineButtons.some((button) => button.enabled);

  if (!hasActiveButton) {
    redirectToPartnerSettings({
      botId: partnerBotId,
      message: "Minimal aktifkan satu tombol inline.",
      status: "error",
    });
  }

  const existingOverrides =
    partnerBot.settingsOverrides &&
    typeof partnerBot.settingsOverrides === "object" &&
    !Array.isArray(partnerBot.settingsOverrides)
      ? (partnerBot.settingsOverrides as Record<string, unknown>)
      : {};

  const effectiveLegacy = buildLegacyInlineButtonsFromSettings({
    affiliateGroupLabel:
      overrides.affiliateGroupLabel ??
      (typeof existingOverrides.affiliateGroupLabel === "string"
        ? existingOverrides.affiliateGroupLabel
        : "🏠 Group Affiliate"),
    affiliateGroupUrl:
      overrides.affiliateGroupUrl ??
      (typeof existingOverrides.affiliateGroupUrl === "string"
        ? existingOverrides.affiliateGroupUrl
        : ""),
    affiliateLabel:
      overrides.affiliateLabel ??
      (typeof existingOverrides.affiliateLabel === "string"
        ? existingOverrides.affiliateLabel
        : "💰 Gabung Affiliate"),
    affiliateUrl:
      overrides.affiliateUrl ??
      (typeof existingOverrides.affiliateUrl === "string"
        ? existingOverrides.affiliateUrl
        : ""),
    channelLabel:
      overrides.channelLabel ??
      (typeof existingOverrides.channelLabel === "string"
        ? existingOverrides.channelLabel
        : "🎥 Layar Box Office"),
    channelUrl:
      overrides.channelUrl ??
      (typeof existingOverrides.channelUrl === "string"
        ? existingOverrides.channelUrl
        : ""),
    openAppLabel:
      overrides.openAppLabel ??
      (typeof existingOverrides.openAppLabel === "string"
        ? existingOverrides.openAppLabel
        : "🎬 Buka"),
    openAppUrl:
      overrides.openAppUrl ??
      (typeof existingOverrides.openAppUrl === "string"
        ? existingOverrides.openAppUrl
        : ""),
    searchLabel:
      overrides.searchLabel ??
      (typeof existingOverrides.searchLabel === "string"
        ? existingOverrides.searchLabel
        : "🔎 Cari Judul"),
    searchUrl:
      overrides.searchUrl ??
      (typeof existingOverrides.searchUrl === "string"
        ? existingOverrides.searchUrl
        : ""),
    supportLabel:
      overrides.supportLabel ??
      (typeof existingOverrides.supportLabel === "string"
        ? existingOverrides.supportLabel
        : "📞 Hubungi Admin"),
    supportUrl:
      overrides.supportUrl ??
      (typeof existingOverrides.supportUrl === "string"
        ? existingOverrides.supportUrl
        : ""),
    vipLabel:
      overrides.vipLabel ??
      (typeof existingOverrides.vipLabel === "string"
        ? existingOverrides.vipLabel
        : "💎 Join VIP"),
    vipUrl:
      overrides.vipUrl ??
      (typeof existingOverrides.vipUrl === "string"
        ? existingOverrides.vipUrl
        : ""),
  });

  overrides.inlineButtons = inlineButtons;
  if (inlineButtons[0]) {
    overrides.openAppLabel = inlineButtons[0].label || effectiveLegacy[0].label;
    overrides.openAppUrl = inlineButtons[0].url || effectiveLegacy[0].url;
  }
  if (inlineButtons[1]) {
    overrides.searchLabel = inlineButtons[1].label || effectiveLegacy[1].label;
    overrides.searchUrl = inlineButtons[1].url || effectiveLegacy[1].url;
  }
  if (inlineButtons[2]) {
    overrides.affiliateLabel =
      inlineButtons[2].label || effectiveLegacy[2].label;
    overrides.affiliateUrl = inlineButtons[2].url || effectiveLegacy[2].url;
  }
  if (inlineButtons[3]) {
    overrides.affiliateGroupLabel =
      inlineButtons[3].label || effectiveLegacy[3].label;
    overrides.affiliateGroupUrl =
      inlineButtons[3].url || effectiveLegacy[3].url;
  }
  if (inlineButtons[4]) {
    overrides.channelLabel = inlineButtons[4].label || effectiveLegacy[4].label;
    overrides.channelUrl = inlineButtons[4].url || effectiveLegacy[4].url;
  }
  if (inlineButtons[5]) {
    overrides.supportLabel = inlineButtons[5].label || effectiveLegacy[5].label;
    overrides.supportUrl = inlineButtons[5].url || effectiveLegacy[5].url;
  }
  if (inlineButtons[6]) {
    overrides.vipLabel = inlineButtons[6].label || effectiveLegacy[6].label;
    overrides.vipUrl = inlineButtons[6].url || effectiveLegacy[6].url;
  }

  await prisma.partnerBot.update({
    where: { id: partnerBot.id },
    data: {
      settingsOverrides:
        Object.keys(overrides).length > 0
          ? (overrides as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
  });

  revalidatePath("/partner-bot/settings");
  revalidatePath("/admin/partners");

  redirectToPartnerSettings({
    botId: partnerBot.id,
    message: "Pengaturan bot partner berhasil diperbarui.",
    status: "ok",
  });
}
