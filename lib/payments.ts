import { prisma } from "@/lib/prisma";

export type PaymentGatewaySettingsSnapshot = {
  checkoutButtonLabel: string;
  enabled: boolean;
  id: string;
  provider: string;
  slug: string;
  stripePublishableKey: string | null;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
};

export type PaymentGatewayRuntimeSettings = {
  apiKey: string;
  callbackToken: string;
  checkoutButtonLabel: string;
  enabled: boolean;
  projectSlug: string;
  provider: string;
  publicAppUrl: string;
  webhookUrl: string;
};

export type PaymentGatewaySettingsResult = {
  runtime: PaymentGatewayRuntimeSettings;
  schemaIssue: string | null;
  schemaReady: boolean;
  settings: PaymentGatewaySettingsSnapshot;
};

export type VipPlanSnapshot = {
  active: boolean;
  badge: string | null;
  createdAt: Date;
  ctaLabel: string;
  currency: string;
  description: string;
  durationDays: number;
  highlight: boolean;
  id: string;
  priceAmount: number;
  slug: string;
  sortOrder: number;
  title: string;
  updatedAt: Date;
};

export type VipPlanResult = {
  plans: VipPlanSnapshot[];
  schemaIssue: string | null;
  schemaReady: boolean;
};

export type VipPaymentOrderSnapshot = {
  amount: number;
  checkoutUrl: string | null;
  createdAt: Date;
  currency: string;
  externalPaymentId: string | null;
  expiresAt: Date | null;
  externalCheckoutId: string | null;
  id: string;
  metadata: PaymenkuPaymentMetadata | null;
  paidAt: Date | null;
  plan: Pick<VipPlanSnapshot, "durationDays" | "id" | "slug" | "title">;
  provider: string;
  status: string;
  updatedAt: Date;
  userId: string;
};

export type PaymenkuChannel = {
  code: string;
  description: string;
  feeDisplay: string;
  icon: string | null;
  name: string;
  type: "qris" | "va";
};

export type PaymenkuChannelGroups = {
  qris: PaymenkuChannel[];
  va: PaymenkuChannel[];
};

export type PaymenkuPaymentMetadata = {
  amountFee?: string | null;
  amountReceived?: string | null;
  bank?: string | null;
  channelCode?: string | null;
  channelName?: string | null;
  channelType?: "qris" | "va" | null;
  checkoutSource?: string | null;
  checkoutSourceLabel?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  expirationDate?: string | null;
  pakasirAmount?: string | number | null;
  pakasirProject?: string | null;
  payUrl?: string | null;
  paymentMethod?: string | null;
  qrString?: string | null;
  qrUrl?: string | null;
  referenceId?: string | null;
  totalPayment?: string | number | null;
  transactionId?: string | null;
  vaNumber?: string | null;
};

const DEFAULT_PAYMENT_GATEWAY_SETTINGS = {
  checkoutButtonLabel: "Aktifkan sekarang",
  enabled: false,
  provider: "paymenku",
  slug: "default",
  stripePublishableKey: null,
  stripeSecretKey: null,
  stripeWebhookSecret: null,
} satisfies Omit<PaymentGatewaySettingsSnapshot, "id">;

const DEFAULT_VIP_PLANS = [
  {
    badge: "Mulai cepat",
    ctaLabel: "Aktifkan 30 hari",
    currency: "IDR",
    description: "Pas untuk mulai membuka seluruh katalog tanpa komitmen panjang.",
    durationDays: 30,
    highlight: false,
    priceAmount: 49000,
    slug: "vip-bulanan",
    sortOrder: 1,
    title: "VIP Bulanan",
  },
  {
    badge: "Paling dipilih",
    ctaLabel: "Aktifkan 3 bulan",
    currency: "IDR",
    description: "Pilihan yang paling nyaman untuk user yang rutin kembali nonton dari Telegram.",
    durationDays: 90,
    highlight: true,
    priceAmount: 129000,
    slug: "vip-3-bulan",
    sortOrder: 2,
    title: "VIP 3 Bulan",
  },
  {
    badge: "Santai panjang",
    ctaLabel: "Aktifkan 1 tahun",
    currency: "IDR",
    description: "Lebih hemat untuk katalog besar dan kebiasaan nonton yang panjang.",
    durationDays: 365,
    highlight: false,
    priceAmount: 399000,
    slug: "vip-tahunan",
    sortOrder: 3,
    title: "VIP Tahunan",
  },
] satisfies Array<
  Omit<VipPlanSnapshot, "active" | "createdAt" | "id" | "updatedAt">
