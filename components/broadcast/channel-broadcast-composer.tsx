"use client";

import * as React from "react";
import Image from "next/image";

import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { cn } from "@/lib/utils";

type BroadcastMovieOption = {
  defaultCaption: string;
  description: string | null;
  id: string;
  thumbnail: string | null;
  title: string;
};

type HiddenField = {
  name: string;
  value: string;
};

type ChannelBroadcastComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
  botName: string;
  botUsername: string;
  channelFieldLabel?: string;
  channelFieldPlaceholder?: string;
  extraFields?: React.ReactNode;
  helperText: string;
  hiddenFields?: HiddenField[];
  initialButtonLabel: string;
  initialCaption: string;
  initialChannelUsername?: string;
  initialMovieId: string;
  movies: BroadcastMovieOption[];
  pendingLabel: string;
  submitLabel: string;
};

function formatCaptionLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => {
      if (line.length > 0) {
        return true;
      }

      return index > 0 && lines[index - 1]?.length > 0;
    });
}

export function ChannelBroadcastComposer({
  action,
  botName,
  botUsername,
  channelFieldLabel = "Channel Telegram",
  channelFieldPlaceholder = "@channelkamu atau https://t.me/channelkamu",
  extraFields,
  helperText,
  hiddenFields = [],
  initialButtonLabel,
  initialCaption,
  initialChannelUsername = "",
  initialMovieId,
  movies,
  pendingLabel,
  submitLabel,
}: ChannelBroadcastComposerProps) {
  const movieMap = React.useMemo(
    () => new Map(movies.map((movie) => [movie.id, movie])),
    [movies],
  );
  const [selectedMovieId, setSelectedMovieId] = React.useState(initialMovieId);
  const [channelUsername, setChannelUsername] = React.useState(
    initialChannelUsername,
  );
  const [buttonLabel, setButtonLabel] = React.useState(initialButtonLabel);
  const [caption, setCaption] = React.useState(initialCaption);
  const [pinMessage, setPinMessage] = React.useState(true);
  const selectedMovie =
    movieMap.get(selectedMovieId) ?? movies[0] ?? null;
  const previousMovieIdRef = React.useRef(initialMovieId);

  React.useEffect(() => {
    if (!selectedMovie) {
      return;
    }

    const previousMovie = movieMap.get(previousMovieIdRef.current);
    const previousDefaultCaption = previousMovie?.defaultCaption ?? "";
    const shouldRefreshCaption =
      !caption.trim() || caption.trim() === previousDefaultCaption.trim();

    if (shouldRefreshCaption) {
      setCaption(selectedMovie.defaultCaption);
    }

    previousMovieIdRef.current = selectedMovie.id;
  }, [caption, movieMap, selectedMovie]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_360px]">
      <form
        action={action}
        className="space-y-5 rounded-[24px] border border-white/10 bg-black/20 p-5"
      >
        {hiddenFields.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} />
        ))}

        {extraFields ? <div>{extraFields}</div> : null}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <label className="block text-sm font-medium text-neutral-300">
              {channelFieldLabel}
            </label>
            <input
              name="channelUsername"
              value={channelUsername}
              onChange={(event) => setChannelUsername(event.target.value)}
              className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-neutral-600"
              placeholder={channelFieldPlaceholder}
            />
            <p className="mt-2 text-xs leading-5 text-neutral-500">{helperText}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Judul yang dibroadcast
            </label>
            <select
              name="movieId"
              value={selectedMovieId}
              onChange={(event) => setSelectedMovieId(event.target.value)}
              className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none"
            >
              {movies.map((movie) => (
                <option key={movie.id} value={movie.id} className="bg-[#16100f]">
                  {movie.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Caption post
            </label>
            <textarea
              name="caption"
              rows={11}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              className="mt-2 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-neutral-600"
            />
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              Telegram membatasi caption foto sampai 1024 karakter.
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Baris VIP, Panduan Pengguna, dan Hubungi Admin akan otomatis jadi
              inline link ke bot pengirim selama labelnya tetap dipakai.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Label tombol tonton
              </label>
              <input
                name="buttonLabel"
                value={buttonLabel}
                onChange={(event) => setButtonLabel(event.target.value)}
                className="mt-2 h-12 w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-neutral-600"
                placeholder="▶️ Tonton Sekarang"
              />
            </div>

            <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                name="pinMessage"
                checked={pinMessage}
                onChange={(event) => setPinMessage(event.target.checked)}
                className="size-4 rounded border-white/20 bg-transparent text-red-500 focus:ring-red-500"
              />
              Pin post setelah terkirim
            </label>

            <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-neutral-400">
              <p className="font-semibold text-neutral-200">Bot pengirim</p>
              <p className="mt-2">@{botUsername}</p>
              <p className="mt-1">{botName}</p>
            </div>
          </div>
        </div>

        <PendingSubmitButton
          pendingLabel={pendingLabel}
          className="h-12 w-full bg-red-600 text-white hover:bg-red-500"
        >
          {submitLabel}
        </PendingSubmitButton>
      </form>

      <section className="rounded-[24px] border border-white/10 bg-[#1f2c3a] p-4">
        <p className="text-sm font-semibold text-orange-200">Preview channel post</p>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Channel
          </p>
          <p className="mt-3 text-lg font-semibold text-white">
            {channelUsername.trim() || "@channelkamu"}
          </p>
          <p className="mt-2 text-sm text-orange-200">@{botUsername}</p>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-[#1f2c3a] p-3">
          <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#2c3947]">
            <div className="relative aspect-[4/5] bg-black/40">
              {selectedMovie?.thumbnail ? (
                <Image
                  src={selectedMovie.thumbnail}
                  alt={selectedMovie.title}
                  className="h-full w-full object-cover"
                  fill
                  sizes="360px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                  Poster film akan muncul di sini.
                </div>
              )}
            </div>

            <div className="p-4 text-sm leading-7 text-white">
              {formatCaptionLines(caption || selectedMovie?.defaultCaption || "").map(
                (line, index) => (
                  <p
                    key={`${line}-${index}`}
                    className={cn(!line.trim() && "min-h-3")}
                  >
                    {line || "\u00A0"}
                  </p>
                ),
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="grid gap-2">
              <div className="rounded-[16px] border border-white/10 bg-[#253140] px-4 py-3 text-center text-sm font-semibold text-white">
                {buttonLabel.trim() || "▶️ Tonton Sekarang"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
