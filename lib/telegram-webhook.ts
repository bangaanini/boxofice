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

type TelegramInlineKeyboardBuildOptions = {
  preferWebAppButtons?: boolean;
};

type TelegramButtonDebugEntry = {
  kind: "url" | "web_app";
  label: string;
  row: number;
  url: string;
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

    if (
      (url.hostname === "t.me" || url.hostname === "telegram.me") &&
      (!url.pathname || url.pathname === "/" || url.searchParams.has("startapp"))
    ) {
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

function getInlineKeyboardDebugEntries(
  settings: TelegramBotSettingsSnapshot,
  startParam: string | null,
  extraRows?: TelegramInlineButton[][],
  options?: TelegramInlineKeyboardBuildOptions,
) {
  const preferWebAppButtons = options?.preferWebAppButtons ?? true;
  const entries: TelegramButtonDebugEntry[] = [];
  let row = 1;

  for (let index = 0; index < settings.inlineButtons.length; index += 2) {
    const pair = settings.inlineButtons.slice(index, index + 2);
    const validButtons = pair
      .filter((button) => button.enabled)
      .map((button) => {
        const sanitizedUrl = sanitizeAbsoluteUrl(button.url);
        if (!sanitizedUrl) {
          return null;
        }

        const finalUrl =
          preferWebAppButtons && shouldUseWebAppButton(settings, sanitizedUrl)
            ? appendStartParam(sanitizedUrl, startParam)
            : sanitizedUrl;

        return {
          kind:
            preferWebAppButtons && shouldUseWebAppButton(settings, sanitizedUrl)
              ? ("web_app" as const)
              : ("url" as const),
          label: button.label,
          row,
          url: finalUrl,
        };
      })
      .filter((button): button is TelegramButtonDebugEntry => button !== null);

    if (validButtons.length) {
      entries.push(...validButtons);
      row += 1;
    }
  }

  if (extraRows?.length) {
    for (const extraRow of extraRows) {
      const validButtons = extraRow
        .map((button) => {
          if ("url" in button) {
            const sanitizedUrl = sanitizeAbsoluteUrl(button.url);
            if (!sanitizedUrl) {
              return null;
            }

            return {
              kind: "url" as const,
              label: button.text,
              row,
              url: sanitizedUrl,
            };
          }

          const sanitizedUrl = sanitizeAbsoluteUrl(button.web_app.url);
          if (!sanitizedUrl) {
            return null;
          }

          return {
            kind: preferWebAppButtons ? ("web_app" as const) : ("url" as const),
            label: button.text,
            row,
            url: preferWebAppButtons ? sanitizedUrl : sanitizedUrl,
          };
        })
        .filter((button): button is TelegramButtonDebugEntry => button !== null);

      if (validButtons.length) {
        entries.push(...validButtons);
        row += 1;
      }
    }
  }

  return entries;
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
  options?: TelegramInlineKeyboardBuildOptions,
) {
  const preferWebAppButtons = options?.preferWebAppButtons ?? true;
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

        return preferWebAppButtons &&
          shouldUseWebAppButton(settings, sanitizedUrl)
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
    const normalizedExtraRows = extraRows
      .map((row) =>
        row
          .map((button) => {
            if ("url" in button) {
              const normalizedUrl = sanitizeAbsoluteUrl(button.url);
              return normalizedUrl
                ? createUrlButton(button.text, normalizedUrl)
                : null;
            }

            const normalizedUrl = sanitizeAbsoluteUrl(button.web_app.url);

            if (!normalizedUrl) {
              return null;
            }

            return preferWebAppButtons
              ? createWebAppButton(button.text, normalizedUrl)
              : createUrlButton(button.text, normalizedUrl);
          })
          .filter((button): button is TelegramInlineButton => button !== null),
      )
      .filter((row) => row.length > 0);

    rows.push(...normalizedExtraRows);
  }

  return rows;
}

export async function sendTelegramWelcomeMessage(input: {
  botName?: string;
  botToken: string;
  extraRows?: TelegramInlineButton[][];
  message: TelegramStartMessage;
  settings: TelegramBotSettingsSnapshot;
  startParam: string | null;
}) {
  if (!input.message.chatId) {
    return false;
  }

  const chatId = input.message.chatId;

  const text = renderTelegramWelcomeMessage(input.settings.welcomeMessage, {
    botName: input.botName,
    firstName: input.message.firstName,
    username: input.message.username,
  });

  const sendWithKeyboard = async (preferWebAppButtons: boolean) => {
    await sendTelegramBotMessage({
      botToken: input.botToken,
      chatId,
      replyMarkup: {
        inline_keyboard: buildTelegramInlineKeyboard(
          input.settings,
          input.startParam,
          input.extraRows,
          { preferWebAppButtons },
        ),
      },
      text,
    });
  };

  try {
    await sendWithKeyboard(true);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "");

    if (!message.includes("BUTTON_URL_INVALID")) {
      throw error;
    }

    console.error("Telegram inline keyboard invalid, retrying with safer mode", {
      attemptedButtons: getInlineKeyboardDebugEntries(
        input.settings,
        input.startParam,
        input.extraRows,
        { preferWebAppButtons: true },
      ),
      botName: input.botName,
      chatId,
      error: message,
    });

    console.error("Telegram inline keyboard fallback failed, sending plain text only", {
      attemptedButtons: getInlineKeyboardDebugEntries(
        input.settings,
        input.startParam,
        input.extraRows,
        { preferWebAppButtons: true },
      ),
      botName: input.botName,
      chatId,
      error: message,
    });
    await sendTelegramBotMessage({
      botToken: input.botToken,
      chatId,
      text,
    });
  }

  return true;
}
