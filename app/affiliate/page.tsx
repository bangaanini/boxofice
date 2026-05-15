import { ArrowRight, ChevronRight } from "lucide-react";

import { AffiliateAccordionList } from "@/components/affiliate/affiliate-accordion-list";
import { AffiliateDashboard } from "@/components/affiliate/affiliate-dashboard";
import {
  getAffiliateDashboard,
  getAffiliateHowItWorksItems,
  getAffiliateProgramSettingsSafe,
  getAffiliateRuleItems,
  getAffiliateSharePath,
  getAffiliateWebSharePath,
} from "@/lib/affiliate";
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

export default async function AffiliatePage() {
  const user = await requireUserSession();
  const [profile, affiliateSettingsResult] = await Promise.all([
    getAffiliateDashboard(user),
    getAffiliateProgramSettingsSafe(),
  ]);
  const hasPendingPayout = profile.payoutRequests.some(
    (request) => request.status === "pending",
  );
  const howItWorksItems = getAffiliateHowItWorksItems(
    affiliateSettingsResult.settings.howItWorksContent,
  );
  const ruleItems = getAffiliateRuleItems(
    affiliateSettingsResult.settings.rulesContent,
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
          referralUrl={await getAffiliateSharePath(profile.referralCode, user.id)}
          webReferralUrl={getAffiliateWebSharePath(profile.referralCode)}
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

          <AffiliateAccordionList
            items={howItWorksItems.map((item) => ({
              answer: item.description,
              question: item.title,
            }))}
          />
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

          <AffiliateAccordionList items={ruleItems} />
        </section>
      </section>
    </main>
  );
}