>;

function getOptionalEnv(key: string) {
  const value = process.env[key]?.trim();

  return value ? value : "";
}

function getPublicAppUrl() {
  return getOptionalEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
}

function getPaymenkuWebhookUrl(publicAppUrl: string, callbackToken: string) {
  const url = new URL("/api/webhooks/paymenku", publicAppUrl);

  if (callbackToken) {
    url.searchParams.set("token", callbackToken);
  }

  return url.toString();
}

function getPakasirWebhookUrl(publicAppUrl: string, callbackToken: string) {
  const url = new URL("/api/webhooks/pakasir", publicAppUrl);

  if (callbackToken) {
    url.searchParams.set("token", callbackToken);
  }

  return url.toString();
}

function normalizePaymentProvider(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "pakasir" ? "pakasir" : "paymenku";
}

export function getPaymentProviderLabel(provider: string | null | undefined) {
  return normalizePaymentProvider(provider) === "pakasir"
    ? "Pakasir"
    : "Paymenku";
}

function createDefaultPaymentGatewaySettings(): PaymentGatewaySettingsSnapshot {
  return {
    id: "default-payment-gateway-settings",
    ...DEFAULT_PAYMENT_GATEWAY_SETTINGS,
  };
}

function createDefaultVipPlans(): VipPlanSnapshot[] {
  const now = new Date();

  return DEFAULT_VIP_PLANS.map((plan, index) => ({
    active: true,
    badge: plan.badge,
    createdAt: now,
    ctaLabel: plan.ctaLabel,
    currency: plan.currency,
    description: plan.description,
    durationDays: plan.durationDays,
    highlight: plan.highlight,
    id: `default-vip-plan-${index + 1}`,
    priceAmount: plan.priceAmount,
    slug: plan.slug,
    sortOrder: plan.sortOrder,
    title: plan.title,
    updatedAt: now,
  }));
}

function isMissingPaymentSchemaError(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    !["P2021", "P2022"].includes(String(error.code))
  ) {
    return false;
  }

  const message = String("message" in error ? error.message : "");

  return (
    message.includes("PaymentGatewaySettings") ||
    message.includes("VipPlan") ||
    message.includes("VipPaymentOrder")
  );
}

function mergeRuntimeSettings(
  settings: PaymentGatewaySettingsSnapshot,
): PaymentGatewayRuntimeSettings {
  const provider = normalizePaymentProvider(settings.provider);
  const envApiKey =
    provider === "pakasir"
      ? getOptionalEnv("PAKASIR_API_KEY")
      : getOptionalEnv("PAYMENKU_API_KEY");
  const envProjectSlug = getOptionalEnv("PAKASIR_PROJECT_SLUG");
  const envCallbackToken =
    provider === "pakasir"
      ? getOptionalEnv("PAKASIR_WEBHOOK_TOKEN") ||
        getOptionalEnv("PAKASIR_CALLBACK_TOKEN")
      : getOptionalEnv("PAYMENKU_WEBHOOK_TOKEN") ||
        getOptionalEnv("PAYMENKU_CALLBACK_TOKEN");
  const publicAppUrl = getPublicAppUrl();
  const apiKey = settings.stripeSecretKey?.trim() || envApiKey;
  const projectSlug =
    provider === "pakasir"
      ? settings.stripePublishableKey?.trim() || envProjectSlug
      : "";
  const callbackToken = settings.stripeWebhookSecret?.trim() || envCallbackToken;
  const hasDatabaseCredentials =
    provider === "pakasir"
      ? Boolean(settings.stripeSecretKey?.trim() || settings.stripePublishableKey?.trim())
      : Boolean(settings.stripeSecretKey?.trim());
  const credentialsReady =
    provider === "pakasir" ? Boolean(apiKey && projectSlug) : Boolean(apiKey);

  return {
    apiKey,
    callbackToken,
    checkoutButtonLabel: settings.checkoutButtonLabel || "Aktifkan sekarang",
    enabled: hasDatabaseCredentials ? settings.enabled && credentialsReady : credentialsReady,
    projectSlug,
    provider,
    publicAppUrl,
    webhookUrl:
      provider === "pakasir"
        ? getPakasirWebhookUrl(publicAppUrl, callbackToken)
        : getPaymenkuWebhookUrl(publicAppUrl, callbackToken),
  };
}

