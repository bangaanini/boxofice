import { randomBytes } from "node:crypto";

import { getBotContextFields, type ActiveBotContext } from "@/lib/bot-access";
import { prisma } from "@/lib/prisma";
import {
  getPreferredTelegramShareLinksForUser,
} from "@/lib/telegram-partner-bots";
import {
  getEnvPublicAppUrl,
  getTelegramBotSettingsSafe,
} from "@/lib/telegram-bot-settings";
import {
  buildAffiliateStartParam,
  buildTelegramMiniAppUrlForConfig,
} from "@/lib/telegram-miniapp";

export const AFFILIATE_MINIMUM_WITHDRAW = 50_000;
export const DEFAULT_AFFILIATE_COMMISSION_RATE = 25;
export const DEFAULT_AFFILIATE_HOW_IT_WORKS_CONTENT =
  "Bagikan link\n" +
  "Sebarkan deep link Telegram kamu ke grup, channel, WhatsApp, TikTok bio, atau story.\n\n" +
  "Teman mendaftar\n" +
  "User baru masuk lewat bot kamu lalu langsung membuka Mini App dengan akun Telegram mereka.\n\n" +
  "Komisi masuk\n" +
  "Saat referral berlangganan dan pembayaran sukses, komisi dihitung otomatis.\n\n" +
  "Tarik saldo\n" +
  "Saldo yang sudah memenuhi minimum withdrawal bisa langsung diajukan ke admin.";
export const DEFAULT_AFFILIATE_RULES_CONTENT =
  "Kapan referral dihitung aktif?\n" +
  "Referral aktif dihitung dari user referral yang sudah pernah sukses membeli paket minimal satu kali.\n\n" +
  "Bagaimana komisi dihitung?\n" +
  "Komisi dihitung dari transaksi VIP yang sudah sukses dibayar oleh user referral.\n\n" +
  "Kapan saldo bisa ditarik?\n" +
  "Saldo bisa diajukan setelah mencapai minimum Rp 50.000. Pencairan komisi hanya bisa diajukan jika saldo tersedia sudah mencapai minimum penarikan.\n\n" +
  "Kalau butuh strategi promosi, mulai dari mana?\n" +
  "Mulai dari platform yang sudah kamu kuasai, fokus ke short video, potongan adegan menarik, lalu arahkan audiens ke link affiliate kamu dengan CTA yang konsisten.";

type AffiliateProgramSettingsSnapshot = {
  createdAt: Date;
  defaultCommissionRate: number;
  howItWorksContent: string;
  id: string;
  rulesContent: string;
  slug: string;
  updatedAt: Date;
};

type AffiliateProgramSettingsResult = {
  schemaIssue: string | null;
  schemaReady: boolean;
  settings: AffiliateProgramSettingsSnapshot;
};

type AffiliateUser = {
  id: string;
  name: string;
};

export type AffiliateStepItem = {
  description: string;
  title: string;
};

export type AffiliateAccordionItem = {
  answer: string;
  question: string;
};

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase();
}

function roundCommissionAmount(amount: number, rate: number) {
  return Math.max(0, Math.round((amount * rate) / 100));
}

function isRecordWithCode(
  error: unknown,
): error is { code?: string; message?: string; meta?: unknown } {
  return typeof error === "object" && error !== null;
}

function isMissingAffiliateSchemaError(error: unknown) {
  if (!isRecordWithCode(error)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";

  return (
    message.includes("AffiliateProgramSettings") ||
    message.includes("commissionRate") ||
    message.includes("AffiliateProfile") ||
    message.includes("AffiliateReferral") ||
    message.includes("botKind") ||
    message.includes("partnerBotId") ||
    message.includes("TelegramReferralIntent")
  );
}

function referralBaseFromName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return cleaned.slice(0, 6) || "BOX";
}

