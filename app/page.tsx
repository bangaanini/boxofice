import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { TelegramAwareUserAvatar } from "@/components/navigation/telegram-aware-user-avatar";
import { HomeCatalog } from "@/components/movie/home-catalog";
import { HomeHero } from "@/components/movie/home-hero";
import { HomeSectionRow } from "@/components/movie/home-section-row";
import { LazyMount } from "@/components/movie/lazy-mount";
import { resolveChannelBroadcastStartParam } from "@/lib/channel-broadcasts";
import { extractChannelBroadcastTokenFromStartParam } from "@/lib/channel-broadcast-tokens";
import {
  getCatalogPage,
  getHomepageData,
  getHomepageFilterOptions,
  type HomepageFilters,
} from "@/lib/movie-feeds";
import { extractSearchRouteFromStartParam } from "@/lib/telegram-miniapp";
import { getCurrentUserSession } from "@/lib/user-auth";

// Halaman home boleh di-cache 60 detik di server. Data dari getHomepageData()
// sendiri di-cache via unstable_cache di lib/movie-feeds.ts. force-dynamic dihapus
// supaya navigasi balik ke "/" pakai cached HTML/RSC, tidak re-render setiap kali.
export const revalidate = 60;

type HomePageProps = {
  searchParams: Promise<{
    genre?: string;
    ref?: string;
    start_param?: string;
    startapp?: string;
    tgWebAppStartParam?: string;
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

function appendStartParamToPath(path: string, startParam: string | null) {
  if (!startParam) {
    return path;
  }

  const params = new URLSearchParams();
  params.set("tgWebAppStartParam", startParam);

  return `${path}?${params.toString()}`;
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

export default async function Home({ searchParams }: HomePageProps) {
  const [params, user] = await Promise.all([
    searchParams,
    getCurrentUserSession(),
  ]);
  const { genre, year } = params;

  const selectedGenre = normalizeQueryValue(genre);
  const selectedYear = normalizeQueryValue(year);
  const incomingStartParam =
    normalizeQueryValue(params.start_param) ??
    normalizeQueryValue(params.startapp) ??
    normalizeQueryValue(params.tgWebAppStartParam) ??
    normalizeQueryValue(params.ref);
  const isBroadcastStart = Boolean(
    extractChannelBroadcastTokenFromStartParam(incomingStartParam),
  );
  const isSearchStart = extractSearchRouteFromStartParam(incomingStartParam);

  if (isBroadcastStart) {
    const broadcastTarget = await resolveChannelBroadcastStartParam(
      incomingStartParam,
    ).catch(() => null);

    if (broadcastTarget?.movieId) {
      redirect(
        appendStartParamToPath(
          `/movie/${broadcastTarget.movieId}`,
          incomingStartParam,
        ),
      );
    }

    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(220,38,38,0.2),transparent_26%),radial-gradient(circle_at_50%_18%,rgba(255,115,0,0.14),transparent_32%),linear-gradient(180deg,#120909_0%,#050505_58%,#020202_100%)]" />

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(8,8,8,0.96))] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
            <p className="mt-5 text-lg font-semibold text-white">
              Film broadcast tidak ditemukan
            </p>
            <p className="mt-3 text-sm leading-7 text-neutral-400">
              Link channel ini tidak lagi cocok dengan data broadcast yang
              tersimpan. Silakan buka katalog atau kirim ulang broadcast.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-semibold text-white"
            >
              Buka katalog
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (isSearchStart) {
    redirect(appendStartParamToPath("/search", incomingStartParam));
  }

  const [filters, catalog, homepage] = await Promise.all([
    getHomepageFilterOptions(),
    getCatalogPage({
      genre: selectedGenre,
      limit: 18,
      offset: 0,
      year: selectedYear,
    }),
    getHomepageData(),
  ]);
  const currentFilters = {
    genre: selectedGenre,
    year: selectedYear,
  } satisfies HomepageFilters;
  const showSections = !selectedGenre && !selectedYear;
  const displayName = user
    ? user.telegramFirstName?.trim() ||
      user.name.trim() ||
      user.telegramUsername ||
      "Teman"
    : null;
  const usernameLabel = user
    ? user.telegramUsername
      ? `@${user.telegramUsername}`
      : "Akun Telegram aktif"
    : null;

  return (
    <main className="min-h-screen bg-black pb-24 text-white sm:pb-8">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[linear-gradient(180deg,rgba(10,10,10,0.96),rgba(10,10,10,0.88))] backdrop-blur-xl sm:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] sm:px-8 lg:px-10">
          {user && displayName ? (
            <div className="flex items-center gap-3">
              <TelegramAwareUserAvatar
                alt={displayName}
                className="size-11"
                fallbackChar={displayName.charAt(0).toUpperCase()}
                photoUrl={user.telegramPhotoUrl}
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  {displayName}
                </p>
                <p className="truncate text-xs text-neutral-400">
                  {usernameLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">
                  Box Office
                </p>
                <p className="text-xs text-neutral-400">
                  Pratinjau katalog publik
                </p>
              </div>
              <Link
                href="/login-telegram"
                prefetch={false}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-red-400/30 bg-red-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-red-500"
              >
                <MessageCircle className="size-4" />
                Buka via Telegram
              </Link>
            </div>
          )}

          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Kategori
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

      <div className="pt-[118px] sm:pt-2">
        {showSections && homepage.heroBanners.length ? (
          <HomeHero banners={homepage.heroBanners} />
        ) : null}

        {showSections && homepage.sections.length ? (
          <div className="space-y-8 py-6 sm:space-y-10 sm:py-8">
            {homepage.sections.map((section, index) =>
              index < 1 ? (
                <HomeSectionRow
                  key={section.slug}
                  title={section.title}
                  slug={section.slug}
                  movies={section.movies}
                  eager
                />
              ) : (
                <LazyMount
                  key={section.slug}
                  rootMargin="800px 0px"
                  minHeight={260}
                >
                  <HomeSectionRow
                    title={section.title}
                    slug={section.slug}
                    movies={section.movies}
                  />
                </LazyMount>
              ),
            )}
          </div>
        ) : null}

        <LazyMount rootMargin="800px 0px" minHeight={600}>
          <div className={showSections ? "pt-2" : ""}>
            <HomeCatalog
              filters={currentFilters}
              initialMovies={catalog.items}
              initialNextOffset={catalog.nextOffset}
            />
          </div>
        </LazyMount>
      </div>
    </main>
  );
}
