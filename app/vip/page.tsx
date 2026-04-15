import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Crown,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { startVipPayment } from "@/app/vip/actions";
import { Button } from "@/components/ui/button";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import {
  formatCurrency,
  getPaymentGatewaySettingsSafe,
  getPaymenkuChannels,
  getVipPaymentOrderForUser,
  getVipPaymentOrdersForUser,
  getVipPlansSafe,
} from "@/lib/payments";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import { requireUserSession } from "@/lib/user-auth";
import { getVipProgramSettingsSafe, getVipStatus } from "@/lib/vip";

export const dynamic = "force-dynamic";

const vipBenefits = [
  "Tonton tanpa batas preview",
  "Akses penuh semua judul premium",
  "Masuk lebih cepat ke rilis favorit",
  "Pengalaman nonton lebih mulus dan fokus",
] as const;

function formatVipDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatOrderStatus(status: string) {
  switch (status) {
    case "paid":
      return "Pembayaran berhasil";
    case "pending":
      return "Menunggu pembayaran";
    case "expired":
      return "Pembayaran kedaluwarsa";
    case "failed":
      return "Pembayaran gagal";
    case "cancelled":
      return "Pembayaran dibatalkan";
    default:
      return status;
  }
}

type VipPageProps = {
  searchParams: Promise<{
    message?: string;
    orderId?: string;
    payment?: string;
    plan?: string;
  }>;
};

