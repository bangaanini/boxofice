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

function resolveWebAppOrigin(settings: TelegramBotSettingsSnapshot) {
  const candidates = [settings.publicAppUrl, settings.openAppUrl];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }

  return null;
}

function shouldUseWebAppButton(
  settings: TelegramBotSettingsSnapshot,
  urlValue: string,
) {
  const webAppOrigin = resolveWebAppOrigin(settings);

  if (!webAppOrigin) {
    return false;
  }

  try {
    return new URL(urlValue).origin === webAppOrigin;
  } catch {
    return false;
  }
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
  const rows: TelegramInlineButton[][] = [];
  for (let index = 0; index < settings.inlineButtons.length; index += 2) {
    const pair = settings.inlineButtons.slice(index, index + 2);
    const row = pair
      .filter((button) => button.enabled)
      .map((button) => {
        const sanitizedUrl = sanitizeAbsoluteUrl(button.url);

        if (!sanitizedUrl) {
          return null;
        }

        return shouldUseWebAppButton(settings, sanitizedUrl)
          ? createWebAppButton(
              button.label,
              appendStartParam(sanitizedUrl, startParam),
            )
          : createUrlButton(button.label, sanitizedUrl);
      })
      .filter((button): button is TelegramInlineButton => button !== null);

    if (row.length) {
      rows.push(row);
    }
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
