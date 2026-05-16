import Link from "next/link";
import { Building2, CheckCircle2, Crown, QrCode } from "lucide-react";

import { startVipPayment } from "@/app/vip/actions";
import { Button } from "@/components/ui/button";
import { PaymentSubmitButton } from "@/components/vip/payment-submit-button";
import {
  formatCurrency,
  getPaymentGatewaySettingsSafe,
  getPaymentProviderLabel,
  getPaymenkuChannels,
  getVipPlansSafe,
} from "@/lib/payments";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import { requireUserSession } from "@/lib/user-auth";
import { repairPaidVipOrdersForUser } from "@/lib/vip-checkout";
import { getVipProgramSettingsSafe, getVipStatus } from "@/lib/vip";

export const dynamic = "force-dynamic";

type VipPageProps = {
  searchParams: Promise<{
    channel?: string;
    message?: string;
    orderId?: string;
    payment?: string;
    plan?: string;
  }>;
};

function PaymentAlert({
  message,
  payment,
}: {
  message?: string;
  payment?: string;
}) {
  if (!payment) {
    return null;
  }

  const className =
    payment === "paid" || payment === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : payment === "cancel"
        ? "border-white/10 bg-white/[0.05] text-neutral-200"
        : "border-red-400/20 bg-red-500/10 text-red-100";

  const title =
    payment === "paid"
      ? "VIP sudah aktif"
      : payment === "success"
        ? "Transaksi dibuat"
        : payment === "cancel"
          ? "Pembayaran dibatalkan"
          : "Pembayaran belum berhasil";

  return (
    <div className={`rounded-[22px] border px-4 py-3 text-sm leading-6 ${className}`}>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1">
        {message ??
          (payment === "paid"
            ? "Pembayaran berhasil dikonfirmasi dan akses VIP kamu sudah aktif."
            : "Coba lagi sebentar lagi atau pilih metode pembayaran lain.")}
      </p>
    </div>
  );
}

