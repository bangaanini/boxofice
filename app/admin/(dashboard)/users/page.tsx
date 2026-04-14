import { Search } from "lucide-react";

import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import { getAdminUserTableData } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : undefined;
  const {
    affiliateSchemaIssue,
    affiliateSchemaReady,
    defaultCommissionRate,
    totalUsers,
    users,
  } =
    await getAdminUserTableData(query);

  const referredUsers = users.filter((user) => user.affiliateReferral).length;
  const affiliateUsers = users.filter((user) => user.affiliateProfile).length;
  const totalReferralCommission = users.reduce(
    (sum, user) => sum + (user.affiliateProfile?.totalCommission ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      {!affiliateSchemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">Kolom affiliate fallback aktif</p>
          <p className="mt-2">
            {affiliateSchemaIssue ??
              "Database runtime belum memuat skema affiliate lengkap. Data referred by dan komisi ditampilkan terbatas sementara."}
          </p>
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Tabel user
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">Daftar user</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Monitor akun terdaftar, lihat siapa yang masuk lewat referral, dan
          pantau komisi affiliate langsung dari tabel yang sama.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="Total user" value={totalUsers} />
          <AdminMetricCard label="User affiliate" value={affiliateUsers} />
          <AdminMetricCard label="Direferensikan" value={referredUsers} />
          <AdminMetricCard
            label="Total komisi referral"
            value={formatCurrency(totalReferralCommission)}
          />
        </div>
      </AdminSurface>

      <AdminSurface className="p-0">
        <div className="border-b border-white/10 p-5">
          <form className="space-y-3">
            <label className="block">
              <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-neutral-300">
                <Search className="size-4" />
                Cari user
              </span>
              <div className="flex gap-2">
                <input
                  type="search"
                  name="q"
                  defaultValue={query ?? ""}
                  placeholder="Cari nama, email, atau kode affiliate..."
                  className="h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-white outline-none focus:border-orange-300"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="h-12 shrink-0 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                >
                  Cari
                </Button>
              </div>
            </label>
          </form>
          <p className="mt-3 text-sm text-neutral-400">
            Menampilkan {users.length} user. Default komisi affiliate saat ini{" "}
            <strong className="text-white">{defaultCommissionRate}%</strong>.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1160px] w-full text-left">
            <thead className="bg-white/[0.04] text-sm text-neutral-400">
              <tr>
                <th className="px-5 py-4 font-medium">User</th>
                <th className="px-5 py-4 font-medium">Referred by</th>
                <th className="px-5 py-4 font-medium">Rate komisi</th>
                <th className="px-5 py-4 font-medium">Komisi referral</th>
                <th className="px-5 py-4 font-medium">Saldo tersedia</th>
                <th className="px-5 py-4 font-medium">Favorit</th>
                <th className="px-5 py-4 font-medium">Riwayat</th>
                <th className="px-5 py-4 font-medium">Referral aktif</th>
                <th className="px-5 py-4 font-medium">Sesi</th>
                <th className="px-5 py-4 font-medium">Terdaftar</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((user) => {
                  const referredBy = user.affiliateReferral?.profile.user;
                  const referredCode =
                    user.affiliateReferral?.profile.referralCode ?? null;
                  const profile = user.affiliateProfile;

                  return (
                    <tr
                      key={user.id}
                      className="border-t border-white/10 align-top"
                    >
                      <td className="px-5 py-4">
                        <p className="text-base font-semibold text-white">
                          {user.name}
                        </p>
                        <p className="mt-1 text-sm text-neutral-400">
                          {user.email}
                        </p>
                        {profile?.referralCode ? (
                          <p className="mt-2 text-xs font-medium text-orange-200">
                            Kode {profile.referralCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm text-neutral-300">
                        {referredBy ? (
                          <>
                            <p className="font-medium text-white">
                              {referredBy.name}
                            </p>
                            <p className="mt-1 text-neutral-400">
                              {referredBy.email}
                            </p>
                            {referredCode ? (
                              <p className="mt-2 text-xs text-orange-200">
                                via {referredCode}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {profile?.commissionRate ?? defaultCommissionRate}%
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {formatCurrency(profile?.totalCommission ?? 0)}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {formatCurrency(profile?.availableBalance ?? 0)}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {user._count.favorites}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {user._count.watchHistory}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {profile?.activeReferrals ?? 0}
                      </td>
                      <td className="px-5 py-4 text-sm text-white">
                        {user._count.sessions}
                      </td>
                      <td className="px-5 py-4 text-sm text-neutral-300">
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-14 text-center text-neutral-400"
                  >
                    Tidak ada user yang cocok dengan pencarian ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSurface>
    </div>
  );
}
