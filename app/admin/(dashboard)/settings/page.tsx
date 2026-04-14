import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import {
  getAffiliateProfileCountSafe,
  getAffiliateProgramSettingsSafe,
} from "@/lib/affiliate";
import { updateAffiliateProgramSettings } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type AdminSettingsPageProps = {
  searchParams: Promise<{
    applyToExisting?: string;
    message?: string;
    rate?: string;
    settings?: string;
  }>;
};

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  const params = await searchParams;
  const [settingsResult, profilesResult] = await Promise.all([
    getAffiliateProgramSettingsSafe(),
    getAffiliateProfileCountSafe(),
  ]);
  const settings = settingsResult.settings;
  const totalProfiles = profilesResult.count;
  const schemaReady =
    settingsResult.schemaReady && profilesResult.schemaReady;
  const schemaIssue =
    settingsResult.schemaIssue ?? profilesResult.schemaIssue;

  return (
    <div className="space-y-6">
      {!schemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">Settings belum aktif penuh</p>
          <p className="mt-2">
            {schemaIssue ??
              "Database runtime belum memiliki tabel affiliate settings terbaru. Form disembunyikan sementara agar admin tidak menemui error."}
          </p>
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Setting presentase
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Pengaturan komisi
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Atur presentase komisi affiliate default. Presentase ini akan dipakai
          untuk affiliate profile baru, dan bisa diterapkan ke semua profil lama
          jika kamu aktifkan opsi sinkronisasi.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminMetricCard
            label="Presentase default"
            value={`${settings.defaultCommissionRate}%`}
          />
          <AdminMetricCard label="Profil affiliate" value={totalProfiles} />
          <AdminMetricCard
            label="Apply terakhir"
            value={params.applyToExisting === "1" ? "Semua profil" : "Hanya default"}
          />
        </div>
      </AdminSurface>

      {params.settings ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.settings === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Setting gagal diperbarui."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Setting berhasil diperbarui."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      {schemaReady ? (
        <AdminSurface>
          <p className="text-sm font-semibold text-orange-200">
            Default affiliate
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Ubah presentase komisi
          </h2>
          <form
            action={updateAffiliateProgramSettings}
            className="mt-5 space-y-5"
          >
            <input type="hidden" name="redirectTo" value="/admin/settings" />
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-neutral-300">
                Presentase komisi default
              </label>
              <div className="mt-2 flex items-center rounded-[18px] border border-white/10 bg-black/25 px-4">
                <input
                  name="defaultCommissionRate"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={settings.defaultCommissionRate}
                  className="h-12 w-full bg-transparent text-base text-white outline-none"
                />
                <span className="text-sm font-semibold text-neutral-400">
                  %
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                Nilai ini akan dipakai sebagai rate komisi default untuk
                affiliate.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/20 p-4">
              <input
                name="applyToExisting"
                type="checkbox"
                className="mt-1 size-4 rounded border-white/20 bg-black"
              />
              <span>
                <span className="block text-sm font-semibold text-white">
                  Terapkan juga ke semua profil affiliate yang sudah ada
                </span>
                <span className="mt-1 block text-sm leading-6 text-neutral-400">
                  Cocok dipakai saat kamu ingin mengubah rate global seluruh
                  user affiliate tanpa edit satu per satu.
                </span>
              </span>
            </label>

            <Button
              type="submit"
              className="h-11 bg-red-600 text-white hover:bg-red-500"
            >
              Simpan presentase
            </Button>
          </form>
        </AdminSurface>
      ) : null}
    </div>
  );
}
