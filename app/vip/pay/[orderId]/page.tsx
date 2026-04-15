import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, QrCode, ShieldCheck } from "lucide-react";

import { checkVipPaymentStatus } from "@/app/vip/actions";
import { CopyButton } from "@/components/vip/copy-button";
import { PaymentCountdown } from "@/components/vip/payment-countdown";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  getOrderPaymentMetadata,
  getVipPaymentOrderForUser,
} from "@/lib/payments";
import { requireUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type VipPaymentDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
  searchParams: Promise<{
    message?: string;
    status?: string;
  }>;
};

function formatStatus(status: string) {
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

export default async function VipPaymentDetailPage({
  params,
  searchParams,
}: VipPaymentDetailPageProps) {
  const [{ orderId }, query, user] = await Promise.all([
    params,
    searchParams,
    requireUserSession(),
  ]);
  const order = await getVipPaymentOrderForUser({
    orderId,
    userId: user.id,
  });

  if (!order) {
    redirect("/vip?payment=error&message=Order+pembayaran+tidak+ditemukan.");
  }

  const metadata = getOrderPaymentMetadata(order);
  const isQris = metadata?.channelType === "qris";
  const isPaid = order.status === "paid";

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-6 text-white">
      <section className="mx-auto w-full max-w-md space-y-5">
        <Link href="/vip" className="inline-flex items-center text-sm text-neutral-300">
          Back
        </Link>

        {query.status ? (
          <div
            className={[
              "rounded-[22px] border px-4 py-4 text-sm leading-6",
              query.status === "error"
                ? "border-red-400/20 bg-red-500/10 text-red-100"
                : query.status === "paid"
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.04] text-neutral-200",
            ].join(" ")}
          >
            <p className="font-semibold text-white">{formatStatus(order.status)}</p>
            <p className="mt-2">{query.message ?? "Status order sudah diperbarui."}</p>
          </div>
        ) : null}

        <div className="rounded-[24px] border border-yellow-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.95),rgba(217,119,6,0.95))] p-5 text-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
          <p className="text-sm font-semibold opacity-80">{order.plan.title}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="opacity-70">Durasi</p>
              <p className="mt-1 text-lg font-bold">{order.plan.durationDays} hari</p>
            </div>
            <div className="text-right">
              <p className="opacity-70">Harga</p>
              <p className="mt-1 text-lg font-bold">
                {formatCurrency(order.amount, order.currency)}
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,24,0.96),rgba(9,9,9,0.98))] p-5">
          <div className="text-center">
            <p className="text-sm text-neutral-400">Total pembayaran</p>
            <p className="mt-2 text-4xl font-black text-white">
              {formatCurrency(order.amount, order.currency)}
            </p>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-black/30 p-5">
            {isQris ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20">
                  <QrCode className="size-6" />
                </div>
                {metadata?.qrUrl ? (
                  <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[18px] bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={metadata.qrUrl}
                      alt="QRIS"
                      className="h-auto w-full rounded-[12px]"
                    />
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-8 text-sm text-neutral-400">
                    QRIS belum tampil. Coba cek status beberapa detik lagi.
                  </div>
                )}
                <p className="text-sm text-neutral-300">
                  Scan dengan aplikasi bank atau e-wallet mana pun.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/20">
                  <Building2 className="size-6" />
                </div>
                <p className="text-sm font-semibold text-white">
                  {metadata?.bank ?? metadata?.channelName ?? "Virtual Account"}
                </p>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    Nomor virtual account
                  </p>
                  <p className="mt-3 break-all text-2xl font-black text-white">
                    {metadata?.vaNumber ?? "-"}
                  </p>
                </div>
                {metadata?.vaNumber ? (
                  <div className="flex justify-center">
                    <CopyButton label="Salin nomor VA" value={metadata.vaNumber} />
                  </div>
                ) : null}
                <div className="rounded-[18px] border border-yellow-300/10 bg-yellow-500/10 px-4 py-4 text-sm leading-6 text-yellow-100">
                  Transfer tepat {formatCurrency(order.amount, order.currency)} ke nomor
                  VA di atas. Pembayaran akan dikonfirmasi otomatis.
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col items-center gap-3 text-center">
              <PaymentCountdown expiresAt={metadata?.expirationDate ?? null} />
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Kedaluwarsa dalam
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              ID pesanan
            </p>
            <p className="mt-2 break-all text-sm text-white">
              {metadata?.referenceId ?? order.id}
            </p>
          </div>

          {order.checkoutUrl ? (
            <Button
              asChild
              variant="secondary"
              data-haptic="light"
              className="mt-4 h-12 w-full border border-white/10 bg-white/10 text-white hover:bg-white/15"
            >
              <a href={order.checkoutUrl}>Buka halaman Paymenku</a>
            </Button>
          ) : null}

          <form action={checkVipPaymentStatus} className="mt-4">
            <input type="hidden" name="orderId" value={order.id} />
            <Button
              type="submit"
              data-haptic="medium"
              className="h-12 w-full bg-sky-600 text-white hover:bg-sky-500"
            >
              {isPaid ? "Refresh status VIP" : "Sudah bayar? Cek di sini"}
            </Button>
          </form>
        </section>

        <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="size-4 text-orange-300" />
            Status sekarang
          </p>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            {isPaid
              ? "Pembayaran sudah masuk. Kalau VIP belum terasa aktif, tekan tombol refresh satu kali lagi."
              : `Order ini masih ${formatStatus(order.status).toLowerCase()}. Kamu bisa tetap di halaman ini sambil menunggu, atau cek status manual kapan saja.`}
          </p>
        </section>
      </section>
    </main>
  );
}
