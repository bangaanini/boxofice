import Link from "next/link";
import { CheckCheck, Crown, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatCurrency, getVipPaymentOrderForUser } from "@/lib/payments";
import { requireUserSession } from "@/lib/user-auth";
import { getVipStatus } from "@/lib/vip";

export const dynamic = "force-dynamic";

type VipSuccessPageProps = {
  searchParams: Promise<{
    orderId?: string;
  }>;
};

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

export default async function VipSuccessPage({
  searchParams,
}: VipSuccessPageProps) {
  const [{ orderId }, user] = await Promise.all([searchParams, requireUserSession()]);
  const vipStatus = getVipStatus(user);
  const order = orderId
    ? await getVipPaymentOrderForUser({
        orderId,
        userId: user.id,
      })
    : null;

  if (!vipStatus.active) {
    redirect("/vip?payment=error&message=Status+VIP+belum+aktif.");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_28%),radial-gradient(circle_at_50%_22%,rgba(220,38,38,0.18),transparent_36%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)] px-4 pb-28 pt-8 text-white">
      <section className="mx-auto w-full max-w-md">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,21,21,0.96),rgba(8,8,8,0.99))] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/14 text-emerald-200 ring-1 ring-emerald-400/20">
            <CheckCheck className="size-8" />
          </div>

          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-yellow-300/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-100">
            <Crown className="size-3.5" />
            VIP berhasil aktif
          </p>

          <h1 className="mt-4 text-3xl font-black text-white">
            Selamat datang di LayarBoxOffice VIP
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Pembayaran kamu sudah masuk. Sekarang semua preview terkunci sudah
            terbuka penuh dan kamu bisa lanjut nonton tanpa putus.
          </p>

          <div className="mt-5 rounded-[24px] border border-yellow-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.95),rgba(217,119,6,0.95))] p-5 text-neutral-950">
            <p className="text-sm font-semibold opacity-75">
              {order?.plan.title ?? "Paket VIP"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="opacity-70">Durasi</p>
                <p className="mt-1 text-lg font-bold">
                  {order ? `${order.plan.durationDays} hari` : "VIP aktif"}
                </p>
              </div>
              <div className="text-right">
                <p className="opacity-70">Pembayaran</p>
                <p className="mt-1 text-lg font-bold">
                  {order ? formatCurrency(order.amount, order.currency) : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="size-4 text-orange-300" />
              Masa aktif VIP
            </p>
            <p className="mt-3 text-2xl font-black text-white">
              {formatVipDate(vipStatus.expiresAt)}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Kalau bot aktif dan akun Telegram kamu tersambung, notifikasi
              aktivasi juga dikirim otomatis.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <Button
              asChild
              data-haptic="medium"
              className="h-12 w-full bg-red-600 text-white hover:bg-red-500"
            >
              <Link href="/" prefetch>
                Mulai nonton sekarang
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              data-haptic="light"
              className="h-12 w-full border border-white/10 bg-white/10 text-white hover:bg-white/15"
            >
              <Link href="/profile" prefetch>
                Buka profil VIP
              </Link>
            </Button>
            {order ? (
              <Button
                asChild
                variant="ghost"
                data-haptic="light"
                className="h-11 w-full text-neutral-300 hover:bg-white/5"
              >
                <Link href={`/vip/pay/${order.id}`} prefetch={false}>
                  Lihat detail pembayaran
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
