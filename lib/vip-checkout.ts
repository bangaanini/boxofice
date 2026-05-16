import { prisma } from "@/lib/prisma";
import { applyAffiliateCommissionForVipOrder } from "@/lib/affiliate";
import {
  getActiveBotContext,
  getBotContextFields,
  getValidActiveBotContext,
} from "@/lib/bot-access";
import {
  getOrderPaymentMetadata,
  getPaymentGatewaySettingsSafe,
  getPaymentProviderLabel,
  getPaymenkuChannels,
} from "@/lib/payments";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import { getTelegramNotificationBotForContext } from "@/lib/telegram-partner-bots";
import { sendTelegramRuntimeMessage } from "@/lib/telegram-bot";

type PaymenkuCreateTransactionResponse = {
  data?: {
    amount?: string | number;
    pay_url?: string | null;
    payment_info?: {
      bank?: string | null;
      expiration_date?: string | null;
      qr_string?: string | null;
      qr_url?: string | null;
      transaction_id?: string | null;
      transaction_status?: string | null;
      va_number?: string | null;
    } | null;
    reference_id?: string | null;
    status?: string | null;
    trx_id?: string | null;
  };
  message?: string;
  status?: string;
};

type PaymenkuCheckStatusResponse = {
  data?: {
    amount?: string | number;
    amount_received?: string | null;
    created_at?: string | null;
    customer_email?: string | null;
    customer_name?: string | null;
    paid_at?: string | null;
    pay_url?: string | null;
    payment_channel?: {
      code?: string | null;
      name?: string | null;
      type?: string | null;
    } | null;
    reference_id?: string | null;
    status?: string | null;
    total_fee?: string | null;
    trx_id?: string | null;
    updated_at?: string | null;
  };
  message?: string;
  status?: string;
};

type PakasirCreateTransactionResponse = {
  payment?: {
    amount?: number | string;
    expired_at?: string | null;
    fee?: number | string;
    order_id?: string | null;
    payment_method?: string | null;
    payment_number?: string | null;
    project?: string | null;
    total_payment?: number | string;
  };
};

type PakasirTransactionDetailResponse = {
  transaction?: {
    amount?: number | string;
    completed_at?: string | null;
    order_id?: string | null;
    payment_method?: string | null;
    project?: string | null;
    status?: string | null;
  };
};

type OrderMetadataValue = string | number | boolean | null;
type OrderMetadataRecord = Record<string, OrderMetadataValue>;
type VipCheckoutSource = "web" | "bot_master" | "bot_partner";
type VipCommissionResult = {
  commissionAmount: number;
  profile: {
    availableBalance: number;
    user: {
      id: string;
      name: string;
      telegramId: string | null;
      telegramUsername: string | null;
    };
  };
  referralActivated: boolean;
} | null;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseAmount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const normalized = Number.parseFloat(value);

    if (Number.isFinite(normalized)) {
      return Math.round(normalized);
    }
  }

  return 0;
}

function normalizePaymentStatus(status: string | null | undefined) {
  const value = status?.trim().toLowerCase();

  if (!value) {
    return "pending";
  }

  if (["completed", "success", "settled"].includes(value)) {
    return "paid";
  }

  if (["paid", "pending", "expired", "failed", "cancelled"].includes(value)) {
    return value;
  }

  return value;
}

function normalizeChannelType(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "qris" ? "qris" : "va";
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Math.max(0, Math.round(amount)));
}

function formatTelegramHandle(username: string | null | undefined) {
  const normalized = username?.trim().replace(/^@/, "");
  return normalized ? `@${normalized}` : "-";
}

function getMasterOwnerTelegramId(settingsOwnerTelegramId: string | null) {
  return (
    settingsOwnerTelegramId?.trim() ||
    process.env.TELEGRAM_BOT_OWNER_TELEGRAM_ID?.trim() ||
    null
  );
}

function readOrderMetadataRecord(value: unknown): OrderMetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output: OrderMetadataRecord = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      output[key] = item;
    }
  }

  return output;
}

function normalizeCheckoutSource(input: {
  botKind?: string | null;
  partnerBotId?: string | null;
  value?: OrderMetadataValue;
}): VipCheckoutSource {
  const source =
    typeof input.value === "string" ? input.value.trim().toLowerCase() : "";

  if (source === "web") {
    return "web";
  }

  if (source === "bot_partner" || source === "bot-partner") {
    return "bot_partner";
  }

  if (
    source === "bot_master" ||
    source === "bot-master" ||
    source === "master" ||
    source === "default"
  ) {
    return "bot_master";
  }

  if (input.botKind === "partner" && input.partnerBotId) {
    return "bot_partner";
  }

  if (input.botKind === "web") {
    return "web";
  }

  return "bot_master";
}

