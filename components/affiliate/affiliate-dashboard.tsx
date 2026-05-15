"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Gift,
  Megaphone,
  RefreshCw,
  Share2,
  Wallet,
} from "lucide-react";

import {
  requestAffiliatePayoutAction,
  type AffiliateActionState,
} from "@/app/affiliate/actions";
import { Button } from "@/components/ui/button";
import {
  isTelegramMiniAppBrowser,
  openTelegramShareComposer,
} from "@/lib/telegram-share-client";
import { cn } from "@/lib/utils";

type AffiliateActivityItem = {
  amountLabel?: string | null;
  createdAtLabel: string;
  description: string;
  id: string;
  title: string;
};

type AffiliatePayoutItem = {
  accountNumberMasked: string;
  amountLabel: string;
  createdAtLabel: string;
  id: string;
  note?: string | null;
  payoutMethodLabel: string;
  payoutProvider: string;
  recipientName: string;
  statusLabel: string;
};

type AffiliateDashboardProps = {
  activeReferrals: number;
  activities: AffiliateActivityItem[];
  availableBalance: number;
  availableBalanceLabel: string;
  canRequestPayout: boolean;
  clicks: number;
  minimumWithdrawLabel: string;
  payouts: AffiliatePayoutItem[];
  pendingBalanceLabel: string;
  referralCode: string;
  referralUrl: string;
  webReferralUrl?: string;
  signups: number;
  totalCommissionLabel: string;
  withdrawnBalanceLabel: string;
};