async function generateUniqueReferralCode(name: string) {
  const base = referralBaseFromName(name);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const referralCode = `${base}${suffix}`;
    const exists = await prisma.affiliateProfile.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!exists) {
      return referralCode;
    }
  }

  return `${base}${Date.now().toString(36).toUpperCase()}`;
}

export async function getAffiliateSharePath(
  referralCode: string,
  userId?: string,
) {
  const startParam = buildAffiliateStartParam(referralCode);

  if (userId) {
    const preferredShareLinks = await getPreferredTelegramShareLinksForUser({
      startParam,
      userId,
    }).catch(() => null);

    if (preferredShareLinks?.mainMiniAppUrl) {
      return preferredShareLinks.mainMiniAppUrl;
    }

    if (preferredShareLinks?.miniAppUrl) {
      return preferredShareLinks.miniAppUrl;
    }
  }

  try {
    const telegram = await getTelegramBotSettingsSafe();

    return buildTelegramMiniAppUrlForConfig(telegram.runtime, startParam);
  } catch {
    return `/r/${encodeURIComponent(referralCode)}`;
  }
}

export function getAffiliateWebSharePath(referralCode: string) {
  const trimmed = referralCode.trim();

  if (!trimmed) {
    return getEnvPublicAppUrl();
  }

  const base = getEnvPublicAppUrl().replace(/\/+$/, "");
  return `${base}/r/${encodeURIComponent(trimmed.toUpperCase())}?w=1`;
}

export async function ensureAffiliateProgramSettings() {
  const existing = await prisma.affiliateProgramSettings.findUnique({
    where: { slug: "default" },
  });

  if (existing) {
    return existing;
  }

  return prisma.affiliateProgramSettings.create({
    data: {
      defaultCommissionRate: DEFAULT_AFFILIATE_COMMISSION_RATE,
      howItWorksContent: DEFAULT_AFFILIATE_HOW_IT_WORKS_CONTENT,
      rulesContent: DEFAULT_AFFILIATE_RULES_CONTENT,
      slug: "default",
    },
  });
}

export async function getAffiliateProgramSettingsSafe(): Promise<AffiliateProgramSettingsResult> {
  try {
    const settings = await ensureAffiliateProgramSettings();

    return {
      schemaIssue: null,
      schemaReady: true,
      settings,
    };
  } catch (error) {
    if (!isMissingAffiliateSchemaError(error)) {
      throw error;
    }

    return {
      schemaIssue:
        "Tabel affiliate settings belum ada di database runtime. Jalankan migration terbaru agar pengaturan komisi aktif penuh.",
      schemaReady: false,
      settings: {
        createdAt: new Date(0),
        defaultCommissionRate: DEFAULT_AFFILIATE_COMMISSION_RATE,
        howItWorksContent: DEFAULT_AFFILIATE_HOW_IT_WORKS_CONTENT,
        id: "affiliate-settings-fallback",
        rulesContent: DEFAULT_AFFILIATE_RULES_CONTENT,
        slug: "default",
        updatedAt: new Date(0),
      },
    };
  }
}

export async function getAffiliateProfileCountSafe() {
  try {
    return {
      count: await prisma.affiliateProfile.count(),
      schemaIssue: null,
      schemaReady: true,
    };
  } catch (error) {
    if (!isMissingAffiliateSchemaError(error)) {
      throw error;
    }

    return {
      count: 0,
      schemaIssue:
        "Tabel affiliate profile belum siap di database runtime. Data affiliate ditampilkan sebagai fallback sementara.",
      schemaReady: false,
    };
  }
}

export async function ensureAffiliateProfile(user: AffiliateUser) {
  const profile = await ensureAffiliateProfileWithCode(user);

  return {
    id: profile.id,
  };
}

export async function ensureAffiliateProfileWithCode(user: AffiliateUser) {
  const existing = await prisma.affiliateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, referralCode: true },
  });

  if (existing) {
    return existing;
  }

  const referralCode = await generateUniqueReferralCode(user.name);

  return prisma.affiliateProfile.create({
    data: {
      minimumWithdraw: AFFILIATE_MINIMUM_WITHDRAW,
      referralCode,
      userId: user.id,
    },
    select: { id: true, referralCode: true },
  });
}

