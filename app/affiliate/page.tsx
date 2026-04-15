import {
  ArrowRight,
  ChevronRight,
  CircleDollarSign,
  MousePointerClick,
  UserPlus,
  Wallet,
} from "lucide-react";

import { AffiliateDashboard } from "@/components/affiliate/affiliate-dashboard";
import { getAffiliateDashboard, getAffiliateSharePath } from "@/lib/affiliate";
import { requireUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatActivityDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(value);
}

function payoutStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Dibayar";
    case "approved":
      return "Disetujui";
    case "rejected":
      return "Ditolak";
    default:
      return "Pending";
  }
}

function payoutMethodLabel(method: string) {
  return method === "ewallet" ? "E-Wallet" : "Bank";
}

function maskAccountNumber(value: string) {
  const trimmed = value.trim();

  if (trimmed.length <= 4) {
    return trimmed;
  }

  return `${"*".repeat(Math.max(trimmed.length - 4, 0))}${trimmed.slice(-4)}`;
}

const affiliateSteps = [
  {
    description:
      "Sebarkan deep link Telegram kamu ke grup, channel, WhatsApp, TikTok bio, atau story.",
    icon: MousePointerClick,
    title: "Bagikan link",
  },
  {
    description:
      "User baru masuk lewat bot kamu lalu langsung membuka Mini App dengan akun Telegram mereka.",
    icon: UserPlus,
    title: "Teman mendaftar",
  },
  {
    description:
      "Saat referral berlangganan dan pembayaran sukses, komisi dihitung otomatis.",
    icon: CircleDollarSign,
    title: "Komisi masuk",
  },
  {
    description:
      "Saldo yang sudah memenuhi minimum withdrawal bisa langsung diajukan ke admin.",
    icon: Wallet,
    title: "Tarik saldo",
  },
] as const;

const affiliateRules = [
  {
    answer:
      "Referral aktif dihitung dari user referral yang sudah pernah sukses membeli paket minimal satu kali.",
    question: "Kapan referral dihitung aktif?",
  },
  {
    answer:
      "Komisi dihitung dari transaksi VIP yang sudah sukses dibayar oleh user referral.",
    question: "Bagaimana komisi dihitung?",
  },
  {
    answer:
      "Saldo bisa diajukan setelah mencapai minimum Rp 50.000. Pencairan komisi hanya bisa diajukan jika saldo tersedia sudah mencapai minimum penarikan.",
    question: "Kapan saldo bisa ditarik?",
  },
  {
    answer:
      "Mulai dari platform yang sudah kamu kuasai, fokus ke short video, potongan adegan menarik, lalu arahkan audiens ke link affiliate kamu dengan CTA yang konsisten.",
    question: "Kalau butuh strategi promosi, mulai dari mana?",
  },
] as const;

export default async function AffiliatePage() {
  const user = await requireUserSession();
  const profile = await getAffiliateDashboard(user);
  const hasPendingPayout = profile.payoutRequests.some(
    (request) => request.status === "pending",
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,114,34,0.18),transparent_28%),radial-gradient(circle_at_50%_18%,rgba(220,38,38,0.16),transparent_34%),linear-gradient(180deg,#130c0a_0%,#070707_54%,#020202_100%)]" />

      <section className="relative z-10 mx-auto w-full max-w-md space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-300">
              Affiliate
            </p>
            <h1 className="mt-1 text-3xl font-black text-white">
              Box Office Partner
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Bagikan bot App Box Office, pantau hasilnya, lalu tarik
              komisinya.
            </p>
          </div>
        </div>

        <AffiliateDashboard
          activeReferrals={profile.activeReferrals}
          activities={profile.activities.map((activity) => ({
            amountLabel:
              typeof activity.amount === "number"
                ? formatCurrency(activity.amount)
                : null,
            createdAtLabel: formatActivityDate(activity.createdAt),
            description: activity.description ?? "Aktivitas affiliate tercatat.",
            id: activity.id,
            title: activity.title,
          }))}
          availableBalance={profile.availableBalance}
          availableBalanceLabel={formatCurrency(profile.availableBalance)}
          canRequestPayout={
            profile.availableBalance >= profile.minimumWithdraw && !hasPendingPayout
          }
          clicks={profile.totalClicks}
          minimumWithdrawLabel={formatCurrency(profile.minimumWithdraw)}
          payouts={profile.payoutRequests.map((request) => ({
            accountNumberMasked: maskAccountNumber(request.accountNumber),
            amountLabel: formatCurrency(request.amount),
            createdAtLabel: formatActivityDate(request.createdAt),
            id: request.id,
            note: request.note,
            payoutMethodLabel: payoutMethodLabel(request.payoutMethod),
            payoutProvider: request.payoutProvider,
            recipientName: request.recipientName,
            statusLabel: payoutStatusLabel(request.status),
          }))}
          pendingBalanceLabel={formatCurrency(profile.pendingBalance)}
          referralCode={profile.referralCode}
          referralUrl={await getAffiliateSharePath(profile.referralCode)}
          signups={profile.totalSignups}
          totalCommissionLabel={formatCurrency(profile.totalCommission)}
          withdrawnBalanceLabel={formatCurrency(profile.withdrawnBalance)}
        />

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-white">Cara kerja</p>
            </div>
            <ArrowRight className="size-5 text-neutral-500" />
          </div>

          <div className="mt-4 space-y-3">
            {affiliateSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-[18px] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ffae4c,#ff6a1a)] text-sm font-bold text-white shadow-[0_10px_24px_rgba(255,122,26,0.28)]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Icon className="size-4 text-orange-300" />
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-white">Aturan</p>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                Ringkas, jelas, dan langsung bisa dipakai saat kamu mulai
                promosi.
              </p>
            </div>
            <ChevronRight className="size-5 text-neutral-500" />
          </div>

          <div className="mt-4 space-y-3">
            {affiliateRules.map((rule) => (
              <div
                key={rule.question}
                className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-sm font-semibold text-white">
                  {rule.question}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  {rule.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
