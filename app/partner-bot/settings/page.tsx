import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Settings2, Sparkles } from "lucide-react";

import { savePartnerBotSettingsAction } from "@/app/partner-bot/actions";
import { Button } from "@/components/ui/button";
import { TelegramEntryGate } from "@/components/telegram/telegram-entry-gate";
import { getOwnedPartnerBotsForUser } from "@/lib/telegram-partner-bots";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import {
  buildTelegramBotChatUrlForUsername,
  buildTelegramMiniAppUrlForConfig,
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

function Field({
  defaultValue,
  fallbackValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string | null;
  fallbackValue?: string | null;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-neutral-600"
      />
      {fallbackValue ? (
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          Kosongkan untuk pakai global: <span className="text-neutral-300">{fallbackValue}</span>
        </p>
      ) : null}
    </div>
  );
}

function TextareaField({
  defaultValue,
  fallbackValue,
  label,
  name,
}: {
  defaultValue?: string | null;
  fallbackValue?: string | null;
  label: string;
  name: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={8}
        className="mt-2 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-600"
      />
      {fallbackValue ? (
        <p className="mt-2 text-xs leading-6 text-neutral-500">
          Kosongkan untuk pakai pesan global. Placeholder yang didukung:{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-neutral-300">
            {`{first_name}`}
          </code>{" "}
          dan{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-neutral-300">
            {`{username}`}
          </code>
          .
        </p>
      ) : null}
    </div>
  );
}

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
        miniAppUrl={buildTelegramMiniAppUrlForConfig(
          {
            botUsername: telegram.runtime.botUsername,
            miniAppShortName: telegram.runtime.miniAppShortName,
          },
          null,
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
              pakai setting global dari sistem utama.
            </p>
          </div>

          <Button
            asChild
            variant="secondary"
            className="h-10 border border-white/10 bg-white/[0.08] px-4 text-white hover:bg-white/[0.14]"
          >
            <Link href="/profile">Profil</Link>
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
                  Deep link:{" "}
                  <span className="break-all text-neutral-200">
                    {bot.shareLinks?.startChatUrl ?? "-"}
                  </span>
                </p>
                <p>
                  Mini App:{" "}
                  <span className="break-all text-neutral-200">
                    {bot.shareLinks?.miniAppUrl ?? "-"}
                  </span>
                </p>
              </div>
            </div>

            <form action={savePartnerBotSettingsAction} className="mt-5 space-y-5">
              <input type="hidden" name="partnerBotId" value={bot.id} />

              <TextareaField
                defaultValue={bot.rawOverrides.welcomeMessage}
                fallbackValue={bot.effectiveSettings.welcomeMessage}
                label="Pesan sambutan"
                name="welcomeMessage"
              />

              <Field
                defaultValue={bot.rawOverrides.settingsLabel}
                fallbackValue={bot.ownerSettingsButtonLabel}
                label="Label tombol setting khusus owner"
                name="settingsLabel"
                placeholder="Mis. ⚙️ Setting bot"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  defaultValue={bot.rawOverrides.openAppLabel}
                  fallbackValue={bot.effectiveSettings.openAppLabel}
                  label="Label tombol buka"
                  name="openAppLabel"
                />
                <Field
                  defaultValue={bot.rawOverrides.openAppUrl}
                  fallbackValue={bot.effectiveSettings.openAppUrl}
                  label="URL tombol buka"
                  name="openAppUrl"
                />
                <Field
                  defaultValue={bot.rawOverrides.searchLabel}
                  fallbackValue={bot.effectiveSettings.searchLabel}
                  label="Label tombol cari"
                  name="searchLabel"
                />
                <Field
                  defaultValue={bot.rawOverrides.searchUrl}
                  fallbackValue={bot.effectiveSettings.searchUrl}
                  label="URL tombol cari"
                  name="searchUrl"
                />
                <Field
                  defaultValue={bot.rawOverrides.affiliateLabel}
                  fallbackValue={bot.effectiveSettings.affiliateLabel}
                  label="Label tombol affiliate"
                  name="affiliateLabel"
                />
                <Field
                  defaultValue={bot.rawOverrides.affiliateUrl}
                  fallbackValue={bot.effectiveSettings.affiliateUrl}
                  label="URL tombol affiliate"
                  name="affiliateUrl"
                />
                <Field
                  defaultValue={bot.rawOverrides.affiliateGroupLabel}
                  fallbackValue={bot.effectiveSettings.affiliateGroupLabel}
                  label="Label grup affiliate"
                  name="affiliateGroupLabel"
                />
                <Field
                  defaultValue={bot.rawOverrides.affiliateGroupUrl}
                  fallbackValue={bot.effectiveSettings.affiliateGroupUrl}
                  label="URL grup affiliate"
                  name="affiliateGroupUrl"
                />
                <Field
                  defaultValue={bot.rawOverrides.channelLabel}
                  fallbackValue={bot.effectiveSettings.channelLabel}
                  label="Label channel film"
                  name="channelLabel"
                />
                <Field
                  defaultValue={bot.rawOverrides.channelUrl}
                  fallbackValue={bot.effectiveSettings.channelUrl}
                  label="URL channel film"
                  name="channelUrl"
                />
                <Field
                  defaultValue={bot.rawOverrides.supportLabel}
                  fallbackValue={bot.effectiveSettings.supportLabel}
                  label="Label support"
                  name="supportLabel"
                />
                <Field
                  defaultValue={bot.rawOverrides.supportUrl}
                  fallbackValue={bot.effectiveSettings.supportUrl}
                  label="URL support"
                  name="supportUrl"
                />
                <Field
                  defaultValue={bot.rawOverrides.vipLabel}
                  fallbackValue={bot.effectiveSettings.vipLabel}
                  label="Label tombol VIP"
                  name="vipLabel"
                />
                <Field
                  defaultValue={bot.rawOverrides.vipUrl}
                  fallbackValue={bot.effectiveSettings.vipUrl}
                  label="URL tombol VIP"
                  name="vipUrl"
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full bg-red-600 text-white hover:bg-red-500"
              >
                <Settings2 className="size-4" />
                Simpan pengaturan bot
              </Button>
            </form>
          </section>
        ))}
      </section>
    </main>
  );
}
