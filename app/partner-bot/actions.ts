"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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

    return url.toString();
  } catch {
    redirectToPartnerSettings({
      botId,
      message: `${label} wajib berupa URL yang valid.`,
      status: "error",
    });
  }
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