export default async function VipPage({ searchParams }: VipPageProps) {
  const params = await searchParams;
  const sessionUser = await requireUserSession();
  const user =
    (await repairPaidVipOrdersForUser(sessionUser.id).catch(() => null)) ??
    sessionUser;
  const [
    vipSettingsResult,
    telegramSettingsResult,
    paymentSettingsResult,
    plansResult,
    channelResult,
  ] = await Promise.all([
    getVipProgramSettingsSafe(),
    getTelegramBotSettingsSafe(),
    getPaymentGatewaySettingsSafe(),
    getVipPlansSafe({ activeOnly: true }),
    getPaymenkuChannels(),
  ]);

  const vipStatus = getVipStatus(user);
  const vipSettings = vipSettingsResult.settings;
  const supportUrl = telegramSettingsResult.settings.supportUrl;
  const paymentRuntime = paymentSettingsResult.runtime;
  const gatewayLabel = getPaymentProviderLabel(paymentRuntime.provider);
  const paymentReady = paymentRuntime.enabled;
  const bankMethodLabel = channelResult.groups.va
    .map((channel) => channel.name.replace(/^Bank\s+/i, ""))
    .slice(0, 6)
    .join(", ");
  const selectedPlan =
    plansResult.plans.find(
      (plan) => plan.id === params.plan || plan.slug === params.plan,
    ) ?? null;
  const selectedChannelCode =
    params.channel?.trim() ||
    channelResult.groups.qris[0]?.code ||
    channelResult.groups.va[0]?.code ||
    "";
  const upgradeUrl =
    vipSettings.joinVipUrl.endsWith("/vip") ||
    vipSettings.joinVipUrl.endsWith("/profile")
      ? supportUrl
      : vipSettings.joinVipUrl;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_28%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)] px-4 pb-28 pt-5 text-white">
      <section className="mx-auto w-full max-w-md space-y-4">
        <PaymentAlert message={params.message} payment={params.payment} />

        {vipStatus.active ? (
          <div className="rounded-[22px] border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
            <p className="inline-flex items-center gap-2 font-semibold text-white">
              <CheckCircle2 className="size-4" />
              VIP aktif
            </p>
            <p className="mt-1">
              Akses penuh aktif sampai{" "}
              {vipStatus.expiresAt
                ? new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "long",
                    year: "numeric",
                  }).format(vipStatus.expiresAt)
                : "-"}
              .
            </p>
          </div>
        ) : null}

        <section className="space-y-3">
          {plansResult.plans.map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;

            return (
              <Link
                key={plan.id}
                href={`/vip?plan=${encodeURIComponent(plan.id)}#payment-methods`}
                prefetch
                className={[
                  "block rounded-[24px] border p-5 transition-transform duration-150 active:scale-[0.99]",
                  isSelected
                    ? "border-yellow-300/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.95),rgba(217,119,6,0.95))] text-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(22,22,22,0.96),rgba(8,8,8,0.98))] text-white",
                ].join(" ")}
                data-haptic="medium"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={
                        isSelected
                          ? "text-sm font-semibold opacity-75"
                          : "text-sm font-semibold text-orange-200"
                      }
                    >
                      {plan.badge ?? "VIP"}
                    </p>
                    <h1 className="mt-1 text-2xl font-black">{plan.title}</h1>
                    <p
                      className={
                        isSelected
                          ? "mt-2 text-sm leading-6 opacity-80"
                          : "mt-2 text-sm leading-6 text-neutral-400"
                      }
                    >
                      {plan.description}
                    </p>
                  </div>
                  <Crown className={isSelected ? "size-5 opacity-70" : "size-5 text-neutral-500"} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className={isSelected ? "opacity-70" : "text-neutral-500"}>
                      Durasi
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {plan.durationDays} hari
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={isSelected ? "opacity-70" : "text-neutral-500"}>
                      Harga
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {formatCurrency(plan.priceAmount, plan.currency)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <section
          id="payment-methods"
          className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.96),rgba(8,8,8,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
        >
          {selectedPlan ? (
            <>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-orange-200">
                  Paket terpilih
                </p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">
                      {selectedPlan.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-400">
                      {selectedPlan.durationDays} hari akses VIP penuh
                    </p>
                  </div>
                  <p className="text-xl font-black text-white">
                    {formatCurrency(selectedPlan.priceAmount, selectedPlan.currency)}
                  </p>
                </div>
              </div>

              {paymentReady ? (
                <form action={startVipPayment} className="mt-4 space-y-3">
                  <input type="hidden" name="planId" value={selectedPlan.id} />

                  <details
                    className="group rounded-[22px] border border-white/10 bg-white/[0.04] open:bg-white/[0.06]"
                    open={channelResult.groups.va.some(
                      (channel) => channel.code === selectedChannelCode,
                    )}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white">
                          <Building2 className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-white">Transfer Bank</p>
                          <p className="text-sm text-neutral-400">
                            {bankMethodLabel || "Virtual Account bank"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-neutral-400">
                        Pilih bank
                      </span>
                    </summary>

                    <div className="border-t border-white/10 px-3 pb-3 pt-2">
                      <div className="space-y-2">
                        {channelResult.groups.va.map((channel) => {
                          const isSelected = selectedChannelCode === channel.code;

                          return (
                            <label
                              key={channel.code}
                              className={[
                                "flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition-colors",
                                isSelected
                                  ? "border-orange-300/30 bg-orange-500/10"
                                  : "border-white/10 bg-black/20 hover:bg-white/[0.08]",
                              ].join(" ")}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="channelCode"
                                  value={channel.code}
                                  defaultChecked={isSelected}
                                  className="size-4 border-white/20 bg-transparent accent-orange-400"
                                />
                                <div>
                                  <p className="font-semibold text-white">{channel.name}</p>
                                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                                    {channel.description}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={
                                  isSelected
                                    ? "text-xs font-semibold text-orange-100"
                                    : "text-xs font-semibold text-neutral-500"
                                }
                              >
                                {channel.feeDisplay || "VA"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </details>

                  {channelResult.groups.qris[0] ? (
                    <label
                      className={[
                        "flex cursor-pointer items-center justify-between rounded-[22px] border px-4 py-4 text-left transition-colors",
                        selectedChannelCode === channelResult.groups.qris[0].code
                          ? "border-indigo-300/30 bg-indigo-500/15"
                          : "border-indigo-400/25 bg-indigo-500/10 hover:bg-indigo-500/15",
                      ].join(" ")}
                      data-haptic="medium"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="channelCode"
                          value={channelResult.groups.qris[0].code}
                          defaultChecked={
                            selectedChannelCode === channelResult.groups.qris[0].code
                          }
                          className="size-4 border-white/20 bg-transparent accent-indigo-300"
                        />
                        <span className="flex size-11 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-100">
                          <QrCode className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-white">QRIS</p>
                          <p className="text-sm text-neutral-300">
                            Scan dengan aplikasi bank atau e-wallet apa pun
                          </p>
                        </div>
                      </div>
                      <span
                        className={
                          selectedChannelCode === channelResult.groups.qris[0].code
                            ? "text-xs font-semibold text-indigo-50"
                            : "text-xs font-semibold text-indigo-100"
                        }
                      >
                        {channelResult.groups.qris[0].feeDisplay || "QRIS"}
                      </span>
                    </label>
                  ) : null}

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-white">
                      Metode terpilih
                    </p>
                    <p className="mt-1 text-sm text-neutral-400">
                      Pilih QRIS atau salah satu bank, lalu lanjutkan ke detail
                      pembayaran.
                    </p>
                    <PaymentSubmitButton />
                  </div>
                </form>
              ) : (
                <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-neutral-300">
                  Gateway {gatewayLabel} belum aktif. Untuk sementara aktivasi
                  VIP masih diarahkan ke admin.
                  <div className="mt-4">
                    <Button
                      asChild
                      data-haptic="medium"
                      className="h-11 w-full bg-red-600 text-white hover:bg-red-500"
                    >
                      <a href={upgradeUrl}>{vipSettings.joinVipLabel}</a>
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm leading-6 text-neutral-400">
              Belum ada paket VIP aktif dari admin.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
