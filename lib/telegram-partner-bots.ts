import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  buildLegacyInlineButtonsFromSettings,
  getTelegramBotSettingsSafe,
  type TelegramInlineButtonConfig,
  type TelegramBotSettingsSnapshot,
} from "@/lib/telegram-bot-settings";
import {
  buildAffiliateStartParam,
  buildTelegramBotChatUrlForUsername,
  buildTelegramMainMiniAppUrlForUsername,
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
  inlineButtons?: TelegramInlineButtonConfig[];
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
    mainMiniAppUrl: buildTelegramMainMiniAppUrlForUsername(
      input.botUsername,
      startParam,
    ),
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

  if (Array.isArray(input.inlineButtons)) {
    sanitized.inlineButtons = input.inlineButtons
      .map((button, index) => {
        if (!button || typeof button !== "object" || Array.isArray(button)) {
          return null;
        }

        const item = button as Record<string, unknown>;
        const label =
          typeof item.label === "string" ? item.label.trim() : "";
        const url = typeof item.url === "string" ? item.url.trim() : "";
        const enabled =
          typeof item.enabled === "boolean" ? item.enabled : false;

        return {
          enabled: enabled && Boolean(label && url),
          id:
            typeof item.id === "string" && item.id.trim()
              ? item.id.trim()
              : `button${index + 1}`,
          label,
          url,
        } satisfies TelegramInlineButtonConfig;
      })
      .filter((button): button is TelegramInlineButtonConfig => button !== null);
  }

  return sanitized;
}

export function resolvePartnerBotSettings(
  globalSettings: TelegramBotSettingsSnapshot,
  overridesValue: unknown,
) {
  const overrides = sanitizePartnerBotSettingsOverrides(overridesValue);
  const effectiveLegacySettings = {
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
  };
  const partnerInlineButtons =
    overrides.inlineButtons && overrides.inlineButtons.length > 0
      ? globalSettings.inlineButtons.map((button, index) => {
          const overrideButton = overrides.inlineButtons?.[index];
          return overrideButton ?? button;
        })
      : buildLegacyInlineButtonsFromSettings(effectiveLegacySettings);

  return {
    overrides,
    settings: {
      ...globalSettings,
      ...effectiveLegacySettings,
      inlineButtons:
        overrides.inlineButtons && overrides.inlineButtons.length > 0
          ? partnerInlineButtons
          : globalSettings.inlineButtons.map((button, index) =>
              index < partnerInlineButtons.length &&
              partnerInlineButtons[index] &&
              index < 7
                ? partnerInlineButtons[index]
                : button,
            ),
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
    }).mainMiniAppUrl;
  } catch (error) {
    if (isMissingPartnerBotSchemaError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getPreferredTelegramShareLinksForUser(input: {
  startParam: string;
  userId: string;
}) {
  const telegram = await getTelegramBotSettingsSafe();
  const fallback = {
    chatUrl: buildTelegramBotChatUrlForUsername(
      telegram.runtime.botUsername,
      input.startParam,
    ),
    mainMiniAppUrl: buildTelegramMainMiniAppUrlForUsername(
      telegram.runtime.botUsername,
      input.startParam,
    ),
    miniAppUrl: buildTelegramMiniAppUrlForConfig(
      {
        botUsername: telegram.runtime.botUsername,
        miniAppShortName: telegram.runtime.miniAppShortName,
      },
      input.startParam,
    ),
    source: "default" as const,
  };

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
      return fallback;
    }

    return {
      chatUrl: buildTelegramBotChatUrlForUsername(
        partnerBot.botUsername,
        input.startParam,
      ),
      mainMiniAppUrl: buildTelegramMainMiniAppUrlForUsername(
        partnerBot.botUsername,
        input.startParam,
      ),
      miniAppUrl: buildTelegramMiniAppUrlForConfig(
        {
          botUsername: partnerBot.botUsername,
          miniAppShortName: partnerBot.miniAppShortName,
        },
        input.startParam,
      ),
      source: "partner" as const,
    };
  } catch (error) {
    if (isMissingPartnerBotSchemaError(error)) {
      return fallback;
    }

    throw error;
  }
}

export async function getPreferredAffiliateNotificationBotForUser(userId: string) {
  const telegram = await getTelegramBotSettingsSafe();
  const fallback = {
    affiliateUrl: `${telegram.runtime.publicAppUrl}/affiliate`,
    botLabel: telegram.runtime.botUsername || "Box Office",
    botToken: telegram.runtime.botToken || null,
    kind: "default" as const,
  };

  try {
    const partnerBot = await prisma.partnerBot.findFirst({
      where: {
        active: true,
        ownerUserId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        botName: true,
        botToken: true,
        label: true,
      },
    });

    if (!partnerBot?.botToken?.trim()) {
      return fallback;
    }

    return {
      affiliateUrl: `${telegram.runtime.publicAppUrl}/affiliate`,
      botLabel: partnerBot.label?.trim() || partnerBot.botName,
      botToken: partnerBot.botToken.trim(),
      kind: "partner" as const,
    };
  } catch (error) {
    if (isMissingPartnerBotSchemaError(error)) {
      return fallback;
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
          telegramUsername: true,
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
        defaultChannelUsername: true,
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
      defaultChannelUsername: true,
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
