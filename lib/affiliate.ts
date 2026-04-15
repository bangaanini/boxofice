import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import { buildAffiliateStartParam, buildTelegramBotChatUrlForUsername } from "@/lib/telegram-miniapp";

export const AFFILIATE_MINIMUM_WITHDRAW = 50_000;
export const DEFAULT_AFFILIATE_COMMISSION_RATE = 25;

type AffiliateProgramSettingsSnapshot = {
  createdAt: Date;
  defaultCommissionRate: number;
  id: string;
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
    message.includes("AffiliateProfile")
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

export async function getAffiliateSharePath(referralCode: string) {
  try {
    const telegram = await getTelegramBotSettingsSafe();

    return buildTelegramBotChatUrlForUsername(
      telegram.runtime.botUsername,
      buildAffiliateStartParam(referralCode),
    );
  } catch {
    return `/r/${encodeURIComponent(referralCode)}`;
  }
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
        id: "affiliate-settings-fallback",
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
  const existing = await prisma.affiliateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const settingsResult = await getAffiliateProgramSettingsSafe();
  const referralCode = await generateUniqueReferralCode(user.name);

  return prisma.affiliateProfile.create({
    data: {
      commissionRate: settingsResult.settings.defaultCommissionRate,
      minimumWithdraw: AFFILIATE_MINIMUM_WITHDRAW,
      referralCode,
      userId: user.id,
    },
    select: { id: true },
  });
}

export async function getAffiliateDashboard(user: AffiliateUser) {
  const profile = await ensureAffiliateProfile(user);

  return prisma.affiliateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      payoutRequests: {
        orderBy: { createdAt: "desc" },
        take: 5,
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

export async function attachAffiliateReferral(input: {
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

  const existingReferral = await prisma.affiliateReferral.findUnique({
    where: { referredUserId: input.referredUserId },
    select: { id: true },
  });

  if (existingReferral) {
    return existingReferral;
  }

  const referral = await prisma.$transaction(async (tx) => {
    const createdReferral = await tx.affiliateReferral.create({
      data: {
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
  amount: number;
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

  if (amount < profile.minimumWithdraw) {
    throw new Error("Saldo belum memenuhi minimum penarikan.");
  }

  if (amount > profile.availableBalance) {
    throw new Error("Saldo yang bisa ditarik tidak mencukupi.");
  }

  const payout = await prisma.$transaction(async (tx) => {
    const createdPayout = await tx.affiliatePayoutRequest.create({
      data: {
        amount,
        profileId: profile.id,
      },
      select: {
        amount: true,
        id: true,
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
          "Permintaan penarikan baru sudah masuk dan menunggu pengecekan admin.",
        profileId: profile.id,
        title: "Penarikan diajukan",
        type: "payout_requested",
      },
    });

    return createdPayout;
  });

  return payout;
}

export async function applyAffiliateCommissionForVipOrder(input: {
  amount: number;
  orderId: string;
  referredUserId: string;
}) {
  const referral = await prisma.affiliateReferral.findUnique({
    where: { referredUserId: input.referredUserId },
    select: {
      activatedAt: true,
      id: true,
      profile: {
        select: {
          commissionRate: true,
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
    referral.profile.commissionRate,
  );

  if (commissionAmount <= 0) {
    return null;
  }

  const activityKey = `vip-order:${input.orderId}`;
  const existingActivity = await prisma.affiliateActivity.findFirst({
    where: {
      description: activityKey,
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
    await tx.affiliateProfile.update({
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
        description: activityKey,
        profileId: referral.profile.id,
        title: shouldActivateReferral
          ? "Referral VIP pertama berhasil"
          : "Komisi VIP bertambah",
        type: "commission_earned",
      },
    });

    return {
      commissionAmount,
      referralActivated: shouldActivateReferral,
    };
  });
}
