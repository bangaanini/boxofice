import { publishMainChannelBroadcastAction } from "@/app/admin/actions";
import { ChannelBroadcastComposer } from "@/components/broadcast/channel-broadcast-composer";
import { AdminSurface } from "@/components/admin/admin-surface";
import {
  buildDefaultChannelBroadcastCaption,
  getDefaultChannelBroadcastButtonLabel,
  listRecentChannelBroadcasts,
  searchMoviesForChannelBroadcast,
} from "@/lib/channel-broadcasts";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";

export const dynamic = "force-dynamic";

type AdminChannelBroadcastPageProps = {
  searchParams: Promise<{
    broadcast?: string;
    message?: string;
    q?: string;
  }>;
};

export default async function AdminChannelBroadcastPage({
  searchParams,
}: AdminChannelBroadcastPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const [telegram, movies, broadcasts] = await Promise.all([
    getTelegramBotSettingsSafe(),
    searchMoviesForChannelBroadcast(query),
    listRecentChannelBroadcasts({ botKind: "default", limit: 8 }),
  ]);
  const selectedMovie = movies[0] ?? null;
  const initialCaption = selectedMovie
    ? buildDefaultChannelBroadcastCaption({
        botName: telegram.settings.brandName,
        description: selectedMovie.description,
        title: selectedMovie.title,
      })
    : "";

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Broadcast channel
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">
          Kirim poster ke channel utama
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Bot utama bisa mengirim poster, sinopsis, dan satu tombol inline ke
          channel Telegram. Tombol memakai deep link pendek, jadi klik dari
          channel tetap mendarat ke film yang benar di Mini App.
        </p>
      </AdminSurface>

      {params.broadcast ? (
        <AdminSurface className="text-sm leading-6 text-neutral-200">
          {params.broadcast === "error" ? (
            <span className="text-red-200">
              {params.message ?? "Broadcast channel gagal dikirim."}
            </span>
          ) : (
            <span className="text-emerald-100">
              {params.message ?? "Broadcast channel berhasil dikirim."}
            </span>
          )}
        </AdminSurface>
      ) : null}

      <AdminSurface>
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Cari judul dari katalog lokal
            </label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Cari film yang mau dibroadcast"
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
      </AdminSurface>

      {movies.length ? (
        <ChannelBroadcastComposer
          action={publishMainChannelBroadcastAction}
          botName={telegram.settings.brandName}
          botUsername={telegram.runtime.botUsername}
          helperText="Bot utama harus sudah jadi admin di channel target. Gunakan @channelkamu atau link t.me/channelkamu."
          initialButtonLabel={getDefaultChannelBroadcastButtonLabel()}
          initialCaption={initialCaption}
          initialMovieId={selectedMovie.id}
          movies={movies.map((movie) => ({
            ...movie,
            defaultCaption: buildDefaultChannelBroadcastCaption({
              botName: telegram.settings.brandName,
              description: movie.description,
              title: movie.title,
            }),
          }))}
          pendingLabel="Mengirim..."
          submitLabel="Kirim ke channel"
        />
      ) : (
        <AdminSurface className="text-sm leading-6 text-neutral-300">
          Tidak ada film katalog yang cocok untuk query ini.
        </AdminSurface>
      )}

      <AdminSurface>
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
                    <p>
                      {broadcast.pinned ? "Pinned" : "Tidak dipin"}
                    </p>
                    <p className="mt-1">
                      {broadcast.postedAt?.toLocaleString("id-ID") ??
                        broadcast.createdAt.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs leading-6 text-neutral-400">
                  <p>Token: <span className="text-neutral-200">{broadcast.token}</span></p>
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
              Belum ada broadcast channel dari bot utama.
            </p>
          )}
        </div>
      </AdminSurface>
    </div>
  );
}
