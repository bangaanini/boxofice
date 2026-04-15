"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  LoaderCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { CopyButton } from "@/components/vip/copy-button";
import { PaymentCountdown } from "@/components/vip/payment-countdown";
import { Button } from "@/components/ui/button";

type PaymentMetadata = {
  bank?: string | null;
  channelName?: string | null;
  channelType?: "qris" | "va" | null;
  expirationDate?: string | null;
  payUrl?: string | null;
  qrUrl?: string | null;
  referenceId?: string | null;
  vaNumber?: string | null;
};

type PaymentStatusSheetProps = {
  amountLabel: string;
  checkoutUrl: string | null;
  initialExpiresAt: string | null;
  initialMetadata: PaymentMetadata | null;
  initialStatus: string;
  orderId: string;
  planDurationLabel: string;
  planTitle: string;
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

export function PaymentStatusSheet({
  amountLabel,
  checkoutUrl,
  initialExpiresAt,
  initialMetadata,
  initialStatus,
  orderId,
  planDurationLabel,
  planTitle,
}: PaymentStatusSheetProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState(initialStatus);
  const [metadata, setMetadata] = React.useState<PaymentMetadata | null>(
    initialMetadata,
  );
  const [expiresAt, setExpiresAt] = React.useState<string | null>(
    initialExpiresAt ?? initialMetadata?.expirationDate ?? null,
  );
  const [checking, setChecking] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const isPaid = status === "paid";
  const isQris = metadata?.channelType === "qris";

  const checkStatus = React.useCallback(async () => {
    setChecking(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/vip/orders/${orderId}/status`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            order?: {
              expiresAt: string | null;
              metadata: PaymentMetadata | null;
              status: string;
            };
            status?: string;
          }
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Status belum bisa diperbarui.");
      }

      setStatus(payload.status ?? payload.order?.status ?? "pending");
      setMetadata(payload.order?.metadata ?? null);
      setExpiresAt(
        payload.order?.expiresAt ?? payload.order?.metadata?.expirationDate ?? null,
      );

      if ((payload.status ?? payload.order?.status) === "paid") {
        setMessage("Pembayaran sudah masuk. VIP kamu aktif.");
        window.setTimeout(() => {
          router.replace(
            `/vip?payment=paid&orderId=${encodeURIComponent(orderId)}&message=${encodeURIComponent("Pembayaran terkonfirmasi. VIP kamu sudah aktif.")}`,
          );
          router.refresh();
        }, 1200);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Status pembayaran belum bisa dicek sekarang.",
      );
    } finally {
      setChecking(false);
    }
  }, [orderId, router]);

  React.useEffect(() => {
    if (status !== "pending") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void checkStatus();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkStatus, status]);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-1 pb-24 pt-6">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.42),rgba(0,0,0,0.84))]" />
      <div className="relative z-10 w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,23,23,0.98),rgba(8,8,8,0.99))] p-5 shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
        <div className="rounded-[24px] border border-yellow-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.95),rgba(217,119,6,0.95))] p-5 text-neutral-950">
          <p className="text-sm font-semibold opacity-75">{planTitle}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="opacity-70">Durasi</p>
              <p className="mt-1 text-lg font-bold">{planDurationLabel}</p>
            </div>
            <div className="text-right">
              <p className="opacity-70">Harga</p>
              <p className="mt-1 text-3xl font-black">{amountLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center">
          <p className="text-sm text-neutral-400">Total pembayaran</p>
          <p className="mt-2 text-4xl font-black text-white">{amountLabel}</p>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/30 p-5">
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
                Scan dengan aplikasi QRIS mana pun.
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
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-2">
            <PaymentCountdown expiresAt={expiresAt} />
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
              Kedaluwarsa dalam
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            ID pesanan
          </p>
          <p className="mt-2 break-all text-sm text-white">
            {metadata?.referenceId ?? orderId}
          </p>
        </div>

        <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6">
          <p className="inline-flex items-center gap-2 font-semibold text-white">
            {isPaid ? (
              <CheckCircle2 className="size-4 text-emerald-300" />
            ) : (
              <ShieldCheck className="size-4 text-orange-300" />
            )}
            {formatStatus(status)}
          </p>
          <p className="mt-2 text-neutral-300">
            {message ??
              (isPaid
                ? "Pembayaran sudah masuk. Akses VIP aktif dan bisa langsung dipakai."
                : "Kalau sudah transfer atau scan QR, biarkan halaman ini terbuka. Status akan dicek otomatis." )}
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <Button
            type="button"
            onClick={() => void checkStatus()}
            disabled={checking}
            data-haptic="medium"
            className="h-12 w-full bg-sky-600 text-white hover:bg-sky-500"
          >
            {checking ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Mengecek pembayaran...
              </>
            ) : isPaid ? (
              "Refresh status VIP"
            ) : (
              <>
                <RefreshCw className="size-4" />
                Sudah bayar? Cek di sini
              </>
            )}
          </Button>

          {checkoutUrl ? (
            <Button
              asChild
              variant="secondary"
              data-haptic="light"
              className="h-12 w-full border border-white/10 bg-white/10 text-white hover:bg-white/15"
            >
              <a href={checkoutUrl}>Buka halaman Paymenku</a>
            </Button>
          ) : null}

          <Button
            asChild
            variant="ghost"
            data-haptic="light"
            className="h-11 w-full text-neutral-300 hover:bg-white/5"
          >
            <Link href="/vip" prefetch={false}>
              Kembali ke pilihan paket
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
