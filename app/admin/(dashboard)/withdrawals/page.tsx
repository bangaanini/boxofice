import { manageAffiliatePayoutRequest } from "@/app/admin/actions";
import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import { getAffiliatePayoutRequestsForAdmin } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

type AdminWithdrawalsPageProps = {
  searchParams: Promise<{
    message?: string;
    withdraw?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function statusTone(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20";
    case "approved":
      return "bg-sky-500/10 text-sky-200 ring-sky-400/20";
    case "rejected":
      return "bg-red-500/10 text-red-200 ring-red-400/20";
    default:
      return "bg-white/[0.06] text-neutral-300 ring-white/10";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Sudah dibayar";
    case "approved":
      return "Disetujui";
    case "rejected":
      return "Ditolak";
    default:
      return "Menunggu review";
  }
}

function methodLabel(method: string) {
  return method === "ewallet" ? "E-Wallet" : "Bank";
}

export default async function AdminWithdrawalsPage({
  searchParams,
}: AdminWithdrawalsPageProps) {
  const params = await searchParams;
  const requests = await getAffiliatePayoutRequestsForAdmin();
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const paidRequests = requests.filter((request) => request.status === "paid");
  const pendingAmount = pendingRequests.reduce(
    (sum, request) => sum + request.amount,
    0,
  );
  const paidAmount = paidRequests.reduce((sum, request) => sum + request.amount, 0);

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Withdraw affiliate
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Permintaan penarikan komisi
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Review semua permintaan pencairan komisi dari user affiliate. Saat
          request ditolak, saldo akan kembali ke user. Saat ditandai dibayar,
          saldo pindah ke histori withdrawn.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="Menunggu review" value={pendingRequests.length} />
          <AdminMetricCard label="Siap dibayar" value={approvedRequests.length} />
          <AdminMetricCard label="Nominal pending" value={formatCurrency(pendingAmount)} />
          <AdminMetricCard label="Sudah cair" value={formatCurrency(paidAmount)} />
        </div>
      </AdminSurface>

      {params.withdraw ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.withdraw === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Permintaan withdraw gagal diproses."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Permintaan withdraw berhasil diproses."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      <AdminSurface className="p-0">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-lg font-bold text-white">Daftar permintaan</p>
          <p className="mt-1 text-sm text-neutral-400">
            Total {requests.length} permintaan tercatat di database.
          </p>
        </div>

        <div className="space-y-0">
          {requests.length ? (
            requests.map((request) => (
              <div
                key={request.id}
                className="grid gap-5 border-t border-white/10 px-5 py-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-white">
                      {request.profile.user.name}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusTone(request.status)}`}
                    >
                      {statusLabel(request.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    {request.profile.user.telegramUsername
                      ? `@${request.profile.user.telegramUsername}`
                      : request.profile.user.telegramId
                        ? `Telegram ID ${request.profile.user.telegramId}`
                        : "User Telegram"}
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                        Detail penarikan
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {request.payoutProvider} • {methodLabel(request.payoutMethod)}
                      </p>
                      <p className="mt-1 text-sm text-neutral-400">
                        {request.recipientName}
                      </p>
                      <p className="mt-1 break-all text-sm text-neutral-300">
                        {request.accountNumber}
                      </p>
                    </div>

                    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                        Nominal
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {formatCurrency(request.amount)}
                      </p>
                      <p className="mt-2 text-sm text-neutral-400">
                        Kode affiliate {request.profile.referralCode}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Saldo tersedia user: {formatCurrency(request.profile.availableBalance)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Saldo pending user: {formatCurrency(request.profile.pendingBalance)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-neutral-400 md:grid-cols-3">
                    <p>Diajukan: {formatDate(request.createdAt)}</p>
                    <p>Diproses: {formatDate(request.processedAt)}</p>
                    <p>Update: {formatDate(request.updatedAt)}</p>
                  </div>

                  {request.note ? (
                    <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-neutral-300">
                      {request.note}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">
                    Tindakan admin
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-400">
                    Tambahkan catatan jika perlu, lalu pilih aksi yang sesuai.
                  </p>

                  <form action={manageAffiliatePayoutRequest} className="mt-4 space-y-3">
                    <input type="hidden" name="redirectTo" value="/admin/withdrawals" />
                    <input type="hidden" name="payoutId" value={request.id} />
                    <textarea
                      name="note"
                      rows={4}
                      placeholder="Catatan admin, nomor referensi transfer, atau alasan penolakan."
                      defaultValue={request.note ?? ""}
                      className="w-full rounded-[16px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500"
                    />

                    <div className="grid gap-2">
                      <Button
                        type="submit"
                        name="intent"
                        value="approve"
                        variant="secondary"
                        className="h-11 border border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
                      >
                        Setujui request
                      </Button>
                      <Button
                        type="submit"
                        name="intent"
                        value="paid"
                        className="h-11 bg-emerald-600 text-white hover:bg-emerald-500"
                      >
                        Tandai sudah dibayar
                      </Button>
                      <Button
                        type="submit"
                        name="intent"
                        value="reject"
                        variant="destructive"
                        className="h-11"
                      >
                        Tolak dan kembalikan saldo
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-14 text-center text-neutral-400">
              Belum ada permintaan penarikan komisi.
            </div>
          )}
        </div>
      </AdminSurface>
    </div>
  );
}
