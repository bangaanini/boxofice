"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Play,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NormalizedMovieMetadata } from "@/lib/movie-api";
import {
  getSourceStreamCacheKey,
  prefetchCachedStream,
} from "@/lib/stream-cache-client";
import { cn } from "@/lib/utils";

type SearchResponse = {
  fetched: number;
  movies: NormalizedMovieMetadata[];
  page: number;
  totalPages?: number;
};

type SearchStatus = "idle" | "loading" | "ready" | "empty" | "error";

type UpstreamSearchProps = {
  initialQuery?: string;
  initialPage?: number;
};

const searchCache = new Map<string, SearchResponse>();
const quickSearches = ["Action", "Horror", "Korea", "Romance"];

function getCacheKey(query: string, page: number) {
  return `${query.trim().toLowerCase()}::${page}`;
}

function buildWatchHref(movie: NormalizedMovieMetadata) {
  const params = new URLSearchParams({
    sourceUrl: movie.sourceUrl,
    title: movie.title,
  });

  if (movie.thumbnail) {
    params.set("poster", movie.thumbnail);
  }

  if (movie.quality) {
    params.set("quality", movie.quality);
  }

  if (movie.rating) {
    params.set("rating", movie.rating);
  }

  return `/watch/source?${params.toString()}`;
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

function warmStream(movie: NormalizedMovieMetadata) {
  void prefetchCachedStream({
    cacheKey: getSourceStreamCacheKey(movie.sourceUrl),
    sourceUrl: movie.sourceUrl,
  }).catch(() => undefined);
}

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <div className="aspect-[2/3] animate-pulse rounded-md bg-neutral-900 ring-1 ring-white/10" />
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-neutral-900" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-neutral-900" />
        </div>
      ))}
    </div>
  );
}

function ResultCard({ movie }: { movie: NormalizedMovieMetadata }) {
  return (
    <Link
      href={buildWatchHref(movie)}
      prefetch={false}
      onPointerDown={() => warmStream(movie)}
      className="group outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-300 sm:hover:-translate-y-1"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-900 shadow-xl shadow-black/40 ring-1 ring-white/10">
        {movie.thumbnail ? (
          <Image
            src={movie.thumbnail}
            alt={`${movie.title} poster`}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 170px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-neutral-400">
            Poster belum tersedia
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {movie.quality ? (
              <Badge className="border-red-300/30 bg-red-600 text-white">
                {movie.quality}
              </Badge>
            ) : null}
            {movie.year ? (
              <Badge variant="secondary" className="bg-black/60">
                {movie.year}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2 px-1.5 py-3">
        <h3 className="line-clamp-2 min-h-9 text-xs font-semibold leading-[18px] text-white sm:min-h-10 sm:text-sm sm:leading-5">
          {movie.title}
        </h3>
        <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
          <span className="inline-flex min-w-0 items-center gap-1">
            <Star className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
            <span className="truncate">{movie.rating ?? "N/A"}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-red-300">
            <Play className="size-3.5 fill-current" />
            Tonton
          </span>
        </div>
        {movie.genre ? (
          <p className="line-clamp-1 text-[11px] text-neutral-500">
            {movie.genre}
          </p>
        ) : null}
      </div>
    </Link>
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
            Cari langsung dari LK21
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Temukan film yang ingin kamu tonton.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
            Hasil pencarian diambil langsung dari sumber terbaru, lalu video
            dibuka tanpa menunggu data tersimpan di database.
          </p>

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