function getCheckoutSourceLabel(source: VipCheckoutSource) {
  if (source === "web") {
    return "Web";
  }

  if (source === "bot_partner") {
    return "Bot partner";
  }

  return "Bot master";
}

function getMasterNotificationTitle(source: VipCheckoutSource) {
  if (source === "web") {
    return "🧾 Transaksi VIP web baru";
  }

  if (source === "bot_partner") {
    return "🧾 Transaksi VIP partner baru";
  }

  return "🧾 Transaksi VIP bot master baru";
}

async function resolveVipCheckoutContext() {
  const activeBotContext = await getActiveBotContext().catch(() => null);

  if (!activeBotContext) {
    return {
      botKind: "web",
      checkoutSource: "web" as const,
      checkoutSourceLabel: getCheckoutSourceLabel("web"),
      partnerBotId: null,
    };
  }

  const validBotContext = await getValidActiveBotContext().catch(
    () => ({ kind: "default" }) as const,
  );
  const botContextFields = getBotContextFields(validBotContext);
  const checkoutSource =
    validBotContext.kind === "partner" ? "bot_partner" : "bot_master";

  return {
    ...botContextFields,
    checkoutSource,
    checkoutSourceLabel: getCheckoutSourceLabel(checkoutSource),
  };
}

function mergeOrderMetadata(
  currentMetadata: unknown,
  nextMetadata: OrderMetadataRecord,
) {
  return {
    ...readOrderMetadataRecord(currentMetadata),
    ...nextMetadata,
  };
}

async function notifyAffiliateOwnerForVipJoin(input: {
  botKind?: string | null;
  buyerName: string;
  buyerUsername?: string | null;
  commissionAmount: number;
  ownerTelegramId?: string | null;
  partnerBotId?: string | null;
  packageTitle: string;
  totalActiveCommission: number;
  transactionAmount: number;
}) {
  if (!input.ownerTelegramId) {
    return false;
  }

  const deliveryBot = await getTelegramNotificationBotForContext({
    botKind: input.botKind,
    partnerBotId: input.partnerBotId,
  }).catch(() => null);

  const text =
    "💸 Komisi affiliate baru\n\n" +
    `Pembeli: ${input.buyerName} (${formatTelegramHandle(input.buyerUsername)})\n` +
    `Paket VIP: ${input.packageTitle}\n` +
    `Nilai transaksi: ${formatCurrency(input.transactionAmount)}\n` +
    `Komisi: ${formatCurrency(input.commissionAmount)}\n` +
    `Total komisimu saat ini: ${formatCurrency(input.totalActiveCommission)}`;

  return sendTelegramRuntimeMessage({
    botToken: deliveryBot?.botToken,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "Buka halaman affiliate",
            web_app: {
              url: deliveryBot?.affiliateUrl ?? "https://example.com/affiliate",
            },
          },
        ],
      ],
    },
    telegramId: input.ownerTelegramId,
    text,
  }).catch(() => false);
}