const initialActionState: AffiliateActionState = {};

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/55">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function PayoutModal({
  action,
  availableBalance,
  canRequestPayout,
  isPending,
  minimumWithdrawLabel,
  onClose,
}: {
  action: (formData: FormData) => void;
  availableBalance: number;
  canRequestPayout: boolean;
  isPending: boolean;
  minimumWithdrawLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 px-4 pb-6 pt-10 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,22,0.98),rgba(8,8,8,0.99))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-white">Ajukan penarikan</p>
            <p className="mt-1 text-sm leading-6 text-neutral-400">
              Isi tujuan pencairan. Admin akan melihat detail ini langsung di
              dashboard.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-3 text-neutral-300 hover:bg-white/10"
          >
            Tutup
          </Button>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-300">
              Metode pembayaran
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] px-4 py-3">
                <input
                  type="radio"
                  name="payoutMethod"
                  value="bank"
                  defaultChecked
                  className="size-4 accent-red-500"
                />
                <span className="text-sm font-medium text-white">Bank</span>
              </label>
              <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] px-4 py-3">
                <input
                  type="radio"
                  name="payoutMethod"
                  value="ewallet"
                  className="size-4 accent-red-500"
                />
                <span className="text-sm font-medium text-white">E-Wallet</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-300">
              Nama bank / e-wallet
            </label>
            <input
              name="payoutProvider"
              placeholder="Contoh: BCA, BNI, DANA, GoPay"
              className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-300">
              Nama penerima
            </label>
            <input
              name="recipientName"
              placeholder="Nama sesuai rekening / akun e-wallet"
              className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-300">
              Nomor rekening / nomor e-wallet
            </label>
            <input
              name="accountNumber"
              inputMode="numeric"
              placeholder="Masukkan nomor tujuan pencairan"
              className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-300">
              Jumlah penarikan
            </label>
            <input
              name="amount"
              type="number"
              min={0}
              defaultValue={availableBalance}
              className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none"
            />
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              Minimum penarikan {minimumWithdrawLabel}. Kamu bisa tarik sebagian
              selama saldo mencukupi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="h-12 border border-white/10 bg-white/[0.08] text-white hover:bg-white/[0.14]"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!canRequestPayout || isPending}
              className="h-12 bg-red-600 text-white hover:bg-red-500"
            >
              {isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Gift className="size-4" />
              )}
              Kirim
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AffiliateDashboard({
  activeReferrals,
  activities,
  availableBalance,
  availableBalanceLabel,
  canRequestPayout,
  clicks,
  minimumWithdrawLabel,
  payouts,
  pendingBalanceLabel,
  referralCode,
  referralUrl,
  webReferralUrl,
  signups,
  totalCommissionLabel,
  withdrawnBalanceLabel,
}: AffiliateDashboardProps) {
  const [actionState, payoutAction, isPayoutPending] = React.useActionState(
    requestAffiliatePayoutAction,
    initialActionState,
  );
  const [link, setLink] = React.useState(referralUrl);
  const [copied, setCopied] = React.useState(false);
  const [shareFeedback, setShareFeedback] = React.useState<string | null>(null);
  const [showPayoutModal, setShowPayoutModal] = React.useState(false);
  const [webLink, setWebLink] = React.useState(webReferralUrl ?? "");
  const [webCopied, setWebCopied] = React.useState(false);

  React.useEffect(() => {
    setLink(referralUrl);
  }, [referralUrl]);

  React.useEffect(() => {
    setWebLink(webReferralUrl ?? "");
  }, [webReferralUrl]);

  React.useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  React.useEffect(() => {
    if (!shareFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => setShareFeedback(null), 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shareFeedback]);

  React.useEffect(() => {
    if (actionState.success) {
      setShowPayoutModal(false);
    }
  }, [actionState.success]);

  React.useEffect(() => {
    if (!webCopied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setWebCopied(false), 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [webCopied]);

  async function copyWebLink() {
    if (!webLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(webLink);
      setWebCopied(true);
      setShareFeedback("Link affiliate web berhasil disalin.");
    } catch {
      setShareFeedback("Clipboard belum bisa dipakai di perangkat ini.");
    }
  }

  async function shareWebLink() {
    if (!webLink) {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          text: "Daftar Box Office dari link web ini.",
          title: "Box Office Affiliate",
          url: webLink,
        });
      } else {
        await navigator.clipboard.writeText(webLink);
        setWebCopied(true);
        setShareFeedback("Link affiliate web berhasil disalin.");
      }
    } catch {
      // user cancel
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setShareFeedback("Link affiliate berhasil disalin.");
    } catch {
      setShareFeedback("Clipboard belum bisa dipakai di perangkat ini.");
    }
  }

  async function shareLink() {
    try {
      if (isTelegramMiniAppBrowser()) {
        openTelegramShareComposer({
          text: "Buka Mini App Layar BoxOffice dari link Telegram ini.",
          url: link,
        });
      } else if (navigator.share) {
        await navigator.share({
          text: "Buka Mini App Layar BoxOffice dari link Telegram ini.",
          title: "Layar BoxOffice Affiliate",
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
      }

      setShareFeedback("Link affiliate siap dibagikan.");
    } catch {
      setShareFeedback("Bagikan link belum bisa dijalankan sekarang.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,#ff7a1a_0%,#f04d23_34%,#120b09_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/75">
                Referral Box Office
              </p>
              <h1 className="mt-2 text-3xl font-black leading-none text-white">
                {availableBalanceLabel}
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Saldo yang siap kamu arahkan ke penarikan berikutnya.
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-black/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">
              Kode {referralCode}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <StatChip label="Klik" value={String(clicks)} />
            <StatChip label="Signup" value={String(signups)} />
            <StatChip label="Aktif" value={String(activeReferrals)} />
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,24,0.94),rgba(8,8,8,0.96))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              Link referral Telegram
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-400">
              Arahkan orang langsung ke bot dan Mini App Box Office dari link
              ini.
            </p>
          </div>
          <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-200 ring-1 ring-red-400/10">
            Live
          </span>
        </div>

        <div className="mt-4 rounded-[18px] border border-white/10 bg-black/25 p-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">
            Deep link
          </p>
          <p className="mt-2 break-all text-sm leading-6 text-white">{link}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={copyLink}
            className="h-11 border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Tersalin" : "Salin"}
          </Button>
          <Button
            type="button"
            onClick={shareLink}
            className="h-11 bg-red-600 text-white hover:bg-red-500"
          >
            <Share2 className="size-4" />
            Bagikan
          </Button>
        </div>

        {shareFeedback ? (
          <p className="mt-3 text-sm text-neutral-300">{shareFeedback}</p>
        ) : null}
      </section>

      {webLink ? (
        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,24,0.94),rgba(8,8,8,0.96))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.4)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Link referral Web
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                Cocok untuk teman yang tidak pakai Telegram. Klik link ini akan
                bawa mereka ke halaman daftar web.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/15">
              Web
            </span>
          </div>

          <div className="mt-4 rounded-[18px] border border-white/10 bg-black/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">
              Web link
            </p>
            <p className="mt-2 break-all text-sm leading-6 text-white">
              {webLink}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={copyWebLink}
              className="h-11 border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]"
            >
              {webCopied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {webCopied ? "Tersalin" : "Salin"}
            </Button>
            <Button
              type="button"
              onClick={shareWebLink}
              className="h-11 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Share2 className="size-4" />
              Bagikan
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">
            Total komisi
          </p>
          <p className="mt-2 text-lg font-bold text-white">
            {totalCommissionLabel}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">
            Pending
          </p>
          <p className="mt-2 text-lg font-bold text-white">
            {pendingBalanceLabel}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">
            Sudah cair
          </p>
          <p className="mt-2 text-lg font-bold text-white">
            {withdrawnBalanceLabel}
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.9),rgba(8,8,8,0.96))] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-white">Tarik saldo</p>
            <p className="mt-1 text-sm leading-6 text-neutral-400">
              Minimum penarikan {minimumWithdrawLabel}. Saat diajukan, saldo akan
              dipindahkan ke status pending.
            </p>
          </div>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-neutral-300 ring-1 ring-white/10">
            <Wallet className="mr-1 inline size-3.5" />
            Withdraw
          </span>
        </div>

        <div className="mt-4 rounded-[18px] border border-white/10 bg-black/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">
            Siap ditarik
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {availableBalanceLabel}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowPayoutModal(true)}
          disabled={!canRequestPayout}
          className="mt-4 h-12 w-full bg-red-600 text-white hover:bg-red-500"
        >
          <Gift className="size-4" />
          {canRequestPayout ? "Ajukan penarikan" : "Saldo belum cukup"}
        </Button>

        {actionState.error ? (
          <p className="mt-3 rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">
            {actionState.error}
          </p>
        ) : null}
        {actionState.success ? (
          <p className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {actionState.success}
          </p>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.92),rgba(8,8,8,0.96))] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-bold text-white">Riwayat komisi dan penarikan</p>
            <p className="mt-1 text-sm text-neutral-400">
              Hanya komisi yang masuk dan proses penarikan yang ditampilkan di sini.
            </p>
          </div>
          <Megaphone className="size-5 text-neutral-500" />
        </div>

        <div className="mt-4 space-y-3">
          {activities.length ? (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {activity.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">
                      {activity.description}
                    </p>
                  </div>
                  {activity.amountLabel ? (
                    <span className="text-sm font-semibold text-emerald-300">
                      {activity.amountLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  {activity.createdAtLabel}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-sm font-semibold text-white">
                Belum ada aktivitas
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Komisi yang berhasil masuk dan proses penarikan akan muncul di sini.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.92),rgba(8,8,8,0.96))] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-bold text-white">Riwayat penarikan</p>
            <p className="mt-1 text-sm text-neutral-400">
              Semua pengajuan komisi yang pernah kamu kirim.
            </p>
          </div>
          <ArrowUpRight className="size-5 text-neutral-500" />
        </div>

        <div className="mt-4 space-y-3">
          {payouts.length ? (
            payouts.map((payout) => (
              <div
                key={payout.id}
                className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {payout.payoutProvider} • {payout.payoutMethodLabel}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">
                      {payout.recipientName} • {payout.accountNumberMasked}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                      payout.statusLabel === "Dibayar"
                        ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                        : payout.statusLabel === "Ditolak"
                          ? "bg-red-500/10 text-red-200 ring-red-400/20"
                          : payout.statusLabel === "Disetujui"
                            ? "bg-sky-500/10 text-sky-200 ring-sky-400/20"
                            : "bg-white/[0.06] text-neutral-300 ring-white/10",
                    )}
                  >
                    {payout.statusLabel}
                  </span>
                </div>
                <p className="mt-3 text-lg font-bold text-white">
                  {payout.amountLabel}
                </p>
                {payout.note ? (
                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    {payout.note}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-neutral-500">
                  {payout.createdAtLabel}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-sm font-semibold text-white">
                Belum ada permintaan penarikan
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Saat saldo cukup, kirim permintaan dan statusnya akan muncul di sini.
              </p>
            </div>
          )}
        </div>
      </section>

      {showPayoutModal ? (
        <PayoutModal
          action={payoutAction}
          availableBalance={availableBalance}
          canRequestPayout={canRequestPayout}
          isPending={isPayoutPending}
          minimumWithdrawLabel={minimumWithdrawLabel}
          onClose={() => setShowPayoutModal(false)}
        />
      ) : null}
    </div>
  );
}
