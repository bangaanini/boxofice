import { sendTelegramBotMessage } from "@/lib/telegram-bot-api";
import {
  renderTelegramWelcomeMessage,
  type TelegramBotSettingsSnapshot,
} from "@/lib/telegram-bot-settings";

export type TelegramStartMessage = {
  chatId: number | null;
  firstName?: string;
  telegramId?: number;
  text?: string;
  username?: string;
};

type TelegramInlineButton =
  | {
      text: string;
      url: string;
    }
  | {
      text: string;
      web_app: {
        url: string;
      };
    };

function sanitizeAbsoluteUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function createWebAppButton(text: string, url: string) {
  return {
    text,
    web_app: {
      url,
    },
  };
}

function createUrlButton(text: string, url: string) {
  return {
    text,
    url,
  };
}

export function parseStartPayload(messageText: string | undefined) {
  const text = messageText?.trim();

  if (!text || !text.startsWith("/start")) {
    return null;
  }

  const [, payload] = text.split(/\s+/, 2);

  return payload?.trim() || null;
}

export function isStartCommand(messageText: string | undefined) {
  return messageText?.trim().startsWith("/start") ?? false;
}

export function appendStartParam(urlValue: string, startParam: string | null) {
  if (!startParam) {
    return urlValue;
  }

  try {
    const url = new URL(urlValue);

    url.searchParams.set("start_param", startParam);

    return url.toString();
  } catch {
    return urlValue;
  }
}

export function buildTelegramInlineKeyboard(
  settings: TelegramBotSettingsSnapshot,
  startParam: string | null,
  extraRows?: TelegramInlineButton[][],
) {
  const openAppUrl = sanitizeAbsoluteUrl(settings.openAppUrl);
  const searchUrl = sanitizeAbsoluteUrl(settings.searchUrl);
  const affiliateUrl = sanitizeAbsoluteUrl(settings.affiliateUrl);
  const affiliateGroupUrl = sanitizeAbsoluteUrl(settings.affiliateGroupUrl);
  const channelUrl = sanitizeAbsoluteUrl(settings.channelUrl);
  const supportUrl = sanitizeAbsoluteUrl(settings.supportUrl);
  const vipUrl = sanitizeAbsoluteUrl(settings.vipUrl);

  const rows: TelegramInlineButton[][] = [];

  if (openAppUrl) {
    rows.push([
      createWebAppButton(
        settings.openAppLabel,
        appendStartParam(openAppUrl, startParam),
      ),
    ]);
  }

  if (searchUrl) {
    rows.push([
      createWebAppButton(
        settings.searchLabel,
        appendStartParam(searchUrl, startParam),
      ),
    ]);
  }

  if (affiliateUrl) {
    rows.push([
      createWebAppButton(
        settings.affiliateLabel,
        appendStartParam(affiliateUrl, startParam),
      ),
    ]);
  }

  const communityRow: TelegramInlineButton[] = [];

  if (affiliateGroupUrl) {
    communityRow.push(
      createUrlButton(settings.affiliateGroupLabel, affiliateGroupUrl),
    );
  }

  if (channelUrl) {
    communityRow.push(createUrlButton(settings.channelLabel, channelUrl));
  }

  if (communityRow.length) {
    rows.push(communityRow);
  }

  const supportRow: TelegramInlineButton[] = [];

  if (supportUrl) {
    supportRow.push(createUrlButton(settings.supportLabel, supportUrl));
  }

  if (vipUrl) {
    supportRow.push(
      createWebAppButton(
        settings.vipLabel,
        appendStartParam(vipUrl, startParam),
      ),
    );
  }

  if (supportRow.length) {
    rows.push(supportRow);
  }

  if (extraRows?.length) {
    rows.push(
      ...extraRows.filter((row) => Array.isArray(row) && row.length > 0),
    );
  }

  return rows;
}

export async function sendTelegramWelcomeMessage(input: {
  botToken: string;
  extraRows?: TelegramInlineButton[][];
  message: TelegramStartMessage;
  settings: TelegramBotSettingsSnapshot;
  startParam: string | null;
}) {
  if (!input.message.chatId) {
    return false;
  }

  const text = renderTelegramWelcomeMessage(input.settings.welcomeMessage, {
    firstName: input.message.firstName,
    username: input.message.username,
  });

  await sendTelegramBotMessage({
    botToken: input.botToken,
    chatId: input.message.chatId,
    replyMarkup: {
      inline_keyboard: buildTelegramInlineKeyboard(
        input.settings,
        input.startParam,
        input.extraRows,
      ),
    },
    text,
  });

  return true;
}
