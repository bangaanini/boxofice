import { AdminSurface } from "@/components/admin/admin-surface";
import { TelegramMessageEditor } from "@/components/admin/telegram-message-editor";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";

export const dynamic = "force-dynamic";

type AdminBotMessagePageProps = {
  searchParams: Promise<{
    botUi?: string;
    message?: string;
  }>;
};

export default async function AdminBotMessagePage({
  searchParams,
}: AdminBotMessagePageProps) {
  const params = await searchParams;
  const telegramSettingsResult = await getTelegramBotSettingsSafe();
  const telegramSettings = telegramSettingsResult.settings;
  const telegramRuntime = telegramSettingsResult.runtime;

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Pesan bot
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Sambutan dan inline keyboard
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Atur pesan sambutan dan 10 tombol inline tanpa bercampur dengan
          pengaturan bot utama. Preview di kanan akan berubah langsung saat kamu
          mengedit form di kiri.
        </p>
      </AdminSurface>

      {params.botUi ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.botUi === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Pengaturan pesan bot gagal diperbarui."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Pengaturan pesan bot berhasil diperbarui."}
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

      <TelegramMessageEditor
        initialButtons={telegramSettings.inlineButtons}
        initialWelcomeMessage={telegramSettings.welcomeMessage}
        previewDescription={telegramSettings.seoDescription}
        previewHost={telegramRuntime.publicAppUrl.replace(/^https?:\/\//, "")}
        previewTitle={telegramSettings.seoTitle}
      />
    </div>
  );
}
