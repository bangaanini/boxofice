import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import { updateVipProgramSettings } from "@/app/admin/actions";
import { getVipProgramSettingsSafe } from "@/lib/vip";

export const dynamic = "force-dynamic";

type AdminVipPageProps = {
  searchParams: Promise<{
    message?: string;
    vip?: string;
  }>;
};

function Field({
  defaultValue,
  label,
  name,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  type?: "text" | "url";
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
      />
    </div>
  );
}

export default async function AdminVipPage({
  searchParams,
}: AdminVipPageProps) {
  const params = await searchParams;
  const vipSettingsResult = await getVipProgramSettingsSafe();
  const vipSettings = vipSettingsResult.settings;

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          VIP
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">Pengaturan VIP</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Kelola preview gratis, batas waktu tonton user non-VIP, dan copy
          paywall tanpa tercampur dengan pengaturan bot.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <AdminMetricCard
            label="Schema VIP"
            value={vipSettingsResult.schemaReady ? "Aktif" : "Fallback"}
          />
          <AdminMetricCard
            label="Preview"
            value={vipSettings.previewEnabled ? "Aktif" : "Nonaktif"}
          />
          <AdminMetricCard
            label="Batas preview"
            value={`${vipSettings.previewLimitMinutes} menit`}
          />
        </div>
      </AdminSurface>

      {params.vip ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.vip === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Pengaturan VIP gagal diperbarui."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Pengaturan VIP berhasil diperbarui."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      {!vipSettingsResult.schemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">VIP settings fallback aktif</p>
          <p className="mt-2">
            {vipSettingsResult.schemaIssue ??
              "Database runtime belum siap untuk setting VIP."}
          </p>
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">Preview dan paywall</p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Atur batas tonton gratis
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
          Setelah limit habis, player akan pause otomatis lalu menampilkan CTA
          upgrade ke VIP.
        </p>

        {vipSettingsResult.schemaReady ? (
          <form action={updateVipProgramSettings} className="mt-6 max-w-3xl space-y-5">
            <input type="hidden" name="redirectTo" value="/admin/vip" />

            <label className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/20 p-4">
              <input
                name="previewEnabled"
                type="checkbox"
                defaultChecked={vipSettings.previewEnabled}
                className="mt-1 size-4 rounded border-white/20 bg-black"
              />
              <span>
                <span className="block text-sm font-semibold text-white">
                  Aktifkan preview gratis untuk user non-VIP
                </span>
                <span className="mt-1 block text-sm leading-6 text-neutral-400">
                  Kalau dimatikan, user free tidak mendapat preview otomatis.
                </span>
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Batas preview
              </label>
              <div className="mt-2 flex items-center rounded-[18px] border border-white/10 bg-black/25 px-4">
                <input
                  name="previewLimitMinutes"
                  type="number"
                  min={1}
                  max={120}
                  defaultValue={vipSettings.previewLimitMinutes}
                  className="h-12 w-full bg-transparent text-base text-white outline-none"
                />
                <span className="text-sm font-semibold text-neutral-400">
                  menit
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                defaultValue={vipSettings.joinVipLabel}
                label="Label tombol VIP"
                name="joinVipLabel"
              />
              <Field
                defaultValue={vipSettings.joinVipUrl}
                label="URL tombol VIP"
                name="joinVipUrl"
                type="url"
              />
              <Field
                defaultValue={vipSettings.paywallTitle}
                label="Judul paywall"
                name="paywallTitle"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Deskripsi paywall
              </label>
              <textarea
                name="paywallDescription"
                defaultValue={vipSettings.paywallDescription}
                rows={4}
                className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-500"
              />
            </div>

            <Button
              type="submit"
              className="h-11 bg-red-600 text-white hover:bg-red-500"
            >
              Simpan pengaturan VIP
            </Button>
          </form>
        ) : null}
      </AdminSurface>
    </div>
  );
}