async function notifyMasterOwnerForVipOrder(input: {
  botKind?: string | null;
  buyerName: string;
  buyerUsername?: string | null;
  checkoutSource?: string | null;
  commissionResult: VipCommissionResult;
  durationDays: number;
  expiresAt: Date;
  metadata: unknown;
  orderId: string;
  packageTitle: string;
  paidAt: Date;
  paymentChannel?: string | null;
  paymentProvider?: string | null;
  partnerBotId?: string | null;
  totalPaymentAmount: number;
  transactionAmount: number;
}) {
  const metadata = readOrderMetadataRecord(input.metadata);

  if (typeof metadata.masterNotificationSentAt === "string") {
    return false;
  }

  const partnerBotPromise = input.partnerBotId
    ? prisma.partnerBot.findUnique({
        where: { id: input.partnerBotId },
        select: {
          botName: true,
          botUsername: true,
          label: true,
        },
      }).catch(() => null)
    : Promise.resolve(null);
  const [telegram, partnerBot] = await Promise.all([
    getTelegramBotSettingsSafe(),
    partnerBotPromise,
  ]);
  const ownerTelegramId = getMasterOwnerTelegramId(
    telegram.settings.ownerTelegramId,
  );
  const masterBotToken = telegram.runtime.botToken?.trim();

  if (!ownerTelegramId || !masterBotToken) {
    return false;
  }

  const checkoutSource = normalizeCheckoutSource({
    botKind: input.botKind,
    partnerBotId: input.partnerBotId,
    value: input.checkoutSource ?? metadata.checkoutSource,
  });
  const isPartnerTransaction = checkoutSource === "bot_partner";
  const partnerBotLabel = partnerBot
    ? `${partnerBot.label?.trim() || partnerBot.botName} (@${partnerBot.botUsername})`
    : input.partnerBotId;
  const masterBotUsername = telegram.runtime.botUsername
    ?.trim()
    .replace(/^@/, "");
  const masterBotLabel = masterBotUsername
    ? `@${masterBotUsername}`
    : telegram.settings.brandName || "Bot utama";
  const sourceLine =
    checkoutSource === "bot_partner"
      ? `Sumber: Bot partner - ${partnerBotLabel ?? input.partnerBotId ?? "-"}`
      : checkoutSource === "bot_master"
        ? `Sumber: Bot master (${masterBotLabel})`
        : "Sumber: Web";
  const commissionLine = input.commissionResult
    ? `${formatCurrency(input.commissionResult.commissionAmount)} untuk ${input.commissionResult.profile.user.name} (${formatTelegramHandle(input.commissionResult.profile.user.telegramUsername)})`
    : "Tidak ada komisi baru";
  const channelLine = input.paymentChannel?.trim() || "-";
  const totalPaymentLine =
    input.totalPaymentAmount > 0 &&
    input.totalPaymentAmount !== input.transactionAmount
      ? `Total dibayar: ${formatCurrency(input.totalPaymentAmount)}\n`
      : "";
  const text =
    `${getMasterNotificationTitle(checkoutSource)}\n\n` +
    `${sourceLine}\n` +
    `Pembeli: ${input.buyerName} (${formatTelegramHandle(input.buyerUsername)})\n` +
    `Paket VIP: ${input.packageTitle}\n` +
    `Durasi: ${input.durationDays} hari\n` +
    `Gateway: ${getPaymentProviderLabel(input.paymentProvider)}\n` +
    `Metode: ${channelLine}\n` +
    `Nilai transaksi: ${formatCurrency(input.transactionAmount)}\n` +
    totalPaymentLine +
    `${isPartnerTransaction ? "Komisi partner" : "Komisi affiliate"}: ${commissionLine}\n` +
    `Order: ${input.orderId}\n` +
    `VIP sampai: ${input.expiresAt.toLocaleString("id-ID", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "long",
      year: "numeric",
    })}\n` +
    `Waktu: ${input.paidAt.toLocaleString("id-ID", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "long",
      year: "numeric",
    })}`;
  const sent = await sendTelegramRuntimeMessage({
    botToken: masterBotToken,
    telegramId: ownerTelegramId,
    text,
  }).catch(() => false);

  if (!sent) {
    return false;
  }

  await prisma.vipPaymentOrder.update({
    where: { id: input.orderId },
    data: {
      metadata: mergeOrderMetadata(input.metadata, {
        masterNotificationSentAt: new Date().toISOString(),
      }),
    },
  }).catch(() => null);

  return true;
}

function isLikelyVipOrderExpiry(input: {
  durationDays: number;
  expiresAt: Date | null;
  paidAt: Date | null;
}) {
  if (!input.expiresAt || !input.paidAt) {
    return false;
  }

  const minimumVipExpiry = addDays(
    input.paidAt,
    Math.max(input.durationDays - 1, 1),
  );

  return input.expiresAt.getTime() >= minimumVipExpiry.getTime();
}

function ensurePaymentSchemaReady(schemaReady: boolean, schemaIssue: string | null) {
  if (!schemaReady) {
    throw new Error(
      schemaIssue ??
        "Modul payment di database belum siap. Jalankan migration payment lebih dulu.",
    );
  }
}

async function fetchPaymenkuJson<T>(input: {
  apiKey: string;
  body?: unknown;
  method?: "GET" | "POST";
  path: string;
}) {
  const response = await fetch(`https://paymenku.com/api/v1${input.path}`, {
    body: input.body ? JSON.stringify(input.body) : undefined,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    method: input.method ?? "GET",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || !payload) {
    throw new Error(`Paymenku request gagal (${response.status}).`);
  }

  return payload;
}

async function fetchPakasirJson<T>(input: {
  body?: unknown;
  method?: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | undefined>;
}) {
  const url = new URL(`https://app.pakasir.com/api${input.path}`);

  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value === undefined || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: input.method ?? "GET",
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || !payload) {
    throw new Error(`Pakasir request gagal (${response.status}).`);
  }

  return payload;
}

function buildPakasirCheckoutUrl(input: {
  amount: number;
  orderId: string;
  projectSlug: string;
  qrisOnly: boolean;
  redirectUrl: string;
}) {
  const url = new URL(
    `/pay/${encodeURIComponent(input.projectSlug)}/${input.amount}`,
    "https://app.pakasir.com",
  );

  url.searchParams.set("order_id", input.orderId);
  url.searchParams.set("redirect", input.redirectUrl);

  if (input.qrisOnly) {
    url.searchParams.set("qris_only", "1");
  }

  return url.toString();
}

