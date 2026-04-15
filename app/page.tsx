import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MovieCardLink } from "@/components/movie/movie-card-link";
import { TelegramEntryGate } from "@/components/telegram/telegram-entry-gate";
import {
  getHomepageFilterOptions,
  getHomepageMovieData,
  type HomepageFilters,
} from "@/lib/movie-feeds";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import {
  buildTelegramBotChatUrlForUsername,
  buildTelegramMiniAppUrlForConfig,
} from "@/lib/telegram-miniapp";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    genre?: string;
    year?: string;
  }>;
};

function normalizeQueryValue(value?: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function buildFilterHref(
  current: HomepageFilters,
  patch: Partial<Record<keyof HomepageFilters, string | null>>,
) {
  const nextGenre = Object.prototype.hasOwnProperty.call(patch, "genre")
    ? patch.genre
    : current.genre;
  const nextYear = Object.prototype.hasOwnProperty.call(patch, "year")
    ? patch.year
    : current.year;
  const next = {
    genre: normalizeQueryValue(nextGenre),
    year: normalizeQueryValue(nextYear),
  };
  const params = new URLSearchParams();

  if (next.genre) {
    params.set("genre", next.genre);
  }

  if (next.year) {
    params.set("year", next.year);
  }

  const query = params.toString();

  return query ? `/?${query}` : "/";
}

function FilterChip({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      scroll={false}
      data-haptic="light"
      className={[
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-red-400/40 bg-red-600 text-white"
          : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function MovieRail({
  href,
  movies,
  title,
}: {
  href: string;
  movies: Awaited<ReturnType<typeof getHomepageMovieData>>["homeMovies"];
  title: string;
}) {
  if (!movies.length) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-8 sm:py-3 lg:px-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {movies.map((movie) => (
          <MovieCardLink
            key={movie.id}
            movie={movie}
            className="w-[132px] shrink-0 sm:w-[180px] sm:hover:-translate-y-1"
          />
        ))}
        <Link
          href={href}
          prefetch
          data-haptic="light"
          className="flex aspect-[2/3] w-[132px] shrink-0 flex-col items-center justify-center rounded-md border border-white/10 bg-white/[0.05] p-4 text-center outline-none transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-300 hover:bg-white/[0.09] sm:w-[180px]"
        >
          <span className="flex size-11 items-center justify-center rounded-md bg-red-600/15 text-red-300 ring-1 ring-red-400/20">
            <ArrowRight className="size-5" />
          </span>
          <span className="mt-4 text-sm font-semibold text-white sm:text-base">
            Lihat semua
          </span>
        </Link>
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: HomePageProps) {
  const [{ genre, year }, user] = await Promise.all([
    searchParams,
    getCurrentUserSession(),
  ]);

  if (!user) {
    const telegram = await getTelegramBotSettingsSafe();

    return (
      <TelegramEntryGate
        adminLoginUrl="/admin/login"
        botChatUrl={buildTelegramBotChatUrlForUsername(
          telegram.runtime.botUsername,
        )}
        miniAppUrl={buildTelegramMiniAppUrlForConfig(telegram.runtime)}
      />
    );
  }

  const selectedGenre = normalizeQueryValue(genre);
  const selectedYear = normalizeQueryValue(year);
  const [filters, { homeMovies, popularMovies, newMovies, totalMovies }] =
    await Promise.all([
      getHomepageFilterOptions(),
      getHomepageMovieData({
        genre: selectedGenre,
        limit: 18,
        year: selectedYear,
      }),
    ]);
  const currentFilters = {
    genre: selectedGenre,
    year: selectedYear,
  } satisfies HomepageFilters;
  const displayName =
    user.telegramFirstName?.trim() ||
    user.name.trim() ||
    user.telegramUsername ||
    "Teman";
  const usernameLabel = user.telegramUsername
    ? `@${user.telegramUsername}`
    : "Akun Telegram aktif";

  return (
    <main className="min-h-screen bg-black pb-24 text-white sm:pb-8">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[linear-gradient(180deg,rgba(10,10,10,0.96),rgba(10,10,10,0.88))] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
              {user.telegramPhotoUrl ? (
                <Image
                  src={user.telegramPhotoUrl}
                  alt={displayName}
                  fill
                  unoptimized
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-neutral-400">
                {usernameLabel}
              </p>
            </div>
          </div>


          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Genre
              </div>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                <FilterChip
                  active={!selectedGenre}
                  href={buildFilterHref(currentFilters, { genre: null })}
                  label="Semua"
                />
                {filters.genres.map((genreOption) => (
                  <FilterChip
                    key={genreOption}
                    active={selectedGenre === genreOption}
                    href={buildFilterHref(currentFilters, {
                      genre: genreOption,
                    })}
                    label={genreOption}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-[182px] sm:pt-[188px]">
        <MovieRail
          href="/browse/home"
          title="Pilihan Untukmu"
          movies={homeMovies}
        />
        <MovieRail
          href="/browse/populer"
          title="Sedang populer"
          movies={popularMovies}
        />
        <MovieRail
          href="/browse/new"
          title="Rilis terbaru"
          movies={newMovies}
        />

        {!homeMovies.length && !popularMovies.length && !newMovies.length ? (
          <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:px-10">
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-neutral-900/60 px-6 text-center">
              <p className="text-2xl font-semibold text-white">
                Belum ada film yang cocok
              </p>
              <p className="mt-3 max-w-md text-sm leading-6 text-neutral-400">
                Coba ganti genre atau tahun agar katalog yang tampil lebih luas.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