export async function getAffiliateDashboard(user: AffiliateUser) {
  const profile = await ensureAffiliateProfile(user);

  return prisma.affiliateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      activities: {
        where: {
          type: {
            in: [
              "commission_earned",
              "payout_requested",
              "payout_approved",
              "payout_rejected",
              "payout_paid",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      payoutRequests: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          accountNumber: true,
          amount: true,
          createdAt: true,
          id: true,
          note: true,
          payoutMethod: true,
          payoutProvider: true,
          processedAt: true,
          recipientName: true,
          status: true,
        },
      },
      referrals: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          activatedAt: true,
          commissionEarned: true,
          createdAt: true,
          id: true,
          referredUser: {
            select: {
              name: true,
            },
          },
          status: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  });
}

function parseAffiliateContentBlocks(content: string) {
  return content
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [titleLine, ...descriptionLines] = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      return {
        body: descriptionLines.join(" ").trim(),
        title: titleLine?.trim() ?? "",
      };
    })
    .filter((item) => item.title && item.body);
}

export function getAffiliateHowItWorksItems(
  content: string | null | undefined,
): AffiliateStepItem[] {
  return parseAffiliateContentBlocks(
    content?.trim() || DEFAULT_AFFILIATE_HOW_IT_WORKS_CONTENT,
  ).map((item) => ({
    description: item.body,
    title: item.title,
  }));
}

export function getAffiliateRuleItems(
  content: string | null | undefined,
): AffiliateAccordionItem[] {
  return parseAffiliateContentBlocks(
    content?.trim() || DEFAULT_AFFILIATE_RULES_CONTENT,
  ).map((item) => ({
    answer: item.body,
    question: item.title,
  }));
}

export async function recordAffiliateInteraction(input: {
  type: "copy_link" | "share_link";
  userId: string;
}) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });

  if (!profile) {
    return null;
  }

  const config =
    input.type === "copy_link"
      ? {
          description: "Link referral berhasil disalin dari dashboard affiliate.",
          title: "Link affiliate disalin",
        }
      : {
          description: "Link referral dibagikan dari dashboard affiliate.",
          title: "Link affiliate dibagikan",
        };

  return prisma.affiliateActivity.create({
    data: {
      description: config.description,
      profileId: profile.id,
      title: config.title,
      type: input.type,
    },
    select: { id: true },
  });
}

export async function registerAffiliateClick(referralCode: string) {
  const normalizedCode = normalizeReferralCode(referralCode);
  const profile = await prisma.affiliateProfile.findUnique({
    where: { referralCode: normalizedCode },
    select: { id: true },
  });

  if (!profile) {
    return null;
  }

  await prisma.affiliateProfile.update({
    where: { id: profile.id },
    data: {
      totalClicks: {
        increment: 1,
      },
    },
  });

  return profile.id;
}