async function activateVipFromOrder(orderId: string, paidAt: Date | null) {
  const order = await prisma.vipPaymentOrder.findUnique({
    where: { id: orderId },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          name: true,
          telegramId: true,
          telegramUsername: true,
          vipExpiresAt: true,
          vipStartedAt: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  const now = paidAt ?? new Date();
  const existingOrderExpiresAt =
    order.status === "paid" &&
    isLikelyVipOrderExpiry({
      durationDays: order.plan.durationDays,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt ?? paidAt,
    })
      ? order.expiresAt
      : null;
  const baseDate =
    !existingOrderExpiresAt &&
    order.user.vipExpiresAt &&
    order.user.vipExpiresAt.getTime() > now.getTime()
      ? order.user.vipExpiresAt
      : now;
  const nextExpiresAt =
    existingOrderExpiresAt ?? addDays(baseDate, order.plan.durationDays);
  const resolvedUserExpiresAt =
    order.user.vipExpiresAt &&
    order.user.vipExpiresAt.getTime() > nextExpiresAt.getTime()
      ? order.user.vipExpiresAt
      : nextExpiresAt;
  const userAlreadyHasThisVip =
    order.user.vipExpiresAt &&
    order.user.vipExpiresAt.getTime() >= nextExpiresAt.getTime();
  const metadata = getOrderPaymentMetadata(order);
  const commissionBaseAmount =
    parseAmount(metadata?.amountReceived) || order.plan.priceAmount;
  const checkoutSource = normalizeCheckoutSource({
    botKind: order.botKind,
    partnerBotId: order.partnerBotId,
    value: metadata?.checkoutSource,
  });
  const paymentChannel =
    metadata?.channelName ||
    metadata?.paymentMethod ||
    metadata?.channelCode ||
    null;
  const totalPaymentAmount =
    parseAmount(metadata?.totalPayment) || order.amount || commissionBaseAmount;
  const sendAffiliateOwnerNotification = async (
    commissionResult: VipCommissionResult,
  ) => {
    if (!commissionResult?.profile.user.telegramId) {
      return;
    }

    await notifyAffiliateOwnerForVipJoin({
      botKind: order.botKind,
      buyerName: order.user.name,
      buyerUsername: order.user.telegramUsername,
      commissionAmount: commissionResult.commissionAmount,
      ownerTelegramId: commissionResult.profile.user.telegramId,
      partnerBotId: order.partnerBotId,
      packageTitle: order.plan.title,
      totalActiveCommission: commissionResult.profile.availableBalance,
      transactionAmount: commissionBaseAmount,
    }).catch(() => null);
  };

  if (order.status === "paid" && userAlreadyHasThisVip) {
    const commissionResult = await applyAffiliateCommissionForVipOrder({
      amount: commissionBaseAmount,
      orderId: order.id,
      referredUserId: order.user.id,
    }).catch(() => null);
    await sendAffiliateOwnerNotification(commissionResult);
    await notifyMasterOwnerForVipOrder({
      botKind: order.botKind,
      buyerName: order.user.name,
      buyerUsername: order.user.telegramUsername,
      checkoutSource,
      commissionResult,
      durationDays: order.plan.durationDays,
      expiresAt: nextExpiresAt,
      metadata: order.metadata,
      orderId: order.id,
      packageTitle: order.plan.title,
      paidAt: now,
      paymentChannel,
      paymentProvider: order.provider,
      partnerBotId: order.partnerBotId,
      totalPaymentAmount,
      transactionAmount: commissionBaseAmount,
    }).catch(() => null);

    return order;
  }

  const shouldUpdateOrderVipExpiry =
    order.status !== "paid" ||
    !order.expiresAt ||
    !existingOrderExpiresAt ||
    order.expiresAt.getTime() !== nextExpiresAt.getTime();

  await prisma.$transaction(async (tx) => {
    if (shouldUpdateOrderVipExpiry) {
      await tx.vipPaymentOrder.update({
        where: { id: order.id },
        data: {
          expiresAt: nextExpiresAt,
          paidAt: now,
          status: "paid",
        },
      });
    }

    await tx.user.update({
      where: { id: order.user.id },
      data: {
        vipExpiresAt: resolvedUserExpiresAt,
        vipStartedAt:
          order.user.vipExpiresAt && order.user.vipExpiresAt.getTime() > now.getTime()
            ? order.user.vipStartedAt ?? now
            : now,
      },
    });
  });

  const commissionResult = await applyAffiliateCommissionForVipOrder({
    amount: commissionBaseAmount,
    orderId: order.id,
    referredUserId: order.user.id,
  }).catch(() => null);
  await sendAffiliateOwnerNotification(commissionResult);
  await notifyMasterOwnerForVipOrder({
    botKind: order.botKind,
    buyerName: order.user.name,
    buyerUsername: order.user.telegramUsername,
    checkoutSource,
    commissionResult,
    durationDays: order.plan.durationDays,
    expiresAt: nextExpiresAt,
    metadata: order.metadata,
    orderId: order.id,
    packageTitle: order.plan.title,
    paidAt: now,
    paymentChannel,
    paymentProvider: order.provider,
    partnerBotId: order.partnerBotId,
    totalPaymentAmount,
    transactionAmount: commissionBaseAmount,
  }).catch(() => null);

  const buyerNotificationBot = await getTelegramNotificationBotForContext({
    botKind: order.botKind,
    partnerBotId: order.partnerBotId,
  }).catch(() => null);

  await sendTelegramRuntimeMessage({
    botToken: buyerNotificationBot?.botToken,
    telegramId: order.user.telegramId,
    text:
      `🎉 VIP Box Office aktif untuk ${order.user.name}.\n\n` +
      `Paket: ${order.plan.title}\n` +
      `Masa aktif baru: ${nextExpiresAt.toLocaleString("id-ID", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "long",
        year: "numeric",
      })}\n\n` +
      `Sekarang kamu bisa lanjut nonton tanpa batas preview.`,
  }).catch(() => null);

  return order;
}

export async function repairPaidVipOrdersForUser(userId: string) {
  const orders = await prisma.vipPaymentOrder.findMany({
    where: {
      status: "paid",
      userId,
    },
    orderBy: {
      paidAt: "asc",
    },
    select: {
      id: true,
      paidAt: true,
    },
  });

  for (const order of orders) {
    await activateVipFromOrder(order.id, order.paidAt).catch(() => null);
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      id: true,
      name: true,
      telegramFirstName: true,
      telegramId: true,
      telegramLastName: true,
      telegramPhotoUrl: true,
      telegramUsername: true,
      vipExpiresAt: true,
      vipStartedAt: true,
    },
  });
}

