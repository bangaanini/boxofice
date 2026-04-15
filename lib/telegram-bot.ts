import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";

async function callTelegramBotApi(
  botToken: string,
  method: string,
  payload: unknown,
) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram Bot API ${method} gagal (${response.status})`);
  }
}

export async function sendTelegramUserMessage(input: {
  telegramId: string | null | undefined;
  text: string;
}) {
  if (!input.telegramId) {
    return false;
  }

  const settings = await getTelegramBotSettingsSafe();

  if (!settings.runtime.botToken) {
    return false;
  }

  await callTelegramBotApi(settings.runtime.botToken, "sendMessage", {
    chat_id: input.telegramId,
    text: input.text,
  });

  return true;
}