export function formatCurrency(value: number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export async function ensurePaymentGatewaySettings() {
  const defaults = createDefaultPaymentGatewaySettings();

  return prisma.paymentGatewaySettings.upsert({
    where: { slug: defaults.slug },
    update: {},
    create: {
      checkoutButtonLabel: defaults.checkoutButtonLabel,
      enabled: defaults.enabled,
      provider: defaults.provider,
      slug: defaults.slug,
      stripePublishableKey: defaults.stripePublishableKey,
      stripeSecretKey: defaults.stripeSecretKey,
      stripeWebhookSecret: defaults.stripeWebhookSecret,
    },
  });
}

export async function ensureVipPlans() {
  const count = await prisma.vipPlan.count();

  if (count > 0) {
    return prisma.vipPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  await prisma.vipPlan.createMany({
    data: DEFAULT_VIP_PLANS.map((plan) => ({
      active: true,
      badge: plan.badge,
      ctaLabel: plan.ctaLabel,
      currency: plan.currency,
      description: plan.description,
      durationDays: plan.durationDays,
      highlight: plan.highlight,
      priceAmount: plan.priceAmount,
      slug: plan.slug,
      sortOrder: plan.sortOrder,
      title: plan.title,
    })),
  });

  return prisma.vipPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getPaymentGatewaySettingsSafe(): Promise<PaymentGatewaySettingsResult> {
  try {
    const settings = await ensurePaymentGatewaySettings();
    const snapshot: PaymentGatewaySettingsSnapshot = {
      checkoutButtonLabel: settings.checkoutButtonLabel,
      enabled: settings.enabled,
      id: settings.id,
      provider: settings.provider,
      slug: settings.slug,
      stripePublishableKey: settings.stripePublishableKey,
      stripeSecretKey: settings.stripeSecretKey,
      stripeWebhookSecret: settings.stripeWebhookSecret,
    };

    return {
      runtime: mergeRuntimeSettings(snapshot),
      schemaIssue: null,
      schemaReady: true,
      settings: snapshot,
    };
  } catch (error) {
    if (!isMissingPaymentSchemaError(error)) {
      throw error;
    }

    const fallback = createDefaultPaymentGatewaySettings();

    return {
      runtime: mergeRuntimeSettings(fallback),
      schemaIssue:
        "Database runtime belum punya tabel payment gateway terbaru. Env server dipakai sebagai fallback sementara.",
      schemaReady: false,
      settings: fallback,
    };
  }
}

export async function getVipPlansSafe(options?: {
  activeOnly?: boolean;
}): Promise<VipPlanResult> {
  try {
    const plans = await ensureVipPlans();
    const resolvedPlans = options?.activeOnly
      ? plans.filter((plan) => plan.active)
      : plans;

    return {
      plans: resolvedPlans,
      schemaIssue: null,
      schemaReady: true,
    };
  } catch (error) {
    if (!isMissingPaymentSchemaError(error)) {
      throw error;
    }

    const fallbackPlans = createDefaultVipPlans();

    return {
      plans: options?.activeOnly
        ? fallbackPlans.filter((plan) => plan.active)
        : fallbackPlans,
      schemaIssue:
        "Database runtime belum punya tabel paket VIP terbaru. Paket default sementara dipakai dari aplikasi.",
      schemaReady: false,
    };
  }
}

export async function getVipPaymentOrdersForUser(userId: string, take = 5) {
  try {
    return await prisma.vipPaymentOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        amount: true,
        checkoutUrl: true,
        createdAt: true,
        currency: true,
        externalPaymentId: true,
        expiresAt: true,
        externalCheckoutId: true,
        id: true,
        metadata: true,
        paidAt: true,
        provider: true,
        status: true,
        updatedAt: true,
        userId: true,
        plan: {
          select: {
            durationDays: true,
            id: true,
            slug: true,
            title: true,
          },
        },
      },
      take,
    });
  } catch (error) {
    if (!isMissingPaymentSchemaError(error)) {
      throw error;
    }

    return [] satisfies VipPaymentOrderSnapshot[];
  }
}