export async function createVipPaymentForUser(input: {
  channelCode: string;
  userId: string;
  userPhone?: string | null;
  planId: string;
}) {
  const settingsResult = await getPaymentGatewaySettingsSafe();
  const runtime = settingsResult.runtime;

  ensurePaymentSchemaReady(settingsResult.schemaReady, settingsResult.schemaIssue);

  if (!runtime.enabled) {
    throw new Error("Payment gateway belum diaktifkan di dashboard admin.");
  }

  if (runtime.provider !== "paymenku" && runtime.provider !== "pakasir") {
    throw new Error("Provider pembayaran saat ini belum didukung.");
  }

  if (!runtime.apiKey) {
    throw new Error("API key payment gateway belum terpasang.");
  }

  if (runtime.provider === "pakasir" && !runtime.projectSlug) {
    throw new Error("Project slug Pakasir belum terpasang.");
  }

  const [user, plan, channels] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        email: true,
        id: true,
        name: true,
        telegramUsername: true,
      },
    }),
    prisma.vipPlan.findFirst({
      where: {
        active: true,
        id: input.planId,
      },
    }),
    getPaymenkuChannels(),
  ]);

  if (!user) {
    throw new Error("User tidak ditemukan untuk checkout VIP.");
  }

  if (!plan) {
    throw new Error("Paket VIP sudah tidak aktif atau belum tersedia.");
  }

  const availableChannels = [...channels.groups.qris, ...channels.groups.va];
  const selectedChannel = availableChannels.find(
    (channel) => channel.code === input.channelCode,
  );

  if (!selectedChannel) {
    throw new Error("Metode pembayaran yang dipilih belum tersedia.");
  }

  const checkoutContext = await resolveVipCheckoutContext();
  const botContextFields = {
    botKind: checkoutContext.botKind,
    partnerBotId: checkoutContext.partnerBotId,
  };
  const order = await prisma.vipPaymentOrder.create({
    data: {
      amount: plan.priceAmount,
      ...botContextFields,
      currency: plan.currency,
      metadata: {
        botKind: botContextFields.botKind,
        channelCode: selectedChannel.code,
        channelName: selectedChannel.name,
        channelType: selectedChannel.type,
        checkoutSource: checkoutContext.checkoutSource,
        checkoutSourceLabel: checkoutContext.checkoutSourceLabel,
        customerEmail: user.email,
        customerName: user.name,
        customerPhone: input.userPhone ?? null,
        partnerBotId: botContextFields.partnerBotId,
        referenceId: null,
      },
      planId: plan.id,
      provider: runtime.provider,
      status: "pending",
      userId: user.id,
    },
  });

  const returnUrl = `${runtime.publicAppUrl}/vip/pay/${order.id}`;

  if (runtime.provider === "pakasir") {
    const payload = await fetchPakasirJson<PakasirCreateTransactionResponse>({
      body: {
        amount: plan.priceAmount,
        api_key: runtime.apiKey,
        order_id: order.id,
        project: runtime.projectSlug,
      },
      method: "POST",
      path: `/transactioncreate/${encodeURIComponent(selectedChannel.code)}`,
    });
    const payment = payload.payment;

    if (!payment?.order_id || !payment.payment_number) {
      throw new Error("Pakasir belum bisa membuat transaksi.");
    }

    const expirationDate = payment.expired_at
      ? new Date(payment.expired_at)
      : null;
    const baseAmount = parseAmount(payment.amount) || plan.priceAmount;
    const totalPayment = parseAmount(payment.total_payment) || baseAmount;
    const channelType = selectedChannel.type;
    const checkoutUrl = buildPakasirCheckoutUrl({
      amount: baseAmount,
      orderId: order.id,
      projectSlug: runtime.projectSlug,
      qrisOnly: channelType === "qris",
      redirectUrl: returnUrl,
    });

    await prisma.vipPaymentOrder.update({
      where: { id: order.id },
      data: {
        amount: totalPayment,
        checkoutUrl,
        expiresAt: expirationDate,
        externalCheckoutId: payment.order_id,
        externalPaymentId: payment.order_id,
        metadata: {
          amountFee: String(parseAmount(payment.fee) || 0),
          amountReceived: String(baseAmount),
          bank: channelType === "va" ? selectedChannel.name : null,
          botKind: botContextFields.botKind,
          channelCode: selectedChannel.code,
          channelName: selectedChannel.name,
          channelType,
          checkoutSource: checkoutContext.checkoutSource,
          checkoutSourceLabel: checkoutContext.checkoutSourceLabel,
          customerEmail: user.email,
          customerName: user.name,
          customerPhone: input.userPhone ?? null,
          expirationDate: payment.expired_at ?? null,
          pakasirAmount: baseAmount,
          pakasirProject: payment.project ?? runtime.projectSlug,
          partnerBotId: botContextFields.partnerBotId,
          payUrl: checkoutUrl,
          paymentMethod: payment.payment_method ?? selectedChannel.code,
          qrString: channelType === "qris" ? payment.payment_number : null,
          qrUrl: null,
          referenceId: payment.order_id ?? order.id,
          totalPayment,
          transactionId: payment.order_id ?? order.id,
          vaNumber: channelType === "va" ? payment.payment_number : null,
        },
        status: "pending",
      },
    });

    return order.id;
  }

  const payload = await fetchPaymenkuJson<PaymenkuCreateTransactionResponse>({
    apiKey: runtime.apiKey,
    body: {
      amount: plan.priceAmount,
      channel_code: selectedChannel.code,
      customer_email: user.email ?? `${user.id}@boxofice.local`,
      customer_name: user.name,
      ...(input.userPhone ? { customer_phone: input.userPhone } : {}),
      reference_id: order.id,
      return_url: returnUrl,
    },
    method: "POST",
    path: "/transaction/create",
  });

  if (payload.status !== "success" || !payload.data?.trx_id) {
    throw new Error(payload.message ?? "Paymenku belum bisa membuat transaksi.");
  }

  const expirationDate = payload.data.payment_info?.expiration_date
    ? new Date(payload.data.payment_info.expiration_date)
    : null;

  await prisma.vipPaymentOrder.update({
    where: { id: order.id },
    data: {
      amount: parseAmount(payload.data.amount) || plan.priceAmount,
      checkoutUrl: payload.data.pay_url ?? null,
      expiresAt: expirationDate,
      externalCheckoutId: payload.data.trx_id,
      externalPaymentId: payload.data.payment_info?.transaction_id ?? null,
      metadata: {
        bank: payload.data.payment_info?.bank ?? null,
        botKind: botContextFields.botKind,
        channelCode: selectedChannel.code,
        channelName: selectedChannel.name,
        channelType: selectedChannel.type,
        checkoutSource: checkoutContext.checkoutSource,
        checkoutSourceLabel: checkoutContext.checkoutSourceLabel,
        customerEmail: user.email,
        customerName: user.name,
        customerPhone: input.userPhone ?? null,
        expirationDate: payload.data.payment_info?.expiration_date ?? null,
        partnerBotId: botContextFields.partnerBotId,
        payUrl: payload.data.pay_url ?? null,
        qrString: payload.data.payment_info?.qr_string ?? null,
        qrUrl: payload.data.payment_info?.qr_url ?? null,
        referenceId: payload.data.reference_id ?? order.id,
        transactionId: payload.data.payment_info?.transaction_id ?? null,
        vaNumber: payload.data.payment_info?.va_number ?? null,
      },
      status: normalizePaymentStatus(payload.data.status),
    },
  });

  return order.id;
}

