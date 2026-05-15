import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";

export const ACTIVE_BOT_CONTEXT_COOKIE = "boxofice_active_bot";
const ACTIVE_BOT_CONTEXT_TTL_SECONDS = 60 * 60 * 24 * 30;

export type ActiveBotContext =
  | {
      kind: "default";
    }
  | {
      kind: "partner";
      partnerBotId: string;
    };

export function getBotContextFields(context: ActiveBotContext | null | undefined) {
  if (context?.kind === "partner") {
    return {
      botKind: "partner",
      partnerBotId: context.partnerBotId,
    };
  }

  return {
    botKind: "default",
    partnerBotId: null,
  };
}

function getCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ACTIVE_BOT_CONTEXT_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function serializeBotContext(context: ActiveBotContext) {
  return context.kind === "partner"
    ? `partner:${context.partnerBotId}`
    : "default";
}

function parseBotContext(rawValue: string | undefined) {
  if (!rawValue) {
    return null;
  }

  if (rawValue === "default") {
    return { kind: "default" } satisfies ActiveBotContext;
  }

  if (rawValue.startsWith("partner:")) {
    const partnerBotId = rawValue.slice("partner:".length).trim();

    if (!partnerBotId) {
      return null;
    }

    return {
      kind: "partner",
      partnerBotId,
    } satisfies ActiveBotContext;
  }

  return null;
}

export async function setActiveBotContextCookie(context: ActiveBotContext) {
  const cookieStore = await cookies();
  cookieStore.set({
    ...getCookieOptions(),
    name: ACTIVE_BOT_CONTEXT_COOKIE,
    value: serializeBotContext(context),
  });
}

export async function clearActiveBotContextCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    ...getCookieOptions(),
    maxAge: 0,
    name: ACTIVE_BOT_CONTEXT_COOKIE,
    value: "",
  });
}

export async function getActiveBotContext() {
  const cookieStore = await cookies();
  return parseBotContext(
    cookieStore.get(ACTIVE_BOT_CONTEXT_COOKIE)?.value,
  );
}

export async function getValidActiveBotContext() {
  const context = await getActiveBotContext();

  if (context?.kind !== "partner") {
    return context ?? ({ kind: "default" } satisfies ActiveBotContext);
  }

  const partnerBot = await prisma.partnerBot.findUnique({
    where: { id: context.partnerBotId },
    select: {
      active: true,
      id: true,
    },
  });

  if (!partnerBot?.active) {
    return { kind: "default" } satisfies ActiveBotContext;
  }

  return context;
}

function getOwnerTelegramIdFromEnv() {
  return process.env.TELEGRAM_BOT_OWNER_TELEGRAM_ID?.trim() || null;
}

export async function hasBotOwnerPlaybackAccess(user: {
  id: string;
  telegramId: string | null;
}) {
  const context = await getActiveBotContext();

  if (!context) {
    return false;
  }

  if (context.kind === "default") {
    const settings = await getTelegramBotSettingsSafe();
    const ownerTelegramId =
      settings.settings.ownerTelegramId?.trim() || getOwnerTelegramIdFromEnv();

    return Boolean(
      ownerTelegramId &&
        user.telegramId &&
        user.telegramId.trim() === ownerTelegramId,
    );
  }

  const partnerBot = await prisma.partnerBot.findUnique({
    where: { id: context.partnerBotId },
    select: {
      active: true,
      ownerUserId: true,
    },
  });

  if (!partnerBot?.active) {
    return false;
  }

  return partnerBot.ownerUserId === user.id;
}
