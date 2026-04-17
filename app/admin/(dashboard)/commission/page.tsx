import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { updateAffiliateProgramSettings } from "@/app/admin/actions";
import {
  getAffiliateProfileCountSafe,
  getAffiliateProgramSettingsSafe,
} from "@/lib/affiliate";

export const dynamic = "force-dynamic";

type AdminCommissionPageProps = {
  searchParams: Promise<{
    applyToExisting?: string;
    message?: string;
    rate?: string;
    settings?: string;
  }>;
};

export default async function AdminCommissionPage({
  searchParams,
}: AdminCommissionPageProps) {
  const params = await searchParams;
  const [affiliateSettingsResult, profilesResult] = await Promise.all([
    getAffiliateProgramSettingsSafe(),
    getAffiliateProfileCountSafe(),
  ]);
  const affiliateSettings = affiliateSettingsResult.settings;
  const affiliateSchemaReady =
    affiliateSettingsResult.schemaReady && profilesResult.schemaReady;
  const affiliateSchemaIssue =
    affiliateSettingsResult.schemaIssue ?? profilesResult.schemaIssue;

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Affiliate
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Presentase komisi
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Pisahkan pengaturan komisi dari bot supaya admin lebih mudah
          mengelola referral dan perubahan rate global.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <AdminMetricCard
            label="Schema affiliate"
            value={affiliateSchemaReady ? "Aktif" : "Fallback"}
          />
          <AdminMetricCard
            label="Profil affiliate"
            value={profilesResult.count}
          />
          <AdminMetricCard
            label="Rate default"
            value={`${affiliateSettings.defaultCommissionRate}%`}
          />
        </div>
      </AdminSurface>

      {params.settings ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.settings === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Setting affiliate gagal diperbarui."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Setting affiliate berhasil diperbarui."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      {!affiliateSchemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">Affiliate settings fallback aktif</p>
          <p className="mt-2">
            {affiliateSchemaIssue ??
              "Database runtime belum siap untuk setting affiliate."}
          </p>
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">
          Komisi default
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Atur rate referral global
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
          Perubahan ini bisa dipakai sebagai default untuk user affiliate baru,
          atau sekaligus diterapkan ke semua profil yang sudah ada.
        </p>

        {affiliateSchemaReady ? (
          <form
            action={updateAffiliateProgramSettings}
            className="mt-6 max-w-2xl space-y-5"
          >
            <input type="hidden" name="redirectTo" value="/admin/commission" />

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Presentase komisi default
              </label>
              <div className="mt-2 flex items-center rounded-[18px] border border-white/10 bg-black/25 px-4">
                <input
                  name="defaultCommissionRate"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={affiliateSettings.defaultCommissionRate}
                  className="h-12 w-full bg-transparent text-base text-white outline-none"
                />
                <span className="text-sm font-semibold text-neutral-400">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Konten cara kerja affiliate
              </label>
              <textarea
                name="howItWorksContent"
                rows={10}
                defaultValue={affiliateSettings.howItWorksContent}
                className="mt-2 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-500"
              />
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Tulis per blok. Baris pertama jadi judul, baris berikutnya jadi
                isi. Pisahkan tiap blok dengan satu baris kosong.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Konten aturan affiliate
              </label>
              <textarea
                name="rulesContent"
                rows={12}
                defaultValue={affiliateSettings.rulesContent}
                className="mt-2 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-500"
              />
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Formatnya sama: baris pertama pertanyaan, baris berikutnya
                jawaban, lalu kosongkan satu baris untuk item berikutnya.
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
                  Cocok dipakai saat kamu ingin menyamakan rate global tanpa edit
                  user satu per satu.
                </span>
              </span>
            </label>

            <PendingSubmitButton
              pendingLabel="Menyimpan..."
              className="h-11 bg-red-600 text-white hover:bg-red-500"
            >
              Simpan presentase
            </PendingSubmitButton>
          </form>
        ) : null}
      </AdminSurface>
    </div>
  );
}