export async function syncVipOrderFromPaymenkuStatus(input: {
  orderId: string;
  userId?: string;
}) {
  const settingsResult = await getPaymentGatewaySettingsSafe();
  const runtime = settingsResult.runtime;

  ensurePaymentSchemaReady(settingsResult.schemaReady, settingsResult.schemaIssue);

  if (!runtime.apiKey) {
    throw new Error("API key payment gateway belum terpasang.");
  }

  const order = await prisma.vipPaymentOrder.findFirst({
    where: {
      id: input.orderId,
      ...(input.userId ? { userId: input.userId } : {}),
    },
    select: {
      amount: true,
      externalCheckoutId: true,
      id: true,
      metadata: true,
      provider: true,
      status: true,
    },
  });

  if (!order) {
    throw new Error("Order VIP tidak ditemukan.");
  }

  const orderMeta = getOrderPaymentMetadata(order);

  if (order.provider === "pakasir") {
    if (runtime.provider !== "pakasir" || !runtime.projectSlug) {
      throw new Error("Project slug Pakasir belum terpasang.");
    }

    const pakasirAmount =
      parseAmount(orderMeta?.pakasirAmount) ||
      parseAmount(orderMeta?.amountReceived) ||
      order.amount;
    const payload = await fetchPakasirJson<PakasirTransactionDetailResponse>({
      path: "/transactiondetail",
      query: {
        amount: pakasirAmount,
        api_key: runtime.apiKey,
        order_id: orderMeta?.referenceId ?? order.id,
        project: runtime.projectSlug,
      },
    });
    const transaction = payload.transaction;

    if (!transaction) {
      throw new Error("Status transaksi Pakasir belum bisa dicek.");
    }

    const nextStatus = normalizePaymentStatus(transaction.status);
    const paidAt = transaction.completed_at
      ? new Date(transaction.completed_at)
      : null;
    const paymentMethod =
      transaction.payment_method ?? orderMeta?.paymentMethod ?? null;
    const channelType = normalizeChannelType(paymentMethod);

    await prisma.vipPaymentOrder.update({
      where: { id: order.id },
      data: {
        metadata: {
          ...readOrderMetadataRecord(order.metadata),
          amountReceived: String(parseAmount(transaction.amount) || pakasirAmount),
          channelCode: paymentMethod ?? orderMeta?.channelCode ?? null,
          channelName: paymentMethod ?? orderMeta?.channelName ?? null,
          channelType,
          pakasirAmount,
          pakasirProject: transaction.project ?? runtime.projectSlug,
          paymentMethod,
          referenceId: transaction.order_id ?? orderMeta?.referenceId ?? order.id,
        },
        paidAt,
        status: nextStatus,
      },
    });

    if (nextStatus === "paid") {
      await activateVipFromOrder(order.id, paidAt);
    }

    return {
      orderId: order.id,
      status: nextStatus,
    };
  }

  const statusId =
    order.externalCheckoutId || orderMeta?.referenceId || order.id;

  const payload = await fetchPaymenkuJson<PaymenkuCheckStatusResponse>({
    apiKey: runtime.apiKey,
    path: `/check-status/${encodeURIComponent(statusId)}`,
  });

  if (payload.status !== "success" || !payload.data) {
    throw new Error(payload.message ?? "Status transaksi belum bisa dicek.");
  }

  const nextStatus = normalizePaymentStatus(payload.data.status);
  const paymentChannelType = normalizeChannelType(payload.data.payment_channel?.type);
  const paidAt = payload.data.paid_at ? new Date(payload.data.paid_at) : null;

  await prisma.vipPaymentOrder.update({
    where: { id: order.id },
    data: {
      amount: parseAmount(payload.data.amount),
      checkoutUrl: payload.data.pay_url ?? undefined,
      externalCheckoutId: payload.data.trx_id ?? undefined,
      metadata: {
        ...readOrderMetadataRecord(order.metadata),
        amountFee: payload.data.total_fee ?? null,
        amountReceived: payload.data.amount_received ?? null,
        channelCode: payload.data.payment_channel?.code ?? orderMeta?.channelCode ?? null,
        channelName: payload.data.payment_channel?.name ?? orderMeta?.channelName ?? null,
        channelType: paymentChannelType,
        customerEmail: payload.data.customer_email ?? orderMeta?.customerEmail ?? null,
        customerName: payload.data.customer_name ?? orderMeta?.customerName ?? null,
        expirationDate: orderMeta?.expirationDate ?? null,
        payUrl: payload.data.pay_url ?? orderMeta?.payUrl ?? null,
        qrString: orderMeta?.qrString ?? null,
        qrUrl: orderMeta?.qrUrl ?? null,
        referenceId: payload.data.reference_id ?? orderMeta?.referenceId ?? order.id,
        transactionId: orderMeta?.transactionId ?? null,
        vaNumber: orderMeta?.vaNumber ?? null,
      },
      paidAt,
      status: nextStatus,
    },
  });

  if (nextStatus === "paid") {
    await activateVipFromOrder(order.id, paidAt);
  }

  return {
    orderId: order.id,
    status: nextStatus,
  };
}

