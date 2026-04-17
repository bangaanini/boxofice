import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Sparkles } from "lucide-react";

import { PartnerBotMessageEditor } from "@/components/partner/partner-bot-message-editor";
import { Button } from "@/components/ui/button";
import { TelegramEntryGate } from "@/components/telegram/telegram-entry-gate";
import { getOwnedPartnerBotsForUser } from "@/lib/telegram-partner-bots";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import {
  buildTelegramBotChatUrlForUsername,
  buildTelegramMainMiniAppUrlForUsername,
} from "@/lib/telegram-miniapp";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type PartnerBotSettingsPageProps = {
  searchParams: Promise<{
    bot?: string;
    message?: string;
    partner?: string;
  }>;
};

export default async function PartnerBotSettingsPage({
  searchParams,
}: PartnerBotSettingsPageProps) {
  const params = await searchParams;
  const sessionUser = await getCurrentUserSession();

  if (!sessionUser) {
    const telegram = await getTelegramBotSettingsSafe();
    const search = new URLSearchParams();

    if (params.bot?.trim()) {
      search.set("bot", params.bot.trim());
    }

    const successRedirectPath = search.toString()
      ? `/partner-bot/settings?${search.toString()}`
      : "/partner-bot/settings";

    return (
      <TelegramEntryGate
        adminLoginUrl="/admin/login"
        botChatUrl={buildTelegramBotChatUrlForUsername(
          telegram.runtime.botUsername,
        )}
        miniAppUrl={buildTelegramMainMiniAppUrlForUsername(
          telegram.runtime.botUsername,
        )}
        successRedirectPath={successRedirectPath}
      />
    );
  }

  const ownedBots = await getOwnedPartnerBotsForUser(sessionUser.id);

  if (!ownedBots.length) {
    notFound();
  }

  const selectedBotId = params.bot?.trim();
  const orderedBots = selectedBotId
    ? [
        ...ownedBots.filter((bot) => bot.id === selectedBotId),
        ...ownedBots.filter((bot) => bot.id !== selectedBotId),
      ]
    : ownedBots;
  const globalTelegram = await getTelegramBotSettingsSafe();

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.2),transparent_30%),radial-gradient(circle_at_50%_14%,rgba(220,38,38,0.14),transparent_32%),linear-gradient(180deg,#130c0a_0%,#070707_52%,#020202_100%)]" />

      <section className="relative z-10 mx-auto w-full max-w-md space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-300">
              Partner bot
            </p>
            <h1 className="mt-1 text-3xl font-black text-white">
              Atur pesan dan tombol bot
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Semua field di sini opsional. Kalau dikosongkan, bot akan otomatis
              pakai setting global dari sistem utama. Tombol Hubungi Admin dan
              Group tetap ikut pengaturan admin utama, dan Join VIP tetap membuka
              halaman VIP Mini App.
            </p>
          </div>

          <Button
            asChild
            variant="secondary"
            className="h-10 border border-white/10 bg-white/[0.08] px-4 text-white hover:bg-white/[0.14]"
          >
            <Link href="/profile">Profil</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-10 border border-white/10 bg-white/[0.08] px-4 text-white hover:bg-white/[0.14]"
          >
            <Link href="/partner-bot/broadcast">Broadcast</Link>
          </Button>
        </div>

        {params.partner ? (
          <div
            className={`rounded-[20px] border px-4 py-3 text-sm leading-6 ${
              params.partner === "error"
                ? "border-red-500/20 bg-red-500/10 text-red-100"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {params.message ??
              (params.partner === "error"
                ? "Pengaturan bot gagal disimpan."
                : "Pengaturan bot berhasil disimpan.")}
          </div>
        ) : null}

        {orderedBots.map((bot) => (
          <section
            key={bot.id}
            className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-neutral-200">
                  <Bot className="size-3.5" />
                  @{bot.botUsername}
                </p>
                <h2 className="mt-3 text-2xl font-black text-white">
                  {bot.label?.trim() || bot.botName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  {bot.active
                    ? "Bot ini aktif dan memakai override yang kamu simpan di bawah."
                    : "Bot ini sedang nonaktif, tapi kamu tetap bisa menyiapkan setting-nya."}
                </p>
              </div>
              <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
                {bot.active ? "Aktif" : "Nonaktif"}
              </span>
            </div>

            <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="size-4 text-orange-300" />
                Link partner aktif
              </p>
              <div className="mt-3 space-y-2 text-xs leading-6 text-neutral-400">
                <p>
                  Main Mini App:{" "}
                  <span className="break-all text-neutral-200">
                    {bot.shareLinks?.mainMiniAppUrl ?? "-"}
                  </span>
                </p>
                <p>
                  Direct link app:{" "}
                  <span className="break-all text-neutral-200">
                    {bot.shareLinks?.miniAppUrl ?? "-"}
                  </span>
                </p>
                <p>
                  Deep link chat:{" "}
                  <span className="break-all text-neutral-200">
                    {bot.shareLinks?.startChatUrl ?? "-"}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5">
              <PartnerBotMessageEditor
                botId={bot.id}
                botName={bot.label?.trim() || bot.botName}
                currentSettingsLabel={bot.rawOverrides.settingsLabel ?? bot.ownerSettingsButtonLabel}
                currentWelcomeMessage={bot.rawOverrides.welcomeMessage ?? bot.effectiveSettings.welcomeMessage}
                defaultWelcomeMessage={globalTelegram.settings.welcomeMessage}
                initialButtons={bot.effectiveSettings.inlineButtons.map((button, index) => ({
                  ...button,
                  enabled:
                    bot.rawOverrides.inlineButtons?.[index]?.enabled ?? button.enabled,
                  label:
                    bot.rawOverrides.inlineButtons?.[index]?.label ?? button.label,
                  url: bot.rawOverrides.inlineButtons?.[index]?.url ?? button.url,
                }))}
                previewDescription={`Pengaturan sambutan dan keyboard untuk ${bot.label?.trim() || bot.botName}.`}
                previewHost={bot.botUsername ? `t.me/${bot.botUsername}` : "-"}
                settingsButtonLabel={bot.ownerSettingsButtonLabel}
              />
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
