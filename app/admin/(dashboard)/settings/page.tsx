import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import { updateTelegramBotSettings } from "@/app/admin/actions";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";

export const dynamic = "force-dynamic";

type AdminSettingsPageProps = {
  searchParams: Promise<{
    bot?: string;
    message?: string;
  }>;
};

function PreviewButton({
  label,
}: {
  label: string;
}) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-[#253140] px-4 py-3 text-center text-sm font-semibold text-white">
      {label}
    </div>
  );
}

function Field({
  defaultValue,
  label,
  name,
  placeholder,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder?: string;
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
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-neutral-500"
      />
    </div>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  const params = await searchParams;
  const telegramSettingsResult = await getTelegramBotSettingsSafe();
  const telegramSettings = telegramSettingsResult.settings;
  const telegramRuntime = telegramSettingsResult.runtime;
  const webhookUrl = `${telegramRuntime.publicAppUrl}/api/telegram/webhook`;
  const setWebhookCommand = `curl -X POST "https://api.telegram.org/bot${telegramRuntime.botToken}/setWebhook" \\\n  -d "url=${webhookUrl}" \\\n  -d "secret_token=${telegramRuntime.webhookSecret}"`;
  const deleteWebhookCommand = `curl "https://api.telegram.org/bot${telegramRuntime.botToken}/deleteWebhook"`;

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Telegram bot
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Bot, webhook, dan Mini App
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Semua setting bot dibaca dari database lebih dulu. Kalau ada field yang
          dikosongkan, sistem otomatis memakai env server sebagai fallback.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            label="Schema bot"
            value={telegramSettingsResult.schemaReady ? "Aktif" : "Fallback"}
          />
          <AdminMetricCard
            label="Bot username"
            value={`@${telegramRuntime.botUsername}`}
          />
          <AdminMetricCard
            label="Secret aktif"
            value={telegramSettings.webhookSecret ? "Database" : "Env"}
          />
          <AdminMetricCard
            label="Main App URL"
            value={telegramRuntime.publicAppUrl.replace(/^https?:\/\//, "")}
          />
        </div>
      </AdminSurface>

      {params.bot ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.bot === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Pengaturan bot gagal diperbarui."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Pengaturan bot berhasil diperbarui."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      {!telegramSettingsResult.schemaReady ? (
        <AdminSurface className="text-sm leading-6 text-amber-100">
          <p className="font-semibold text-white">Bot settings belum aktif penuh</p>
          <p className="mt-2">
            {telegramSettingsResult.schemaIssue ??
              "Database runtime belum memiliki tabel Telegram bot settings terbaru."}
          </p>
        </AdminSurface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <AdminSurface>
          <p className="text-sm font-semibold text-orange-200">
            Data bot utama
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Konfigurasi dasar yang dipakai webhook
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            Kosongkan field kalau kamu ingin tetap memakai env server. Isi jika
            ingin mengubah bot langsung dari dashboard admin.
          </p>

          <form action={updateTelegramBotSettings} className="mt-6 space-y-6">
            <input type="hidden" name="redirectTo" value="/admin/settings" />

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                defaultValue={telegramSettings.botToken ?? ""}
                label="Bot token"
                name="botToken"
                placeholder="Kosongkan untuk pakai env"
              />
              <Field
                defaultValue={telegramSettings.webhookSecret ?? ""}
                label="Webhook secret"
                name="webhookSecret"
                placeholder="Kosongkan untuk pakai env"
              />
              <Field
                defaultValue={telegramSettings.botUsername ?? ""}
                label="Bot username"
                name="botUsername"
                placeholder="Mis. BoxOficebot"
              />
              <Field
                defaultValue={telegramSettings.publicAppUrl ?? ""}
                label="Public App URL"
                name="publicAppUrl"
                placeholder="https://boxofice.vercel.app"
                type="url"
              />
              <Field
                defaultValue={telegramSettings.miniAppShortName ?? ""}
                label="Mini App shortname"
                name="miniAppShortName"
                placeholder="Opsional"
              />
            </div>

            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
              <p className="font-semibold text-white">Nilai aktif saat ini</p>
              <div className="mt-3 grid gap-2">
                <p>
                  Bot aktif: <span className="text-white">@{telegramRuntime.botUsername}</span>
                </p>
                <p>
                  Main App URL: <span className="text-white">{telegramRuntime.publicAppUrl}</span>
                </p>
                <p>
                  Webhook URL: <span className="text-white">{webhookUrl}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Pesan sambutan bot
              </label>
              <textarea
                name="welcomeMessage"
                defaultValue={telegramSettings.welcomeMessage}
                rows={12}
                className="mt-2 w-full rounded-[20px] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-500"
              />
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Pakai placeholder <code className="rounded bg-black/30 px-1.5 py-0.5 text-neutral-200">{`{first_name}`}</code> atau{" "}
                <code className="rounded bg-black/30 px-1.5 py-0.5 text-neutral-200">{`{username}`}</code>.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field defaultValue={telegramSettings.openAppLabel} label="Tombol buka" name="openAppLabel" />
              <Field defaultValue={telegramSettings.openAppUrl} label="URL tombol buka" name="openAppUrl" type="url" />
              <Field defaultValue={telegramSettings.searchLabel} label="Tombol cari judul" name="searchLabel" />
              <Field defaultValue={telegramSettings.searchUrl} label="URL tombol cari" name="searchUrl" type="url" />
              <Field defaultValue={telegramSettings.affiliateLabel} label="Tombol affiliate" name="affiliateLabel" />
              <Field defaultValue={telegramSettings.affiliateUrl} label="URL tombol affiliate" name="affiliateUrl" type="url" />
              <Field defaultValue={telegramSettings.affiliateGroupLabel} label="Channel / grup affiliate" name="affiliateGroupLabel" />
              <Field defaultValue={telegramSettings.affiliateGroupUrl} label="URL grup affiliate" name="affiliateGroupUrl" type="url" />
              <Field defaultValue={telegramSettings.channelLabel} label="Channel film" name="channelLabel" />
              <Field defaultValue={telegramSettings.channelUrl} label="URL channel film" name="channelUrl" type="url" />
              <Field defaultValue={telegramSettings.supportLabel} label="Support admin" name="supportLabel" />
              <Field defaultValue={telegramSettings.supportUrl} label="URL support admin" name="supportUrl" type="url" />
              <Field defaultValue={telegramSettings.vipLabel} label="Tombol VIP" name="vipLabel" />
              <Field defaultValue={telegramSettings.vipUrl} label="URL tombol VIP" name="vipUrl" type="url" />
            </div>

            <Button
              type="submit"
              className="h-11 bg-red-600 text-white hover:bg-red-500"
            >
              Simpan pengaturan Telegram
            </Button>
          </form>
        </AdminSurface>

        <div className="space-y-6">
          <AdminSurface>
            <p className="text-sm font-semibold text-orange-200">
              Preview bot
            </p>
            <div className="mt-4 space-y-3 rounded-[24px] border border-white/10 bg-[#1f2c3a] p-4">
              <div className="rounded-[18px] bg-[#2c3947] p-4 text-sm leading-7 text-white">
                {telegramSettings.welcomeMessage
                  .replace(/\{first_name\}/gi, "Aan Hendri")
                  .replace(/\{username\}/gi, "@aanhendri")}
              </div>
              <PreviewButton label={telegramSettings.openAppLabel} />
              <PreviewButton label={telegramSettings.searchLabel} />
              <PreviewButton label={telegramSettings.affiliateLabel} />
              <div className="grid grid-cols-2 gap-2">
                <PreviewButton label={telegramSettings.affiliateGroupLabel} />
                <PreviewButton label={telegramSettings.channelLabel} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PreviewButton label={telegramSettings.supportLabel} />
                <PreviewButton label={telegramSettings.vipLabel} />
              </div>
            </div>
          </AdminSurface>

          <AdminSurface>
            <p className="text-sm font-semibold text-orange-200">
              Petunjuk penggunaan
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-300">
              <li>Isi data bot sesuai kebutuhan. Kosongkan jika ingin pakai env server.</li>
              <li>Klik simpan pengaturan Telegram.</li>
              <li>Salin command set webhook di bawah.</li>
              <li>Jalankan command di terminal atau server.</li>
              <li>Test bot dengan kirim <span className="rounded bg-black/30 px-1.5 py-0.5 text-white">/start</span>.</li>
              <li>Kalau bot masih menampilkan pesan lama, jalankan hapus webhook lalu pasang ulang.</li>
            </ol>
          </AdminSurface>

          <AdminSurface>
            <p className="text-sm font-semibold text-orange-200">
              Command webhook
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Command ini selalu mengikuti nilai aktif. Database akan dipakai
              lebih dulu, env jadi cadangan.
            </p>
            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/30 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-neutral-200">
                {setWebhookCommand}
              </pre>
            </div>
            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/30 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-neutral-200">
                {deleteWebhookCommand}
              </pre>
            </div>
          </AdminSurface>
        </div>
      </div>
    </div>
  );
}