export async function handlePaymenkuWebhook(input: {
  amount?: string | null;
  amountFee?: string | null;
  amountReceived?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  paidAt?: string | null;
  paymentChannel?: string | null;
  referenceId?: string | null;
  status?: string | null;
  trxId?: string | null;
}) {
  const filters = [];

  if (input.referenceId) {
    filters.push({ id: input.referenceId });
  }

  if (input.trxId) {
    filters.push({ externalCheckoutId: input.trxId });
  }

  if (!filters.length) {
    return null;
  }

  const order = await prisma.vipPaymentOrder.findFirst({
    where: {
      OR: filters,
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!order) {
    return null;
  }

  const meta = getOrderPaymentMetadata(order);
  const nextStatus = normalizePaymentStatus(input.status);
  const paidAt = input.paidAt ? new Date(input.paidAt) : null;

  await prisma.vipPaymentOrder.update({
    where: { id: order.id },
    data: {
      externalCheckoutId: input.trxId ?? undefined,
      metadata: {
        ...readOrderMetadataRecord(order.metadata),
        amountFee: input.amountFee ?? meta?.amountFee ?? null,
        amountReceived: input.amountReceived ?? meta?.amountReceived ?? null,
        channelCode: meta?.channelCode ?? null,
        channelName: meta?.channelName ?? input.paymentChannel ?? null,
        channelType: meta?.channelType ?? null,
        customerEmail: input.customerEmail ?? meta?.customerEmail ?? null,
        customerName: input.customerName ?? meta?.customerName ?? null,
        expirationDate: meta?.expirationDate ?? null,
        payUrl: meta?.payUrl ?? null,
        qrString: meta?.qrString ?? null,
        qrUrl: meta?.qrUrl ?? null,
        referenceId: input.referenceId ?? meta?.referenceId ?? order.id,
        transactionId: meta?.transactionId ?? null,
        vaNumber: meta?.vaNumber ?? null,
      },
      paidAt,
      status: nextStatus,
    },
  });

  if (nextStatus === "paid") {
    await activateVipFromOrder(order.id, paidAt);
  }

  return {
    orderId: order.id,
    status: nextStatus,
  };
}

export async function handlePakasirWebhook(input: {
  amount?: number | string | null;
  completedAt?: string | null;
  orderId?: string | null;
  paymentMethod?: string | null;
  project?: string | null;
  status?: string | null;
}) {
  const orderId = input.orderId?.trim();

  if (!orderId) {
    return null;
  }

  const settingsResult = await getPaymentGatewaySettingsSafe();
  const runtime = settingsResult.runtime;

  ensurePaymentSchemaReady(settingsResult.schemaReady, settingsResult.schemaIssue);

  if (runtime.provider !== "pakasir" || !runtime.apiKey || !runtime.projectSlug) {
    throw new Error("Konfigurasi Pakasir belum lengkap.");
  }

  if (input.project && input.project !== runtime.projectSlug) {
    throw new Error("Project Pakasir tidak cocok.");
  }

  const order = await prisma.vipPaymentOrder.findFirst({
    where: {
      id: orderId,
      provider: "pakasir",
    },
    select: {
      amount: true,
      id: true,
      metadata: true,
    },
  });

  if (!order) {
    return null;
  }

  const meta = getOrderPaymentMetadata(order);
  const pakasirAmount =
    parseAmount(input.amount) ||
    parseAmount(meta?.pakasirAmount) ||
    parseAmount(meta?.amountReceived) ||
    order.amount;
  const verification = await fetchPakasirJson<PakasirTransactionDetailResponse>({
    path: "/transactiondetail",
    query: {
      amount: pakasirAmount,
      api_key: runtime.apiKey,
      order_id: order.id,
      project: runtime.projectSlug,
    },
  });
  const transaction = verification.transaction;

  if (!transaction) {
    throw new Error("Status transaksi Pakasir belum bisa diverifikasi.");
  }

  const nextStatus = normalizePaymentStatus(transaction.status ?? input.status);
  const completedAt = transaction.completed_at ?? input.completedAt ?? null;
  const paidAt = completedAt ? new Date(completedAt) : null;
  const paymentMethod =
    transaction.payment_method ?? input.paymentMethod ?? meta?.paymentMethod ?? null;
  const channelType = normalizeChannelType(paymentMethod);

  await prisma.vipPaymentOrder.update({
    where: { id: order.id },
    data: {
      metadata: {
        ...readOrderMetadataRecord(order.metadata),
        amountReceived: String(parseAmount(transaction.amount) || pakasirAmount),
        channelCode: paymentMethod ?? meta?.channelCode ?? null,
        channelName: paymentMethod ?? meta?.channelName ?? null,
        channelType,
        pakasirAmount,
        pakasirProject: transaction.project ?? runtime.projectSlug,
        paymentMethod,
        referenceId: transaction.order_id ?? order.id,
      },
      paidAt,
      status: nextStatus,
    },
  });

  if (nextStatus === "paid") {
    await activateVipFromOrder(order.id, paidAt);
  }

  return {
    orderId: order.id,
    status: nextStatus,
  };
}
