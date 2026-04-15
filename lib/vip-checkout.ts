import { prisma } from "@/lib/prisma";
import { applyAffiliateCommissionForVipOrder } from "@/lib/affiliate";
import {
  getOrderPaymentMetadata,
  getPaymentGatewaySettingsSafe,
  getPaymenkuChannels,
} from "@/lib/payments";
import { sendTelegramUserMessage } from "@/lib/telegram-bot";

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

  if (["paid", "pending", "expired", "failed", "cancelled"].includes(value)) {
    return value;
  }

  return value;
}

function normalizeChannelType(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "qris" ? "qris" : "va";
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
          vipExpiresAt: true,
          vipStartedAt: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  if (order.status === "paid") {
    return order;
  }

  const now = paidAt ?? new Date();
  const baseDate =
    order.user.vipExpiresAt && order.user.vipExpiresAt.getTime() > now.getTime()
      ? order.user.vipExpiresAt
      : now;
  const nextExpiresAt = addDays(baseDate, order.plan.durationDays);
  const metadata = getOrderPaymentMetadata(order);
  const commissionBaseAmount =
    parseAmount(metadata?.amountReceived) || order.plan.priceAmount;

  await prisma.$transaction(async (tx) => {
    await tx.vipPaymentOrder.update({
      where: { id: order.id },
      data: {
        expiresAt: nextExpiresAt,
        paidAt: now,
        status: "paid",
      },
    });

    await tx.user.update({
      where: { id: order.user.id },
      data: {
        vipExpiresAt: nextExpiresAt,
        vipStartedAt:
          order.user.vipExpiresAt && order.user.vipExpiresAt.getTime() > now.getTime()
            ? order.user.vipStartedAt ?? now
            : now,
      },
    });
  });

  await applyAffiliateCommissionForVipOrder({
    amount: commissionBaseAmount,
    orderId: order.id,
    referredUserId: order.user.id,
  }).catch(() => null);

  await sendTelegramUserMessage({
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

  if (runtime.provider !== "paymenku") {
    throw new Error("Provider pembayaran saat ini belum disetel ke Paymenku.");
  }

  if (!runtime.apiKey) {
    throw new Error("API key Paymenku belum terpasang.");
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

  const order = await prisma.vipPaymentOrder.create({
    data: {
      amount: plan.priceAmount,
      currency: plan.currency,
      metadata: {
        channelCode: selectedChannel.code,
        channelName: selectedChannel.name,
        channelType: selectedChannel.type,
        customerEmail: user.email,
        customerName: user.name,
        customerPhone: input.userPhone ?? null,
        referenceId: null,
      },
      planId: plan.id,
      provider: runtime.provider,
      status: "pending",
      userId: user.id,
    },
  });

  const returnUrl = `${runtime.publicAppUrl}/vip/pay/${order.id}`;
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
        channelCode: selectedChannel.code,
        channelName: selectedChannel.name,
        channelType: selectedChannel.type,
        customerEmail: user.email,
        customerName: user.name,
        customerPhone: input.userPhone ?? null,
        expirationDate: payload.data.payment_info?.expiration_date ?? null,
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
    throw new Error("API key Paymenku belum terpasang.");
  }

  const order = await prisma.vipPaymentOrder.findFirst({
    where: {
      id: input.orderId,
      ...(input.userId ? { userId: input.userId } : {}),
    },
    select: {
      externalCheckoutId: true,
      id: true,
      metadata: true,
      status: true,
    },
  });

  if (!order) {
    throw new Error("Order VIP tidak ditemukan.");
  }

  const orderMeta = getOrderPaymentMetadata(order);
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