export async function saveTelegramReferralIntent(input: {
  referralCode: string;
  telegramId: string | number | null | undefined;
}) {
  const telegramId = String(input.telegramId ?? "").trim();
  const normalizedCode = normalizeReferralCode(input.referralCode);

  if (!telegramId || !normalizedCode) {
    return null;
  }

  try {
    return await prisma.telegramReferralIntent.upsert({
      where: { telegramId },
      update: {
        consumedAt: null,
        referralCode: normalizedCode,
      },
      create: {
        referralCode: normalizedCode,
        telegramId,
      },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingAffiliateSchemaError(error)) {
      return null;
    }

    throw error;
  }
}

export async function consumeTelegramReferralIntent(input: {
  telegramId: string | number | null | undefined;
}) {
  const telegramId = String(input.telegramId ?? "").trim();

  if (!telegramId) {
    return null;
  }

  try {
    const intent = await prisma.telegramReferralIntent.findUnique({
      where: { telegramId },
      select: {
        consumedAt: true,
        id: true,
        referralCode: true,
      },
    });

    if (!intent || intent.consumedAt) {
      return null;
    }

    await prisma.telegramReferralIntent.update({
      where: { id: intent.id },
      data: {
        consumedAt: new Date(),
      },
    });

    return normalizeReferralCode(intent.referralCode);
  } catch (error) {
    if (isMissingAffiliateSchemaError(error)) {
      return null;
    }

    throw error;
  }
}

export async function attachAffiliateReferral(input: {
  botContext?: ActiveBotContext | null;
  referralCode?: string | null;
  referredUserId: string;
}) {
  const normalizedCode = input.referralCode
    ? normalizeReferralCode(input.referralCode)
    : "";

  if (!normalizedCode) {
    return null;
  }

  const profile = await prisma.affiliateProfile.findUnique({
    where: { referralCode: normalizedCode },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!profile || profile.userId === input.referredUserId) {
    return null;
  }

  const botContextFields = getBotContextFields(input.botContext);
  const existingReferral = await prisma.affiliateReferral.findUnique({
    where: { referredUserId: input.referredUserId },
    select: {
      botKind: true,
      id: true,
      partnerBotId: true,
    },
  });

  if (existingReferral) {
    if (
      botContextFields.botKind === "partner" &&
      (existingReferral.botKind !== "partner" || !existingReferral.partnerBotId)
    ) {
      await prisma.affiliateReferral.update({
        where: { id: existingReferral.id },
        data: botContextFields,
      }).catch(() => undefined);
    }

    return existingReferral;
  }

  const referral = await prisma.$transaction(async (tx) => {
    const createdReferral = await tx.affiliateReferral.create({
      data: {
        ...botContextFields,
        profileId: profile.id,
        referredUserId: input.referredUserId,
      },
      select: { id: true },
    });

    await tx.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        totalSignups: {
          increment: 1,
        },
      },
    });

    await tx.affiliateActivity.create({
      data: {
        description:
          "Satu user baru membuat akun lewat link affiliate kamu. Komisi akan aktif saat referral berlangganan.",
        profileId: profile.id,
        title: "Referral baru mendaftar",
        type: "referral_signup",
      },
    });

    return createdReferral;
  });

  return referral;
}

export async function requestAffiliatePayout(input: {
  accountNumber: string;
  amount: number;
  payoutMethod: string;
  payoutProvider: string;
  recipientName: string;
  userId: string;
}) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: input.userId },
    select: {
      availableBalance: true,
      id: true,
      minimumWithdraw: true,
      payoutRequests: {
        where: {
          status: "pending",
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!profile) {
    throw new Error("Profil affiliate belum tersedia.");
  }

  if (profile.payoutRequests.length > 0) {
    throw new Error("Masih ada permintaan penarikan yang sedang diproses.");
  }

  const amount = Math.trunc(input.amount);
  const payoutMethod =
    input.payoutMethod === "ewallet" ? "ewallet" : "bank";
  const payoutProvider = input.payoutProvider.trim();
  const recipientName = input.recipientName.trim();
  const accountNumber = input.accountNumber.trim();

  if (amount < profile.minimumWithdraw) {
    throw new Error("Saldo belum memenuhi minimum penarikan.");
  }

  if (amount > profile.availableBalance) {
    throw new Error("Saldo yang bisa ditarik tidak mencukupi.");
  }

  if (payoutProvider.length < 2) {
    throw new Error("Metode pembayaran wajib dipilih.");
  }

  if (recipientName.length < 2) {
    throw new Error("Nama penerima minimal 2 karakter.");
  }

  if (accountNumber.length < 4) {
    throw new Error("Nomor rekening atau e-wallet belum valid.");
  }

  const payout = await prisma.$transaction(async (tx) => {
    const createdPayout = await tx.affiliatePayoutRequest.create({
      data: {
        accountNumber,
        amount,
        payoutMethod,
        payoutProvider,
        profileId: profile.id,
        recipientName,
      },
      select: {
        payoutMethod: true,
        payoutProvider: true,
        amount: true,
        id: true,
        recipientName: true,
      },
    });

    await tx.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        availableBalance: {
          decrement: amount,
        },
        pendingBalance: {
          increment: amount,
        },
      },
    });

    await tx.affiliateActivity.create({
      data: {
        amount,
        description:
          `Permintaan penarikan ${createdPayout.payoutProvider} atas nama ${createdPayout.recipientName} sudah masuk dan menunggu pengecekan admin.`,
        profileId: profile.id,
        title: "Penarikan diajukan",
        type: "payout_requested",
      },
    });

    return createdPayout;
  });

  return payout;
}

