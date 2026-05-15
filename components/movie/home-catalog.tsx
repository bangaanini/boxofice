"use client";

import * as React from "react";

import { triggerHaptic } from "@/components/feedback/haptic-feedback";
import { MovieCardLink } from "@/components/movie/movie-card-link";
import { Skeleton } from "@/components/ui/skeleton";
import type { HomepageFilters, MovieCard } from "@/lib/movie-feeds";

type HomeCatalogProps = {
  filters: HomepageFilters;
  initialMovies: MovieCard[];
  initialNextOffset: number | null;
};

type CatalogPayload = {
  items?: MovieCard[];
  nextOffset?: number | null;
};

const PAGE_SIZE = 24;
const prefetchedCatalogPages = new Map<string, CatalogPayload>();

function buildCatalogUrl(filters: HomepageFilters, offset: number) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });

  if (filters.genre?.trim()) {
    params.set("genre", filters.genre.trim());
  }

  if (filters.year?.trim()) {
    params.set("year", filters.year.trim());
  }

  return `/api/catalog?${params.toString()}`;
}

export function HomeCatalog({
  filters,
  initialMovies,
  initialNextOffset,
}: HomeCatalogProps) {
  const [movies, setMovies] = React.useState(initialMovies);
  const [isNearBottom, setIsNearBottom] = React.useState(false);
  const [nextOffset, setNextOffset] = React.useState<number | null>(
    initialNextOffset,
  );
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const prefetchAbortControllerRef = React.useRef<AbortController | null>(null);
  const isLoadingMoreRef = React.useRef(false);
  const nextOffsetRef = React.useRef<number | null>(initialNextOffset);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    nextOffsetRef.current = nextOffset;
  }, [nextOffset]);

  const getCatalogRequestKey = React.useCallback(
    (offset: number) => buildCatalogUrl(filters, offset),
    [filters],
  );

  const prefetchNextPage = React.useCallback(
    async (offset: number | null) => {
      if (offset === null) {
        return;
      }

      const requestKey = getCatalogRequestKey(offset);

      if (prefetchedCatalogPages.has(requestKey)) {
        return;
      }

      prefetchAbortControllerRef.current?.abort();
      const controller = new AbortController();
      prefetchAbortControllerRef.current = controller;

      try {
        const response = await fetch(requestKey, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | CatalogPayload
          | null;

        if (!response.ok || !payload) {
          return;
        }

        prefetchedCatalogPages.set(requestKey, payload);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
      } finally {
        if (prefetchAbortControllerRef.current === controller) {
          prefetchAbortControllerRef.current = null;
        }
      }
    },
    [getCatalogRequestKey],
  );

  const loadMore = React.useCallback(async () => {
    if (isLoadingMoreRef.current || nextOffsetRef.current === null) {
      return;
    }

    const currentOffset = nextOffsetRef.current;

    if (currentOffset === null) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadError(null);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestKey = getCatalogRequestKey(currentOffset);

    try {
      let payload = prefetchedCatalogPages.get(requestKey) ?? null;
      let responseOk = true;

      if (payload) {
        prefetchedCatalogPages.delete(requestKey);
      } else {
        const response = await fetch(requestKey, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        payload = (await response.json().catch(() => null)) as
          | CatalogPayload
          | null;
        responseOk = response.ok;
      }

      if (!responseOk) {
        throw new Error(
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Gagal memuat katalog berikutnya.",
        );
      }

      const incomingMovies = payload?.items ?? [];
      let appendedCount = 0;

      setMovies((current) => {
        const seen = new Set(current.map((movie) => movie.id));
        const merged = [...current];

        for (const movie of incomingMovies) {
          if (!seen.has(movie.id)) {
            merged.push(movie);
            seen.add(movie.id);
            appendedCount += 1;
          }
        }

        return merged;
      });
      setNextOffset(payload?.nextOffset ?? null);
      void prefetchNextPage(payload?.nextOffset ?? null);

      if (appendedCount > 0) {
        triggerHaptic("light");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setLoadError(
        error instanceof Error
          ? error.message
          : "Gagal memuat katalog berikutnya.",
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [getCatalogRequestKey, prefetchNextPage]);

  React.useEffect(() => {
    abortControllerRef.current?.abort();
    prefetchAbortControllerRef.current?.abort();
    setMovies(initialMovies);
    setNextOffset(initialNextOffset);
    setLoadError(null);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    nextOffsetRef.current = initialNextOffset;
    prefetchedCatalogPages.clear();
    void prefetchNextPage(initialNextOffset);
  }, [initialMovies, initialNextOffset, prefetchNextPage]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || nextOffset === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting) {
          setIsNearBottom(true);
          void loadMore();
          return;
        }

        setIsNearBottom(false);
      },
      {
        rootMargin: "1200px 0px 800px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadMore, nextOffset]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      prefetchAbortControllerRef.current?.abort();
    };
  }, []);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-2 sm:px-8 sm:pb-10 sm:pt-4 lg:px-10">
      {movies.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {movies.map((movie, index) => (
            <MovieCardLink
              key={movie.id}
              movie={movie}
              priority={index < 4}
              loading={index < 8 ? "eager" : "lazy"}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-white/15 bg-neutral-900/60 px-5 py-12 text-center">
          <p className="text-xl font-semibold text-white">
            Belum ada film yang cocok
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Coba ganti filter genre atau tahun supaya katalog kembali terisi.
          </p>
        </div>
      )}

      {isLoadingMore ? (
        <div className="pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+78px)] z-10 mt-5 flex justify-center sm:bottom-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-xs font-medium text-neutral-200 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            Memuat katalog berikutnya
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="mt-5 rounded-md border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {loadError}
          <button
            type="button"
            onClick={() => void loadMore()}
            className="ml-2 font-semibold text-white underline underline-offset-4"
          >
            Coba lagi
          </button>
        </div>
      ) : null}

      {nextOffset !== null ? (
        <div ref={sentinelRef} className="h-10 w-full" aria-hidden="true" />
      ) : movies.length ? (
        <p className="mt-6 text-center text-xs text-neutral-500">
          Semua judul yang cocok sudah tampil.
        </p>
      ) : null}

      {isNearBottom && !isLoadingMore && nextOffset !== null ? (
        <div className="mt-4 grid grid-cols-2 gap-3 opacity-60 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="aspect-[2/3] w-full rounded-[18px] bg-white/10" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
