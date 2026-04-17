type TelegramApiEnvelope<T> = {
  description?: string;
  ok?: boolean;
  result?: T;
};

type TelegramBotProfile = {
  first_name?: string;
  id: number;
  is_bot?: boolean;
  username?: string;
};

type TelegramMessageResult = {
  message_id: number;
};

function trimToken(botToken: string) {
  const trimmed = botToken.trim();

  if (!trimmed) {
    throw new Error("Bot token Telegram wajib diisi.");
  }

  return trimmed;
}

export async function callTelegramBotApi<T>(
  botToken: string,
  method: string,
  options?: {
    method?: "GET" | "POST";
    payload?: unknown;
  },
) {
  const httpMethod = options?.method ?? "POST";
  const response = await fetch(
    `https://api.telegram.org/bot${trimToken(botToken)}/${method}`,
    {
      body:
        httpMethod === "POST" && typeof options?.payload !== "undefined"
          ? JSON.stringify(options.payload)
          : undefined,
      cache: "no-store",
      headers:
        httpMethod === "POST"
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
      method: httpMethod,
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | TelegramApiEnvelope<T>
    | null;

  if (!response.ok || !payload?.ok || typeof payload.result === "undefined") {
    throw new Error(
      payload?.description?.trim() ||
        `Telegram Bot API ${method} gagal (${response.status})`,
    );
  }

  return payload.result;
}

export async function getTelegramBotProfile(botToken: string) {
  const result = await callTelegramBotApi<TelegramBotProfile>(botToken, "getMe", {
    method: "GET",
  });

  if (!result.id || !result.username) {
    throw new Error("Telegram getMe tidak mengembalikan identitas bot lengkap.");
  }

  return {
    botName: result.first_name?.trim() || result.username.trim(),
    botUsername: result.username.trim().replace(/^@/, ""),
    telegramBotId: String(result.id),
  };
}

export async function sendTelegramBotMessage(input: {
  botToken: string;
  chatId: number | string;
  replyMarkup?: Record<string, unknown>;
  text: string;
}) {
  return callTelegramBotApi<TelegramMessageResult>(input.botToken, "sendMessage", {
    method: "POST",
    payload: {
      chat_id: input.chatId,
      reply_markup: input.replyMarkup,
      text: input.text,
    },
  });
}

export async function sendTelegramBotPhoto(input: {
  botToken: string;
  caption?: string;
  chatId: number | string;
  photo: string;
  replyMarkup?: Record<string, unknown>;
}) {
  return callTelegramBotApi<TelegramMessageResult>(input.botToken, "sendPhoto", {
    method: "POST",
    payload: {
      caption: input.caption,
      chat_id: input.chatId,
      photo: input.photo,
      reply_markup: input.replyMarkup,
    },
  });
}

export async function pinTelegramBotChatMessage(input: {
  botToken: string;
  chatId: number | string;
  disableNotification?: boolean;
  messageId: number;
}) {
  return callTelegramBotApi<boolean>(input.botToken, "pinChatMessage", {
    method: "POST",
    payload: {
      chat_id: input.chatId,
      disable_notification: input.disableNotification ?? true,
      message_id: input.messageId,
    },
  });
}
