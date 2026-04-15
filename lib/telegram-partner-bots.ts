import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  getTelegramBotSettingsSafe,
  type TelegramBotSettingsSnapshot,
} from "@/lib/telegram-bot-settings";
import {
  buildAffiliateStartParam,
  buildTelegramBotChatUrlForUsername,
  buildTelegramMiniAppUrlForConfig,
  validateTelegramInitData,
} from "@/lib/telegram-miniapp";

export type PartnerBotSettingsOverrides = Partial<
  Pick<
    TelegramBotSettingsSnapshot,
    | "affiliateGroupLabel"
    | "affiliateGroupUrl"
    | "affiliateLabel"
    | "affiliateUrl"
    | "channelLabel"
    | "channelUrl"
    | "openAppLabel"
    | "openAppUrl"
    | "searchLabel"
    | "searchUrl"
    | "supportLabel"
    | "supportUrl"
    | "vipLabel"
    | "vipUrl"
    | "welcomeMessage"
  >
> & {
  settingsLabel?: string;
};

export const PARTNER_BOT_OVERRIDE_KEYS = [
  "affiliateGroupLabel",
  "affiliateGroupUrl",
  "affiliateLabel",
  "affiliateUrl",
  "channelLabel",
  "channelUrl",
  "openAppLabel",
  "openAppUrl",
  "searchLabel",
  "searchUrl",
  "settingsLabel",
  "supportLabel",
  "supportUrl",
  "vipLabel",
  "vipUrl",
  "welcomeMessage",
] as const;

function isRecordWithCode(
  error: unknown,
): error is { code?: string; message?: string } {
  return typeof error === "object" && error !== null;
}

function isMissingPartnerBotSchemaError(error: unknown) {
  if (!isRecordWithCode(error)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  return (
    typeof error.message === "string" &&
    error.message.includes("PartnerBot")
  );
}

export function createPartnerBotWebhookSecret() {
  return randomBytes(24).toString("hex");
}

export function getDefaultPartnerSettingsButtonLabel() {
  return "⚙️ Setting bot";
}

export function buildPartnerBotOwnerSettingsUrl(
  publicAppUrl: string,
  partnerBotId: string,
) {
  const url = new URL(
    `${publicAppUrl.replace(/\/+$/, "")}/partner-bot/settings`,
  );

  url.searchParams.set("bot", partnerBotId);

  return url.toString();
}

export function buildPartnerBotWebhookUrl(
  publicAppUrl: string,
  partnerBotId: string,
) {
  return `${publicAppUrl.replace(/\/+$/, "")}/api/telegram/partner-webhook/${partnerBotId}`;
}

export function buildPartnerBotLinks(input: {
  botUsername: string;
  miniAppShortName: string | null;
  referralCode: string;
}) {
  const startParam = buildAffiliateStartParam(input.referralCode);

  return {
    miniAppUrl: buildTelegramMiniAppUrlForConfig(
      {
        botUsername: input.botUsername,
        miniAppShortName: input.miniAppShortName,
      },
      startParam,
    ),
    startChatUrl: buildTelegramBotChatUrlForUsername(
      input.botUsername,
      startParam,
    ),
    startParam,
  };
}

export function sanitizePartnerBotSettingsOverrides(
  value: unknown,
): PartnerBotSettingsOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const sanitized: PartnerBotSettingsOverrides = {};

  for (const key of PARTNER_BOT_OVERRIDE_KEYS) {
    const rawValue = input[key];

    if (typeof rawValue !== "string") {
      continue;
    }

    const trimmedValue = rawValue.trim();

    if (!trimmedValue) {
      continue;
    }

    sanitized[key] = trimmedValue;
  }

  return sanitized;
}

export function resolvePartnerBotSettings(
  globalSettings: TelegramBotSettingsSnapshot,
  overridesValue: unknown,
) {
  const overrides = sanitizePartnerBotSettingsOverrides(overridesValue);

  return {
    overrides,
    settings: {
      ...globalSettings,
      affiliateGroupLabel:
        overrides.affiliateGroupLabel ?? globalSettings.affiliateGroupLabel,
      affiliateGroupUrl:
        overrides.affiliateGroupUrl ?? globalSettings.affiliateGroupUrl,
      affiliateLabel: overrides.affiliateLabel ?? globalSettings.affiliateLabel,
      affiliateUrl: overrides.affiliateUrl ?? globalSettings.affiliateUrl,
      channelLabel: overrides.channelLabel ?? globalSettings.channelLabel,
      channelUrl: overrides.channelUrl ?? globalSettings.channelUrl,
      openAppLabel: overrides.openAppLabel ?? globalSettings.openAppLabel,
      openAppUrl: overrides.openAppUrl ?? globalSettings.openAppUrl,
      searchLabel: overrides.searchLabel ?? globalSettings.searchLabel,
      searchUrl: overrides.searchUrl ?? globalSettings.searchUrl,
      supportLabel: overrides.supportLabel ?? globalSettings.supportLabel,
      supportUrl: overrides.supportUrl ?? globalSettings.supportUrl,
      vipLabel: overrides.vipLabel ?? globalSettings.vipLabel,
      vipUrl: overrides.vipUrl ?? globalSettings.vipUrl,
      welcomeMessage:
        overrides.welcomeMessage ?? globalSettings.welcomeMessage,
    },
    settingsLabel:
      overrides.settingsLabel?.trim() || getDefaultPartnerSettingsButtonLabel(),
  };
}