export default async function VipPage({ searchParams }: VipPageProps) {
  const params = await searchParams;
  const user = await requireUserSession();
  const [
    backdropMovies,
    vipSettingsResult,
    telegramSettingsResult,
    paymentSettingsResult,
    plansResult,
    recentOrders,
    channelResult,
  ] = await Promise.all([
    getCinematicBackdropMovies(),
    getVipProgramSettingsSafe(),
    getTelegramBotSettingsSafe(),
    getPaymentGatewaySettingsSafe(),
    getVipPlansSafe({ activeOnly: true }),
    getVipPaymentOrdersForUser(user.id, 5),
    getPaymenkuChannels(),
  ]);

  const vipStatus = getVipStatus(user);
  const vipSettings = vipSettingsResult.settings;
  const heroMovie = backdropMovies[0] ?? null;
  const supportUrl = telegramSettingsResult.settings.supportUrl;
  const paymentRuntime = paymentSettingsResult.runtime;
  const paymentReady =
    paymentRuntime.enabled &&
    paymentRuntime.provider === "paymenku" &&
    Boolean(paymentRuntime.apiKey);
  const selectedPlan =
    plansResult.plans.find(
      (plan) => plan.id === params.plan || plan.slug === params.plan,
    ) ?? null;
  const selectedOrder =
    params.orderId
      ? await getVipPaymentOrderForUser({
          orderId: params.orderId,
          userId: user.id,
        })
      : null;
  const upgradeUrl =
    vipSettings.joinVipUrl.endsWith("/vip") ||
    vipSettings.joinVipUrl.endsWith("/profile")
      ? supportUrl
      : vipSettings.joinVipUrl;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-6 text-white">
      {heroMovie ? (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={heroMovie.thumbnail}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-[0.18]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25)_0%,rgba(0,0,0,0.76)_20%,#080808_58%,#050505_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(244,114,34,0.22),transparent_24%),radial-gradient(circle_at_50%_22%,rgba(220,38,38,0.18),transparent_34%)]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(244,114,34,0.18),transparent_24%),linear-gradient(180deg,#140909_0%,#050505_100%)]" />
      )}

      <section className="relative z-10 mx-auto w-full max-w-md space-y-5">
        {params.payment ? (
          <div
            className={[
              "rounded-[24px] border px-4 py-4 text-sm leading-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]",
              params.payment === "success" || params.payment === "paid"
                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                : params.payment === "cancel"
                  ? "border-white/10 bg-white/[0.05] text-neutral-200"
                  : "border-red-400/20 bg-red-500/10 text-red-100",
            ].join(" ")}
          >
            <p className="font-semibold text-white">
              {params.payment === "paid"
                ? "VIP sudah aktif"
                : params.payment === "cancel"
                  ? "Pembayaran dibatalkan"
                  : params.payment === "success"
                    ? "Order pembayaran sudah dibuat"
                    : "Pembayaran VIP belum berhasil"}
            </p>
            <p className="mt-2">
              {params.message ??
                (params.payment === "paid"
                  ? "Pembayaran sudah dikonfirmasi. Akunmu sekarang masuk mode VIP aktif."
                  : params.payment === "success"
                    ? "Lanjutkan pembayaran di halaman berikutnya."
                    : "Coba lagi sebentar lagi atau pakai jalur aktivasi manual dulu.")}
            </p>
            {selectedOrder ? (
              <p className="mt-2 text-white/90">
                Status order: {formatOrderStatus(selectedOrder.status)} untuk{" "}
                {selectedOrder.plan.title}.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.82),rgba(8,8,8,0.95))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
            <Crown className="size-3.5" />
            Box Office VIP
          </div>

          <h1 className="mt-4 text-3xl font-black text-white">
            Buka pengalaman nonton yang lebih penuh
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Pilih paket, tentukan QRIS atau bank VA, lalu selesaikan pembayaran
            langsung dari Mini App.
          </p>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(110,25,25,0.32),rgba(22,18,18,0.84))] p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="size-4 text-orange-300" />
              {vipStatus.active ? "VIP aktif" : "Mode gratis"}
            </p>
            {vipStatus.active ? (
              <>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  Akunmu sedang aktif. Semua preview gratis sudah terbuka penuh
                  sampai masa VIP berakhir.
                </p>
                <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                    Masa aktif VIP
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {formatVipDate(vipStatus.expiresAt)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  Akun gratis berhenti otomatis setelah{" "}
                  {vipSettings.previewEnabled
                    ? `${vipSettings.previewLimitMinutes} menit`
                    : "batas preview yang diatur admin"}
                  . Upgrade VIP untuk lanjut nonton tanpa putus.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    asChild
                    data-haptic="medium"
                    className="h-11 bg-red-600 text-white hover:bg-red-500"
                  >
                    <a href={selectedPlan ? `#payment-methods` : "#vip-plans"}>
                      {selectedPlan ? "Lanjut ke pembayaran" : "Pilih paket"}
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="secondary"
                    data-haptic="light"
                    className="h-11 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                  >
                    <Link href="/profile" prefetch>
                      Kembali ke profil
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5">
          <p className="text-base font-bold text-white">Yang kamu dapat</p>
          <div className="mt-4 space-y-3">
            {vipBenefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-4"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500/12 text-red-200 ring-1 ring-red-400/20">
                  <BadgeCheck className="size-4" />
                </span>
                <p className="text-sm leading-6 text-neutral-200">{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="vip-plans"
          className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold text-white">Pilihan paket</p>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                Klik satu paket dulu, lalu kita tampilkan metode pembayarannya.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {plansResult.plans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;

              return (
                <div
                  key={plan.id}
                  className={[
                    "rounded-[22px] border p-4",
                    isSelected
                      ? "border-orange-300/25 bg-[linear-gradient(180deg,rgba(140,55,15,0.36),rgba(29,17,12,0.9))]"
                      : plan.highlight
                        ? "border-orange-300/20 bg-[linear-gradient(180deg,rgba(95,40,16,0.28),rgba(27,16,11,0.85))]"
                        : "border-white/10 bg-white/[0.04]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-orange-200">
                        {plan.badge ?? "VIP"}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-white">
                        {plan.title}
                      </h2>
                      <p className="mt-1 text-sm text-neutral-300">
                        Masa aktif {plan.durationDays} hari
                      </p>
                    </div>
                    <p className="text-right text-2xl font-black text-white">
                      {formatCurrency(plan.priceAmount, plan.currency)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-400">
                    {plan.description}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button
                      asChild
                      data-haptic="medium"
                      className="h-11 bg-red-600 text-white hover:bg-red-500"
                    >
                      <Link href={`/vip?plan=${encodeURIComponent(plan.id)}#payment-methods`} prefetch>
                        {isSelected ? "Paket dipilih" : "Pilih paket"}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="secondary"
                      data-haptic="light"
                      className="h-11 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                    >
                      <Link href="/" prefetch>
                        Lihat katalog
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          id="payment-methods"
          className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5"
        >
          <p className="text-sm font-semibold text-orange-200">Pembayaran</p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            {selectedPlan ? "Pilih metode pembayaran" : "Pilih paket dulu"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            {selectedPlan
              ? "Setelah metode dipilih, aplikasi akan langsung membuat transaksi dan menampilkan detail QRIS atau nomor VA."
              : "Tentukan paket VIP yang kamu mau, lalu opsi QRIS dan bank VA akan muncul di sini."}
          </p>

          {selectedPlan ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-yellow-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.95),rgba(217,119,6,0.95))] p-5 text-neutral-950">
                <p className="text-sm font-semibold opacity-80">{selectedPlan.title}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="opacity-70">Durasi</p>
                    <p className="mt-1 text-lg font-bold">
                      {selectedPlan.durationDays} hari
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="opacity-70">Harga</p>
                    <p className="mt-1 text-lg font-bold">
                      {formatCurrency(selectedPlan.priceAmount, selectedPlan.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {paymentReady ? (
                <div className="space-y-4">
                  <form action={startVipPayment} className="space-y-4">
                    <input type="hidden" name="planId" value={selectedPlan.id} />

                    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-full bg-white/10 text-neutral-200">
                          <Building2 className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-white">Transfer Bank</p>
                          <p className="text-sm text-neutral-400">
                            Gunakan Virtual Account dari bank yang tersedia.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {channelResult.groups.va.map((channel) => (
                          <button
                            key={channel.code}
                            type="submit"
                            name="channelCode"
                            value={channel.code}
                            className="flex w-full items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition-colors hover:bg-white/[0.08]"
                          >
                            <div>
                              <p className="font-semibold text-white">{channel.name}</p>
                              <p className="mt-1 text-sm text-neutral-400">
                                {channel.description}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-neutral-400">
                              {channel.feeDisplay || "VA"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-100">
                          <QrCode className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-white">QRIS</p>
                          <p className="text-sm text-neutral-400">
                            Scan dengan aplikasi bank atau e-wallet apa pun.
                          </p>
                        </div>
                      </div>
                      <button
                        type="submit"
                        name="channelCode"
                        value="qris"
                        className="mt-4 flex w-full items-center justify-between rounded-[18px] border border-indigo-400/25 bg-indigo-500/10 px-4 py-4 text-left transition-colors hover:bg-indigo-500/15"
                      >
                        <div>
                          <p className="font-semibold text-white">Pakai QRIS</p>
                          <p className="mt-1 text-sm text-neutral-300">
                            Langsung tampil QR dinamis dari Paymenku.
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-100">
                          {channelResult.groups.qris[0]?.feeDisplay || "QRIS"}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-neutral-300">
                  Gateway Paymenku belum aktif. Untuk sementara jalur aktivasi
                  masih diarahkan ke admin.
                  <div className="mt-4">
                    <Button
                      asChild
                      data-haptic="medium"
                      className="h-11 bg-red-600 text-white hover:bg-red-500"
                    >
                      <a href={upgradeUrl}>{vipSettings.joinVipLabel}</a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="size-4 text-orange-300" />
            Riwayat pembayaranmu
          </p>
          <div className="mt-4 space-y-3">
            {recentOrders.length ? (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {order.plan.title}
                      </p>
                      <p className="mt-1 text-sm text-neutral-400">
                        {new Intl.DateTimeFormat("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(order.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                      {formatOrderStatus(order.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-neutral-300">
                    {formatCurrency(order.amount, order.currency)}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button
                      asChild
                      data-haptic="light"
                      variant="secondary"
                      className="h-11 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                    >
                      <Link href={`/vip/pay/${order.id}`} prefetch>
                        Lihat detail pembayaran
                      </Link>
                    </Button>
                    <Button
                      asChild
                      data-haptic="light"
                      variant="secondary"
                      className="h-11 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                    >
                      <Link
                        href={`/vip?plan=${encodeURIComponent(order.plan.id)}#payment-methods`}
                        prefetch={false}
                      >
                        Beli lagi
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-neutral-400">
                Belum ada pembayaran VIP yang tersimpan di akun ini.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
