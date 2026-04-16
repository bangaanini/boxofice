"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { MovieCardLink } from "@/components/movie/movie-card-link";
import { Button } from "@/components/ui/button";
import type { NormalizedMovieMetadata } from "@/lib/movie-api";
import { cn } from "@/lib/utils";

type SearchResponse = {
  fetched: number;
  movies: SearchMovie[];
  page: number;
  totalPages?: number;
};

type SearchStatus = "idle" | "loading" | "ready" | "empty" | "error";

type UpstreamSearchProps = {
  initialQuery?: string;
  initialPage?: number;
};

type SearchMovie = NormalizedMovieMetadata & {
  movieId?: string | null;
};

const searchCache = new Map<string, SearchResponse>();
const quickSearches = ["Action", "Horror", "Korea", "Romance"];

function getCacheKey(query: string, page: number) {
  return `${query.trim().toLowerCase()}::${page}`;
}

function syncSearchUrl(query: string, page: number) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  } else {
    params.delete("q");
  }

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const queryString = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${queryString ? `?${queryString}` : ""}`,
  );
}

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <div className="aspect-[2/3] animate-pulse rounded-[18px] bg-neutral-900 ring-1 ring-white/10" />
        </div>
      ))}
    </div>
  );
}

function buildMovieHref(movie: SearchMovie) {
  if (movie.movieId) {
    return `/movie/${movie.movieId}`;
  }

  return `/movie/source?sourceUrl=${encodeURIComponent(movie.sourceUrl)}`;
}

function ResultCard({ movie }: { movie: SearchMovie }) {
  return (
    <MovieCardLink
      movie={{
        id: movie.movieId ?? movie.sourceUrl,
        quality: movie.quality ?? null,
        rating: movie.rating ?? null,
        thumbnail: movie.thumbnail ?? null,
        title: movie.title,
      }}
      href={buildMovieHref(movie)}
      prefetch={false}
      className="sm:hover:-translate-y-1"
    />
  );
}

export function UpstreamSearch({
  initialPage = 1,
  initialQuery = "",
}: UpstreamSearchProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [page, setPage] = React.useState(initialPage);
  const [result, setResult] = React.useState<SearchResponse | null>(null);
  const [isFetching, setIsFetching] = React.useState(false);
  const [status, setStatus] = React.useState<SearchStatus>(
    initialQuery.trim().length >= 2 ? "loading" : "idle",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const trimmedQuery = query.trim();

  React.useEffect(() => {
    const controller = new AbortController();
    const activeQuery = trimmedQuery;

    if (activeQuery.length < 2) {
      setResult(null);
      setError(null);
      setIsFetching(false);
      setStatus(activeQuery.length ? "empty" : "idle");
      syncSearchUrl(activeQuery, 1);
      return () => controller.abort();
    }

    const timeoutId = window.setTimeout(async () => {
      const cacheKey = getCacheKey(activeQuery, page);
      const cached = searchCache.get(cacheKey);

      syncSearchUrl(activeQuery, page);

      if (cached) {
        setResult(cached);
        setError(null);
        setIsFetching(false);
        setStatus(cached.movies.length ? "ready" : "empty");
        return;
      }

      setIsFetching(true);
      setStatus((current) =>
        current === "ready" && result?.movies.length ? "ready" : "loading",
      );
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          q: activeQuery,
        });
        const response = await fetch(`/api/search?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | SearchResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Pencarian belum bisa digunakan.",
          );
        }

        const nextResult = payload as SearchResponse;
        searchCache.set(cacheKey, nextResult);

        setResult(nextResult);
        setStatus(nextResult.movies.length ? "ready" : "empty");
      } catch (searchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          searchError instanceof Error
            ? searchError.message
            : "Pencarian belum bisa digunakan.",
        );
        setStatus("error");
      } finally {
        if (!controller.signal.aborted) {
          setIsFetching(false);
        }
      }
    }, 420);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [page, result?.movies.length, retryCount, trimmedQuery]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    syncSearchUrl(trimmedQuery, page);
  }

  const hasResults = Boolean(result?.movies.length);
  const isRefreshing = isFetching && hasResults;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 text-white sm:px-8 sm:pt-8 lg:px-10">
      <div className="relative isolate overflow-hidden rounded-md border border-white/10 bg-neutral-950 px-4 py-5 shadow-2xl shadow-black/40 sm:px-6 sm:py-7">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(220,38,38,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-md border border-red-300/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
            <Sparkles className="size-3.5" />
            Cari Film favoritmu.
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Temukan film yang ingin kamu tonton.
          </h1>

          <form onSubmit={handleSubmit} className="mt-5">
            <div className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-black/60 px-3 ring-1 ring-transparent focus-within:border-red-400/60 focus-within:ring-red-400/30">
              <Search className="size-5 shrink-0 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Cari judul film..."
                className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-neutral-500"
                autoComplete="off"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => updateQuery("")}
                  className="flex size-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="size-4" />
                </button>
              ) : null}
              <Button
                type="submit"
                size="sm"
                className="hidden bg-red-600 text-white hover:bg-red-500 sm:inline-flex"
              >
                Cari
              </Button>
            </div>
          </form>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickSearches.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateQuery(item)}
                className={cn(
                  "shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                  trimmedQuery.toLowerCase() === item.toLowerCase()
                    ? "border-red-300/50 bg-red-600 text-white"
                    : "border-white/10 bg-white/[0.06] text-neutral-300 hover:bg-white/[0.1]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex min-h-6 items-center justify-between gap-3">
        <div>
          {result && trimmedQuery.length >= 2 ? (
            <p className="text-sm font-medium text-neutral-300">
              {result.movies.length
                ? `${result.movies.length} judul ditemukan untuk "${trimmedQuery}"`
                : `Belum ada hasil untuk "${trimmedQuery}"`}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              Ketik minimal 2 karakter untuk mulai mencari.
            </p>
          )}
        </div>
        {isRefreshing ? (
          <span className="hidden items-center gap-2 text-xs text-neutral-500 sm:inline-flex">
            <Loader2 className="size-3.5 animate-spin" />
            Memperbarui
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        {status === "loading" ? <SearchSkeleton /> : null}

        {status === "error" ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-white/10 bg-neutral-950 px-6 text-center">
            <p className="text-2xl font-semibold text-white">
              Pencarian belum berhasil
            </p>
            <p className="mt-3 max-w-md text-sm leading-6 text-neutral-400">
              {error ?? "Coba ulangi sebentar lagi."}
            </p>
            <Button
              type="button"
              className="mt-5 bg-red-600 text-white hover:bg-red-500"
              onClick={() => {
                searchCache.delete(getCacheKey(trimmedQuery, page));
                setRetryCount((value) => value + 1);
                setStatus("loading");
              }}
            >
              Coba lagi
            </Button>
          </div>
        ) : null}

        {status === "empty" && trimmedQuery.length >= 2 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-white/10 bg-neutral-950 px-6 text-center">
            <p className="text-2xl font-semibold text-white">
              Judul belum ditemukan
            </p>
            <p className="mt-3 max-w-md text-sm leading-6 text-neutral-400">
              Coba kata kunci lain, misalnya nama aktor, genre, atau potongan
              judul.
            </p>
          </div>
        ) : null}

        {hasResults ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {result?.movies.map((movie) => (
              <ResultCard key={movie.sourceUrl} movie={movie} />
            ))}
          </div>
        ) : null}
      </div>

      {result?.totalPages && result.totalPages > 1 ? (
        <div className="mt-7 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-neutral-400">
            Halaman {result.page} dari {Math.min(result.totalPages, 100)}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= Math.min(result.totalPages, 100)}
            onClick={() =>
              setPage((value) => Math.min(Math.min(result.totalPages ?? 1, 100), value + 1))
            }
          >
            Berikutnya
          </Button>
        </div>
      ) : null}
    </section>
  );
}