export async function getPreferredPartnerBotShareLink(input: {
  referralCode: string;
  userId: string;
}) {
  try {
    const partnerBot = await prisma.partnerBot.findFirst({
      where: {
        active: true,
        ownerUserId: input.userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        botUsername: true,
        miniAppShortName: true,
      },
    });

    if (!partnerBot) {
      return null;
    }

    return buildPartnerBotLinks({
      botUsername: partnerBot.botUsername,
      miniAppShortName: partnerBot.miniAppShortName,
      referralCode: input.referralCode,
    }).startChatUrl;
  } catch (error) {
    if (isMissingPartnerBotSchemaError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getPartnerBotForWebhook(partnerBotId: string) {
  return prisma.partnerBot.findUnique({
    where: { id: partnerBotId },
    select: {
      active: true,
      botName: true,
      botToken: true,
      botUsername: true,
      id: true,
      label: true,
      miniAppShortName: true,
      settingsOverrides: true,
      owner: {
        select: {
          id: true,
          name: true,
          telegramId: true,
          affiliateProfile: {
            select: {
              referralCode: true,
            },
          },
        },
      },
      webhookSecret: true,
    },
  });
}

export async function listPartnerBotsForAdmin() {
  const [telegram, users, partnerBots] = await Promise.all([
    getTelegramBotSettingsSafe(),
    prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        affiliateProfile: {
          select: {
            referralCode: true,
          },
        },
        id: true,
        name: true,
        telegramUsername: true,
      },
      take: 300,
    }),
    prisma.partnerBot.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        active: true,
        botName: true,
        botToken: true,
        botUsername: true,
        createdAt: true,
        id: true,
        label: true,
        miniAppShortName: true,
        settingsOverrides: true,
        owner: {
          select: {
            affiliateProfile: {
              select: {
                referralCode: true,
              },
            },
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
        telegramBotId: true,
        updatedAt: true,
        webhookSecret: true,
      },
    }),
  ]);

  return {
    owners: users,
    partnerBots: partnerBots.map((partnerBot) => ({
      ...partnerBot,
      links: partnerBot.owner.affiliateProfile?.referralCode
        ? buildPartnerBotLinks({
            botUsername: partnerBot.botUsername,
            miniAppShortName: partnerBot.miniAppShortName,
            referralCode: partnerBot.owner.affiliateProfile.referralCode,
          })
        : null,
      webhookUrl: buildPartnerBotWebhookUrl(
        telegram.runtime.publicAppUrl,
        partnerBot.id,
      ),
    })),
    publicAppUrl: telegram.runtime.publicAppUrl,
  };
}

export async function getOwnedPartnerBotsForUser(userId: string) {
  const telegram = await getTelegramBotSettingsSafe();
  const partnerBots = await prisma.partnerBot.findMany({
    where: {
      ownerUserId: userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      active: true,
      botName: true,
      botUsername: true,
      id: true,
      label: true,
      miniAppShortName: true,
      owner: {
        select: {
          affiliateProfile: {
            select: {
              referralCode: true,
            },
          },
        },
      },
      settingsOverrides: true,
      updatedAt: true,
    },
  });

  return partnerBots.map((partnerBot) => {
    const resolved = resolvePartnerBotSettings(
      telegram.settings,
      partnerBot.settingsOverrides,
    );
    const referralCode = partnerBot.owner.affiliateProfile?.referralCode ?? null;

    return {
      ...partnerBot,
      currentReferralCode: referralCode,
      effectiveSettings: resolved.settings,
      ownerSettingsButtonLabel: resolved.settingsLabel,
      rawOverrides: resolved.overrides,
      settingsUrl: buildPartnerBotOwnerSettingsUrl(
        telegram.runtime.publicAppUrl,
        partnerBot.id,
      ),
      shareLinks: referralCode
        ? buildPartnerBotLinks({
            botUsername: partnerBot.botUsername,
            miniAppShortName: partnerBot.miniAppShortName,
            referralCode,
          })
        : null,
    };
  });
}

export type TelegramMatchedBotCandidate =
  | {
      botToken: string;
      botUsername: string;
      id: "default";
      kind: "default";
      ownerReferralCode: null;
    }
  | {
      botToken: string;
      botUsername: string;
      id: string;
      kind: "partner";
      ownerReferralCode: string;
    };

export async function validateTelegramInitDataWithKnownBots(initData: string) {
  const telegram = await getTelegramBotSettingsSafe();
  const candidates: TelegramMatchedBotCandidate[] = [];

  if (telegram.runtime.botToken) {
    candidates.push({
      botToken: telegram.runtime.botToken,
      botUsername: telegram.runtime.botUsername,
      id: "default",
      kind: "default",
      ownerReferralCode: null,
    });
  }

  try {
    const partnerBots = await prisma.partnerBot.findMany({
      where: {
        active: true,
      },
      select: {
        botToken: true,
        botUsername: true,
        id: true,
        owner: {
          select: {
            affiliateProfile: {
              select: {
                referralCode: true,
              },
            },
          },
        },
      },
    });

    for (const partnerBot of partnerBots) {
      const ownerReferralCode = partnerBot.owner.affiliateProfile?.referralCode;

      if (!ownerReferralCode) {
        continue;
      }

      candidates.push({
        botToken: partnerBot.botToken,
        botUsername: partnerBot.botUsername,
        id: partnerBot.id,
        kind: "partner",
        ownerReferralCode,
      });
    }
  } catch (error) {
    if (!isMissingPartnerBotSchemaError(error)) {
      throw error;
    }
  }

  const seenTokens = new Set<string>();
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const normalizedToken = candidate.botToken.trim();

    if (!normalizedToken || seenTokens.has(normalizedToken)) {
      continue;
    }

    seenTokens.add(normalizedToken);

    try {
      return {
        matchedBot: candidate,
        telegram: validateTelegramInitData(initData, normalizedToken),
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Validasi Telegram gagal.");
    }
  }

  throw lastError ?? new Error("Tidak ada bot Telegram aktif yang cocok.");
}
