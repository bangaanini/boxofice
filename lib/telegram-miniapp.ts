import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramMiniAppUser = {
  allows_write_to_pm?: boolean;
  first_name?: string;
  id: number;
  is_bot?: boolean;
  is_premium?: boolean;
  language_code?: string;
  last_name?: string;
  photo_url?: string;
  username?: string;
};

export type ValidatedTelegramInitData = {
  authDate: Date;
  queryId: string | null;
  startParam: string | null;
  user: TelegramMiniAppUser;
};

export type TelegramRuntimeConfig = {
  botToken: string;
  botUsername: string;
  miniAppShortName: string | null;
  webhookSecret: string;
};

const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} belum diatur.`);
  }

  return value;
}

export function getTelegramBotToken() {
  return getRequiredEnv("TELEGRAM_BOT_TOKEN");
}

export function getTelegramBotUsername() {
  return getRequiredEnv("TELEGRAM_BOT_USERNAME").replace(/^@/, "");
}

export function getTelegramMiniAppShortName() {
  return process.env.TELEGRAM_MINI_APP_SHORT_NAME?.trim() || null;
}

export function getTelegramWebhookSecret() {
  return getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
}

export function getTelegramInitDataMaxAgeSeconds() {
  const raw = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? "");

  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_INIT_DATA_MAX_AGE_SECONDS;
  }

  return Math.trunc(raw);
}

export function buildTelegramBotChatUrlForUsername(
  botUsername: string,
  startParam?: string | null,
) {
  const normalizedUsername = botUsername.trim().replace(/^@/, "");
  const url = new URL(`https://t.me/${normalizedUsername}`);

  if (startParam) {
    url.searchParams.set("start", startParam);
  }

  return url.toString();
}

export function buildTelegramMiniAppUrlForConfig(
  input: Pick<TelegramRuntimeConfig, "botUsername" | "miniAppShortName">,
  startParam?: string | null,
) {
  const username = input.botUsername.trim().replace(/^@/, "");
  const url = input.miniAppShortName
    ? new URL(`https://t.me/${username}/${input.miniAppShortName}`)
    : new URL(`https://t.me/${username}`);

  if (startParam) {
    url.searchParams.set("startapp", startParam);
  }

  return url.toString();
}

export function buildTelegramMiniAppUrl(startParam?: string | null) {
  return buildTelegramMiniAppUrlForConfig(
    {
      botUsername: getTelegramBotUsername(),
      miniAppShortName: getTelegramMiniAppShortName(),
    },
    startParam,
  );
}

export function buildTelegramBotChatUrl(startParam?: string | null) {
  return buildTelegramBotChatUrlForUsername(getTelegramBotUsername(), startParam);
}

export function buildAffiliateStartParam(referralCode: string) {
  return `ref_${referralCode.trim().toUpperCase()}`;
}

export function buildTelegramAppStartParam(input: {
  movieId?: string | null;
  referralCode?: string | null;
}) {
  const parts: string[] = [];
  const referralCode = input.referralCode?.trim();
  const movieId = input.movieId?.trim();

  if (referralCode) {
    parts.push(buildAffiliateStartParam(referralCode));
  }

  if (movieId) {
    parts.push(`movie_${movieId}`);
  }

  return parts.join("__");
}

export function extractAffiliateCodeFromStartParam(startParam: string | null) {
  if (!startParam) {
    return null;
  }

  const normalized = startParam.trim();
  const referralMatch = normalized.match(/(?:^|__)ref_([a-z0-9]+)/i);
  const referralCode =
    referralMatch?.[1]?.trim().toUpperCase() ||
    (/^[A-Z0-9]{4,32}$/i.test(normalized) ? normalized.toUpperCase() : "");

  return referralCode || null;
}

export function extractMovieIdFromStartParam(startParam: string | null) {
  if (!startParam) {
    return null;
  }

  const normalized = startParam.trim();
  const movieMatch = normalized.match(/(?:^|__)movie_([a-z0-9-]+)/i);
  const movieId = movieMatch?.[1]?.trim() ?? "";

  if (!movieId || !/^[a-z0-9-]+$/i.test(movieId)) {
    return null;
  }

  return movieId;
}

function parseTelegramUser(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as TelegramMiniAppUser;
  } catch {
    return null;
  }
}

function createTelegramSecretKey(botToken: string) {
  return createHmac("sha256", "WebAppData").update(botToken).digest();
}

export function validateTelegramInitData(
  initData: string,
  botToken = getTelegramBotToken(),
) {
  const parsed = new URLSearchParams(initData);
  const providedHash = parsed.get("hash");

  if (!providedHash) {
    throw new Error("Hash Telegram tidak ditemukan.");
  }

  const dataCheckString = Array.from(parsed.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const actualHash = createHmac(
    "sha256",
    createTelegramSecretKey(botToken),
  )
    .update(dataCheckString)
    .digest("hex");

  const isValid = timingSafeEqual(
    Buffer.from(actualHash, "hex"),
    Buffer.from(providedHash, "hex"),
  );

  if (!isValid) {
    throw new Error("Validasi Telegram gagal.");
  }

  const authDateValue = Number(parsed.get("auth_date") ?? "0");

  if (!Number.isFinite(authDateValue) || authDateValue <= 0) {
    throw new Error("auth_date Telegram tidak valid.");
  }

  const authDate = new Date(authDateValue * 1000);
  const maxAgeSeconds = getTelegramInitDataMaxAgeSeconds();

  if (Date.now() - authDate.getTime() > maxAgeSeconds * 1000) {
    throw new Error("Data Telegram sudah kedaluwarsa. Buka ulang Mini App.");
  }

  const user = parseTelegramUser(parsed.get("user"));

  if (!user?.id) {
    throw new Error("Data user Telegram tidak ditemukan.");
  }

  return {
    authDate,
    queryId: parsed.get("query_id"),
    startParam: parsed.get("start_param"),
    user,
  } satisfies ValidatedTelegramInitData;
}