export async function getVipPaymentOrderForUser(input: {
  orderId: string;
  userId: string;
}) {
  try {
    return await prisma.vipPaymentOrder.findFirst({
      where: {
        id: input.orderId,
        userId: input.userId,
      },
      select: {
        amount: true,
        checkoutUrl: true,
        createdAt: true,
        currency: true,
        externalPaymentId: true,
        expiresAt: true,
        externalCheckoutId: true,
        id: true,
        metadata: true,
        paidAt: true,
        provider: true,
        status: true,
        updatedAt: true,
        userId: true,
        plan: {
          select: {
            durationDays: true,
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isMissingPaymentSchemaError(error)) {
      throw error;
    }

    return null;
  }
}

const DEFAULT_PAYMENKU_CHANNELS: PaymenkuChannelGroups = {
  qris: [
    {
      code: "qris",
      description: "Scan dengan aplikasi bank atau e-wallet apa pun.",
      feeDisplay: "Biaya mengikuti channel QRIS aktif",
      icon: null,
      name: "QRIS",
      type: "qris",
    },
  ],
  va: [
    { code: "bni_va", description: "Virtual Account BNI", feeDisplay: "", icon: null, name: "Bank BNI", type: "va" },
    { code: "bri_va", description: "Virtual Account BRI", feeDisplay: "", icon: null, name: "Bank BRI", type: "va" },
    { code: "mandiri_va", description: "Virtual Account Mandiri", feeDisplay: "", icon: null, name: "Bank Mandiri", type: "va" },
    { code: "bca_va", description: "Virtual Account BCA", feeDisplay: "", icon: null, name: "Bank BCA", type: "va" },
    { code: "bsi_va", description: "Virtual Account BSI", feeDisplay: "", icon: null, name: "Bank BSI", type: "va" },
    { code: "cimb_va", description: "Virtual Account CIMB", feeDisplay: "", icon: null, name: "Bank CIMB Niaga", type: "va" },
    { code: "permata_va", description: "Virtual Account Permata", feeDisplay: "", icon: null, name: "Bank Permata", type: "va" },
  ],
};

const DEFAULT_PAKASIR_CHANNELS: PaymenkuChannelGroups = {
  qris: [
    {
      code: "qris",
      description: "Scan dengan aplikasi bank atau e-wallet apa pun.",
      feeDisplay: "QRIS",
      icon: null,
      name: "QRIS",
      type: "qris",
    },
  ],
  va: [
    { code: "bni_va", description: "Virtual Account BNI", feeDisplay: "VA", icon: null, name: "Bank BNI", type: "va" },
    { code: "bri_va", description: "Virtual Account BRI", feeDisplay: "VA", icon: null, name: "Bank BRI", type: "va" },
    { code: "cimb_niaga_va", description: "Virtual Account CIMB Niaga", feeDisplay: "VA", icon: null, name: "Bank CIMB Niaga", type: "va" },
    { code: "permata_va", description: "Virtual Account Permata", feeDisplay: "VA", icon: null, name: "Bank Permata", type: "va" },
    { code: "maybank_va", description: "Virtual Account Maybank", feeDisplay: "VA", icon: null, name: "Bank Maybank", type: "va" },
    { code: "sampoerna_va", description: "Virtual Account Bank Sampoerna", feeDisplay: "VA", icon: null, name: "Bank Sampoerna", type: "va" },
    { code: "bnc_va", description: "Virtual Account Bank Neo Commerce", feeDisplay: "VA", icon: null, name: "Bank Neo Commerce", type: "va" },
    { code: "atm_bersama_va", description: "Virtual Account ATM Bersama", feeDisplay: "VA", icon: null, name: "ATM Bersama", type: "va" },
    { code: "artha_graha_va", description: "Virtual Account Artha Graha", feeDisplay: "VA", icon: null, name: "Bank Artha Graha", type: "va" },
  ],
};

function normalizeChannelType(input: string | undefined | null) {
  if (input === "qris") {
    return "qris";
  }

  return "va";
}

function readPaymenkuMetadata(value: unknown): PaymenkuPaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as PaymenkuPaymentMetadata;
}

function normalizePaymenkuChannel(input: {
  code?: string | null;
  description?: string | null;
  fee?: { display?: string | null } | null;
  icon?: string | null;
  name?: string | null;
  type?: string | null;
}): PaymenkuChannel {
  return {
    code: input.code?.trim() || "unknown",
    description: input.description?.trim() || input.name?.trim() || "Metode pembayaran",
    feeDisplay: input.fee?.display?.trim() || "",
    icon: input.icon?.trim() || null,
    name: input.name?.trim() || "Payment channel",
    type: normalizeChannelType(input.type),
  };
}

export async function getPaymenkuChannels(): Promise<{
  groups: PaymenkuChannelGroups;
  ready: boolean;
}> {
  const settings = await getPaymentGatewaySettingsSafe();
  const runtime = settings.runtime;

  if (runtime.provider === "pakasir") {
    return {
      groups: DEFAULT_PAKASIR_CHANNELS,
      ready: Boolean(runtime.apiKey && runtime.projectSlug),
    };
  }

  if (!runtime.apiKey) {
    return {
      groups: DEFAULT_PAYMENKU_CHANNELS,
      ready: false,
    };
  }

  try {
    const response = await fetch("https://paymenku.com/api/v1/payment-channels", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${runtime.apiKey}`,
      },
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      throw new Error(`Paymenku channels request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: {
        qris?: Array<{
          code?: string | null;
          description?: string | null;
          fee?: { display?: string | null } | null;
          icon?: string | null;
          name?: string | null;
          type?: string | null;
        }>;
        va?: Array<{
          code?: string | null;
          description?: string | null;
          fee?: { display?: string | null } | null;
          icon?: string | null;
          name?: string | null;
          type?: string | null;
        }>;
      };
      status?: string;
    };

    const groups: PaymenkuChannelGroups = {
      qris: (payload.data?.qris ?? []).map(normalizePaymenkuChannel),
      va: (payload.data?.va ?? []).map(normalizePaymenkuChannel),
    };

    return {
      groups: {
        qris: groups.qris.length ? groups.qris : DEFAULT_PAYMENKU_CHANNELS.qris,
        va: groups.va.length ? groups.va : DEFAULT_PAYMENKU_CHANNELS.va,
      },
      ready: true,
    };
  } catch {
    return {
      groups: DEFAULT_PAYMENKU_CHANNELS,
      ready: false,
    };
  }
}

export async function getAdminPaymentData() {
  const [settingsResult, plansResult] = await Promise.all([
    getPaymentGatewaySettingsSafe(),
    getVipPlansSafe(),
  ]);

  try {
    const [recentOrders, totalOrders, paidOrders, totalRevenue] = await Promise.all([
      prisma.vipPaymentOrder.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          amount: true,
          createdAt: true,
          currency: true,
          id: true,
          status: true,
          user: {
            select: {
              name: true,
              telegramUsername: true,
            },
          },
          plan: {
            select: {
              title: true,
            },
          },
        },
        take: 12,
      }),
      prisma.vipPaymentOrder.count(),
      prisma.vipPaymentOrder.count({
        where: {
          status: "paid",
        },
      }),
      prisma.vipPaymentOrder.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: "paid",
        },
      }),
    ]);

    return {
      paidOrders,
      plansResult,
      recentOrders,
      schemaIssue: null,
      schemaReady: true,
      settingsResult,
      totalOrders,
      totalRevenue: totalRevenue._sum.amount ?? 0,
    };
  } catch (error) {
    if (!isMissingPaymentSchemaError(error)) {
      throw error;
    }

    return {
      paidOrders: 0,
      plansResult,
      recentOrders: [],
      schemaIssue:
        "Database runtime belum punya tabel order pembayaran terbaru. Riwayat transaksi belum tampil.",
      schemaReady: false,
      settingsResult,
      totalOrders: 0,
      totalRevenue: 0,
    };
  }
}

export function getOrderPaymentMetadata(
  order: {
    metadata: unknown;
  },
) {
  return readPaymenkuMetadata(order.metadata);
}
