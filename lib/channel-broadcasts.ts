import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sendTelegramBotPhoto, pinTelegramBotChatMessage } from "@/lib/telegram-bot-api";
import {
  buildChannelBroadcastStartParam,
  extractChannelBroadcastTokenFromStartParam,
} from "@/lib/channel-broadcast-tokens";
import { buildTelegramMiniAppUrlForConfig } from "@/lib/telegram-miniapp";
import { excludeBlockedMoviesWhere } from "@/lib/movie-visibility";

const DEFAULT_BROADCAST_BUTTON_LABEL = "▶️ Tonton Sekarang";
const MAX_CAPTION_LENGTH = 1024;

type PublishChannelBroadcastInput = {
  botKind: "default" | "partner";
  botToken: string;
  botUsername: string;
  buttonLabel: string;
  caption: string;
  channelUsername: string;
  miniAppShortName?: string | null;
  movieId: string;
  ownerUserId?: string | null;
  partnerBotId?: string | null;
  pinMessage?: boolean;
};

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function getDefaultChannelBroadcastButtonLabel() {
  return DEFAULT_BROADCAST_BUTTON_LABEL;
}

export function normalizeTelegramChannelUsername(value: string) {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  if (raw.startsWith("https://t.me/") || raw.startsWith("http://t.me/")) {
    try {
      const url = new URL(raw);
      const [firstSegment] = url.pathname.split("/").filter(Boolean);
      const normalized = firstSegment?.replace(/^@/, "") ?? "";

      if (/^[a-zA-Z0-9_]{4,64}$/.test(normalized)) {
        return normalized;
      }
    } catch {
      return null;
    }
  }

  const normalized = raw.replace(/^@/, "");

  if (!/^[a-zA-Z0-9_]{4,64}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function buildDefaultChannelBroadcastCaption(input: {
  botName: string;
  description?: string | null;
  title: string;
}) {
  const title = input.title.trim();
  const description = truncateText(input.description ?? "", 420);
  const lines = [title];

  if (description) {
    lines.push("", description);
  }

  lines.push("", `🎬 Buka sekarang di ${input.botName.trim()}.`);

  return lines.join("\n");
}

async function createUniqueChannelBroadcastToken() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const token = randomBytes(5).toString("hex");
    const existing = await prisma.channelBroadcast.findUnique({
      where: { token },
      select: { id: true },
    });

    if (!existing) {
      return token;
    }
  }

  return randomBytes(8).toString("hex");
}

export async function searchMoviesForChannelBroadcast(query: string) {
  const trimmedQuery = query.trim();

  return prisma.movie.findMany({
    where: excludeBlockedMoviesWhere({
      thumbnail: {
        not: null,
      },
      ...(trimmedQuery
        ? {
            OR: [
              {
                title: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    }),
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      description: true,
      id: true,
      rating: true,
      thumbnail: true,
      title: true,
      year: true,
    },
    take: 24,
  });
}

export async function listRecentChannelBroadcasts(input: {
  botKind?: "default" | "partner";
  limit?: number;
  ownerUserId?: string;
  partnerBotId?: string;
}) {
  return prisma.channelBroadcast.findMany({
    where: {
      ...(input.botKind ? { botKind: input.botKind } : {}),
      ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.partnerBotId ? { partnerBotId: input.partnerBotId } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      botUsername: true,
      buttonLabel: true,
      channelUsername: true,
      createdAt: true,
      id: true,
      movie: {
        select: {
          id: true,
          thumbnail: true,
          title: true,
        },
      },
      pinned: true,
      postedAt: true,
      telegramMessageId: true,
      token: true,
    },
    take: input.limit ?? 8,
  });
}

export async function resolveChannelBroadcastStartParam(
  startParam: string | null,
) {
  const token = extractChannelBroadcastTokenFromStartParam(startParam);

  if (!token) {
    return null;
  }

  const broadcast = await prisma.channelBroadcast.findUnique({
    where: { token },
    select: {
      movieId: true,
      token: true,
    },
  });

  if (!broadcast) {
    return null;
  }

  return broadcast;
}

export async function publishChannelBroadcast(
  input: PublishChannelBroadcastInput,
) {
  const normalizedChannelUsername = normalizeTelegramChannelUsername(
    input.channelUsername,
  );

  if (!normalizedChannelUsername) {
    throw new Error("Username channel wajib valid. Gunakan @channelkamu atau link t.me/channelkamu.");
  }

  const movie = await prisma.movie.findUnique({
    where: { id: input.movieId },
    select: {
      description: true,
      id: true,
      thumbnail: true,
      title: true,
    },
  });

  if (!movie) {
    throw new Error("Film untuk broadcast tidak ditemukan.");
  }

  if (!movie.thumbnail?.trim()) {
    throw new Error("Film ini belum punya poster, jadi belum bisa dibroadcast ke channel.");
  }

  const buttonLabel = input.buttonLabel.trim() || DEFAULT_BROADCAST_BUTTON_LABEL;
  const caption = input.caption.trim();

  if (!caption) {
    throw new Error("Caption broadcast wajib diisi.");
  }

  if (caption.length > MAX_CAPTION_LENGTH) {
    throw new Error("Caption terlalu panjang. Maksimal 1024 karakter untuk post bergambar Telegram.");
  }

  const token = await createUniqueChannelBroadcastToken();
  const startParam = buildChannelBroadcastStartParam(token);
  const deepLinkUrl = buildTelegramMiniAppUrlForConfig(
    {
      botUsername: input.botUsername,
      miniAppShortName: input.miniAppShortName ?? null,
    },
    startParam,
  );

  const draft = await prisma.channelBroadcast.create({
    data: {
      botKind: input.botKind,
      botUsername: input.botUsername.trim().replace(/^@/, ""),
      buttonLabel,
      caption,
      channelUsername: normalizedChannelUsername,
      movieId: movie.id,
      ownerUserId: input.ownerUserId ?? null,
      partnerBotId: input.partnerBotId ?? null,
      pinned: false,
      token,
    },
  });

  try {
    const sent = await sendTelegramBotPhoto({
      botToken: input.botToken,
      caption,
      chatId: `@${normalizedChannelUsername}`,
      photo: movie.thumbnail,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: buttonLabel,
              url: deepLinkUrl,
            },
          ],
        ],
      },
    });

    let pinError: string | null = null;

    if (input.pinMessage) {
      try {
        await pinTelegramBotChatMessage({
          botToken: input.botToken,
          chatId: `@${normalizedChannelUsername}`,
          disableNotification: true,
          messageId: sent.message_id,
        });
      } catch (error) {
        pinError =
          error instanceof Error ? error.message : "Pin post Telegram gagal.";
      }
    }

    const broadcast = await prisma.channelBroadcast.update({
      where: { id: draft.id },
      data: {
        pinned: input.pinMessage && !pinError,
        postedAt: new Date(),
        telegramMessageId: sent.message_id,
      },
    });

    return {
      broadcast,
      channelPostUrl:
        sent.message_id && normalizedChannelUsername
          ? `https://t.me/${normalizedChannelUsername}/${sent.message_id}`
          : null,
      deepLinkUrl,
      pinError,
    };
  } catch (error) {
    await prisma.channelBroadcast.delete({
      where: { id: draft.id },
    }).catch(() => undefined);

    throw error;
  }
}
