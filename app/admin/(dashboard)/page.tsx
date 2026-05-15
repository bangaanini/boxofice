import Link from "next/link";
import { ArrowRight, Landmark, Percent, RefreshCw, Users } from "lucide-react";

import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { getAdminOverviewData } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const overview = await getAdminOverviewData();

  return (
    <div className="space-y-6">
      {!overview.affiliateSchemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">Affiliate perlu migration</p>
          <p className="mt-2">
            {overview.affiliateSchemaIssue ??
              "Database runtime belum memiliki tabel affiliate terbaru. Panel admin tetap dibuka dengan fallback sementara."}
          </p>
        </AdminSurface>
      ) : null}

      {!overview.paymentSchemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">Payment module fallback aktif</p>
          <p className="mt-2">
            {overview.paymentSchemaIssue ??
              "Database runtime belum siap penuh untuk modul payment terbaru."}
          </p>
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Dashboard utama
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">Admin panel</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-400">
          Pantau katalog film, user, dan sistem affiliate dari satu tempat.
          Bagian sync, tabel user, dan setting presentase sekarang dipisah biar
          lebih rapi.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="Total film" value={overview.totalMovies} />
          <AdminMetricCard label="Total user" value={overview.totalUsers} />
          <AdminMetricCard
            label="Akun affiliate"
            value={overview.totalAffiliateProfiles}
          />
          <AdminMetricCard
            label="Komisi default"
            value={`${overview.defaultCommissionRate}%`}
          />
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-4">
        <AdminSurface>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-200">
                Katalog film
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">Sync feed</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Jalankan sync per endpoint dan lihat laporan hasilnya tanpa
                bercampur dengan menu admin lain.
              </p>
            </div>
            <RefreshCw className="size-5 text-neutral-500" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <AdminMetricCard label="Movie" value={overview.movieCount} />
            <AdminMetricCard label="Series" value={overview.seriesCount} />
            <AdminMetricCard label="Hero" value={overview.inHeroCount} />
          </div>

          <Link
            href="/admin/sync"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            Buka menu sync
            <ArrowRight className="size-4" />
          </Link>
        </AdminSurface>

        <AdminSurface>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-200">User</p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Tabel user
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Lihat data akun, siapa yang direferensikan, komisi affiliate,
                jumlah favorit, dan aktivitas sesi.
              </p>
            </div>
            <Users className="size-5 text-neutral-500" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AdminMetricCard label="Favorit tersimpan" value={overview.totalFavorites} />
            <AdminMetricCard label="Riwayat tontonan" value={overview.totalHistory} />
          </div>

          <Link
            href="/admin/users"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            Buka tabel user
            <ArrowRight className="size-4" />
          </Link>
        </AdminSurface>

        <AdminSurface>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-200">Affiliate</p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Setting presentase
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Atur presentase komisi default untuk user affiliate baru, dan
                jika perlu terapkan ke profil yang sudah ada.
              </p>
            </div>
            <Percent className="size-5 text-neutral-500" />
          </div>

          <div className="mt-5">
            <AdminMetricCard
              label="Presentase saat ini"
              value={`${overview.defaultCommissionRate}%`}
            />
          </div>

          <Link
            href="/admin/commission"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            Buka pengaturan komisi
            <ArrowRight className="size-4" />
          </Link>
        </AdminSurface>

        <AdminSurface>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-200">Payment</p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Gateway VIP
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Atur checkout Paymenku, paket VIP yang dijual, dan pantau order
                QRIS maupun bank VA yang masuk dari Mini App.
              </p>
            </div>
            <Landmark className="size-5 text-neutral-500" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AdminMetricCard
              label="Gateway"
              value={overview.paymentGatewayEnabled ? "Aktif" : "Belum aktif"}
            />
            <AdminMetricCard
              label="Paket aktif"
              value={overview.activeVipPlans}
            />
          </div>

          <Link
            href="/admin/payments"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            Buka payment gateway
            <ArrowRight className="size-4" />
          </Link>
        </AdminSurface>
      </div>
    </div>
  );
}