export async function getAffiliatePayoutRequestsForAdmin() {
  return prisma.affiliatePayoutRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      accountNumber: true,
      amount: true,
      createdAt: true,
      id: true,
      note: true,
      payoutMethod: true,
      payoutProvider: true,
      processedAt: true,
      profile: {
        select: {
          availableBalance: true,
          pendingBalance: true,
          referralCode: true,
          user: {
            select: {
              id: true,
              name: true,
              telegramId: true,
              telegramUsername: true,
            },
          },
        },
      },
      recipientName: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function applyAffiliateCommissionForVipOrder(input: {
  amount: number;
  orderId: string;
  referredUserId: string;
}) {
  const settingsResult = await getAffiliateProgramSettingsSafe();
  const referral = await prisma.affiliateReferral.findUnique({
    where: { referredUserId: input.referredUserId },
    select: {
      activatedAt: true,
      id: true,
      profile: {
        select: {
          commissionRate: true,
          commissionRateOverride: true,
          id: true,
        },
      },
      status: true,
    },
  });

  if (!referral) {
    return null;
  }

  const commissionAmount = roundCommissionAmount(
    input.amount,
    referral.profile.commissionRateOverride ??
      settingsResult.settings.defaultCommissionRate,
  );

  if (commissionAmount <= 0) {
    return null;
  }

  const activityKey = `vip-order:${input.orderId}`;
  const existingActivity = await prisma.affiliateActivity.findFirst({
    where: {
      OR: [
        { description: activityKey },
        {
          description: {
            contains: input.orderId,
          },
        },
      ],
      profileId: referral.profile.id,
      type: "commission_earned",
    },
    select: { id: true },
  });

  if (existingActivity) {
    return null;
  }

  const activatedAt = referral.activatedAt ?? new Date();
  const shouldActivateReferral = referral.status !== "active";

  return prisma.$transaction(async (tx) => {
    const updatedProfile = await tx.affiliateProfile.update({
      where: { id: referral.profile.id },
      data: {
        activeReferrals: shouldActivateReferral
          ? {
              increment: 1,
            }
          : undefined,
        availableBalance: {
          increment: commissionAmount,
        },
        totalCommission: {
          increment: commissionAmount,
        },
      },
      select: {
        availableBalance: true,
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            telegramId: true,
            telegramUsername: true,
          },
        },
      },
    });

    await tx.affiliateReferral.update({
      where: { id: referral.id },
      data: {
        activatedAt,
        commissionEarned: {
          increment: commissionAmount,
        },
        status: "active",
      },
    });

    await tx.affiliateActivity.create({
      data: {
        amount: commissionAmount,
        description:
          `Komisi dari pembayaran VIP order ${input.orderId}. ` +
          "Saldo otomatis masuk setelah pembayaran referral berhasil.",
        profileId: referral.profile.id,
        title: shouldActivateReferral
          ? "Referral VIP pertama berhasil"
          : "Komisi VIP bertambah",
        type: "commission_earned",
      },
    });

    return {
      commissionAmount,
      profile: updatedProfile,
      referralActivated: shouldActivateReferral,
    };
  });
}
