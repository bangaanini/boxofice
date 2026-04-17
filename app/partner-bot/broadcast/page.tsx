import Link from "next/link";
import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";

import { publishPartnerChannelBroadcastAction } from "@/app/partner-bot/actions";
import { ChannelBroadcastComposer } from "@/components/broadcast/channel-broadcast-composer";
import { Button } from "@/components/ui/button";
import { TelegramEntryGate } from "@/components/telegram/telegram-entry-gate";
import {
  buildDefaultChannelBroadcastCaption,
  getDefaultChannelBroadcastButtonLabel,
  listRecentChannelBroadcasts,
  searchMoviesForChannelBroadcast,
} from "@/lib/channel-broadcasts";
import { getOwnedPartnerBotsForUser } from "@/lib/telegram-partner-bots";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import {
  buildTelegramBotChatUrlForUsername,
  buildTelegramMainMiniAppUrlForUsername,
} from "@/lib/telegram-miniapp";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type PartnerBotBroadcastPageProps = {
  searchParams: Promise<{
    bot?: string;
    broadcast?: string;
    message?: string;
    q?: string;
  }>;
};

export default async function PartnerBotBroadcastPage({
  searchParams,
}: PartnerBotBroadcastPageProps) {
  const params = await searchParams;
  const sessionUser = await getCurrentUserSession();

  if (!sessionUser) {
    const telegram = await getTelegramBotSettingsSafe();
    const search = new URLSearchParams();

    if (params.bot?.trim()) {
      search.set("bot", params.bot.trim());
    }

    const successRedirectPath = search.toString()
      ? `/partner-bot/broadcast?${search.toString()}`
      : "/partner-bot/broadcast";

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

  const selectedBotId = params.bot?.trim() || ownedBots[0]?.id;
  const selectedBot = ownedBots.find((bot) => bot.id === selectedBotId) ?? ownedBots[0];
  const query = params.q?.trim() ?? "";
  const [movies, broadcasts] = await Promise.all([
    searchMoviesForChannelBroadcast(query),
    listRecentChannelBroadcasts({
      botKind: "partner",
      limit: 8,
      ownerUserId: sessionUser.id,
      partnerBotId: selectedBot.id,
    }),
  ]);
  const selectedMovie = movies[0] ?? null;
  const botDisplayName = selectedBot.label?.trim() || selectedBot.botName;
  const initialCaption = selectedMovie
    ? buildDefaultChannelBroadcastCaption({
        botName: botDisplayName,
        description: selectedMovie.description,
        title: selectedMovie.title,
      })
    : "";

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.2),transparent_30%),radial-gradient(circle_at_50%_14%,rgba(220,38,38,0.14),transparent_32%),linear-gradient(180deg,#130c0a_0%,#070707_52%,#020202_100%)]" />

      <section className="relative z-10 mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
              <Megaphone className="size-3.5" />
              Broadcast partner
            </p>
            <h1 className="mt-3 text-3xl font-black text-white">
              Kirim poster ke channel partner
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Bot partner kamu bisa kirim poster, sinopsis, dan satu tombol
              “Tonton Sekarang” ke channel sendiri. Klik dari channel akan
              dibawa ke film yang tepat di Mini App bot kamu.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              asChild
              variant="secondary"
              className="h-10 border border-white/10 bg-white/[0.08] px-4 text-white hover:bg-white/[0.14]"
            >
              <Link href={`/partner-bot/settings?bot=${encodeURIComponent(selectedBot.id)}`}>
                Setting bot
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="h-10 border border-white/10 bg-white/[0.08] px-4 text-white hover:bg-white/[0.14]"
            >
              <Link href="/profile">Profil</Link>
            </Button>
          </div>
        </div>

        {params.broadcast ? (
          <div
            className={`rounded-[20px] border px-4 py-3 text-sm leading-6 ${
              params.broadcast === "error"
                ? "border-red-500/20 bg-red-500/10 text-red-100"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {params.message ??
              (params.broadcast === "error"
                ? "Broadcast channel gagal dikirim."
                : "Broadcast channel berhasil dikirim.")}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {ownedBots.map((bot) => {
            const active = bot.id === selectedBot.id;
            return (
              <Link
                key={bot.id}
                href={`/partner-bot/broadcast?bot=${encodeURIComponent(bot.id)}`}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-orange-300/20 bg-orange-500/10 text-orange-100"
                    : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]"
                }`}
              >
                {bot.label?.trim() || bot.botName}
              </Link>
            );
          })}
        </div>

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5">
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
            <input type="hidden" name="bot" value={selectedBot.id} />
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Cari judul dari katalog lokal
              </label>
              <input
                name="q"
                defaultValue={query}
                placeholder="Cari film untuk channel partner"
                className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-neutral-600"
              />
            </div>
            <button
              type="submit"
              className="mt-7 h-12 rounded-[16px] bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Cari judul
            </button>
          </form>
        </section>

        {movies.length ? (
          <ChannelBroadcastComposer
            action={publishPartnerChannelBroadcastAction}
            botName={botDisplayName}
            botUsername={selectedBot.botUsername}
            helperText="Bot partner harus sudah jadi admin di channel target. Gunakan channel publik seperti @channelkamu atau t.me/channelkamu."
            hiddenFields={[{ name: "partnerBotId", value: selectedBot.id }]}
            initialButtonLabel={getDefaultChannelBroadcastButtonLabel()}
            initialCaption={initialCaption}
            initialMovieId={selectedMovie.id}
            movies={movies.map((movie) => ({
              ...movie,
              defaultCaption: buildDefaultChannelBroadcastCaption({
                botName: botDisplayName,
                description: movie.description,
                title: movie.title,
              }),
            }))}
            pendingLabel="Mengirim..."
            submitLabel={`Kirim via ${botDisplayName}`}
          />
        ) : (
          <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5 text-sm leading-6 text-neutral-300">
            Tidak ada film katalog yang cocok untuk query ini.
          </section>
        )}

        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-5">
          <h2 className="text-xl font-bold text-white">Broadcast terbaru</h2>
          <div className="mt-4 space-y-3">
            {broadcasts.length ? (
              broadcasts.map((broadcast) => (
                <div
                  key={broadcast.id}
                  className="rounded-[18px] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {broadcast.movie.title}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        @{broadcast.channelUsername} · @{broadcast.botUsername}
                      </p>
                    </div>
                    <div className="text-right text-xs text-neutral-400">
                      <p>{broadcast.pinned ? "Pinned" : "Tidak dipin"}</p>
                      <p className="mt-1">
                        {broadcast.postedAt?.toLocaleString("id-ID") ??
                          broadcast.createdAt.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs leading-6 text-neutral-400">
                    <p>
                      Token:{" "}
                      <span className="text-neutral-200">{broadcast.token}</span>
                    </p>
                    {broadcast.telegramMessageId ? (
                      <a
                        href={`https://t.me/${broadcast.channelUsername}/${broadcast.telegramMessageId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-orange-200 hover:text-orange-100"
                      >
                        Lihat post channel
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400">
                Belum ada broadcast untuk bot partner ini.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
