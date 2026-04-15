import {
  fetchDetail,
  fetchHome,
  fetchNew,
  fetchPlayableStream,
  fetchPopular,
  type MovieDetail,
  type MovieListResult,
  type SanitizedStreamResponse,
} from "@/lib/movie-api";
import { formatMovieTitle } from "@/lib/movie-title";
import { prisma } from "@/lib/prisma";

export type MovieFeedTarget = "home" | "popular" | "new";
export const DEFAULT_SYNC_PAGE = 1;
export const DEFAULT_SYNC_PAGES = 3;
export const MAX_SYNC_PAGE = 5000;
export const MAX_SYNC_PAGES = 20;
const DEFAULT_SYNC_STREAM_VALIDATION_CONCURRENCY = 3;
const MAX_SYNC_STREAM_VALIDATION_CONCURRENCY = 8;
const DEFAULT_STREAM_CACHE_TTL_HOURS = 24;
const STREAM_REUSABLE_FRESH_MS = 15 * 60 * 1000;

type FeedDbField = "inHome" | "inPopular" | "inNew";

type ExistingSyncedMovie = {
  id: string;
  sourceUrl: string;
  title: string;
  thumbnail: string | null;
  description: string | null;
  genre: string | null;
  year: string | null;
  duration: string | null;
  rating: string | null;
  quality: string | null;
  releaseDate: string | null;
  actors: string[];
  directors: string[];
  streams: string | null;
  detailSyncedAt: Date | null;
  inHome: boolean;
  inPopular: boolean;
  inNew: boolean;
  streamCache: {
    checkedAt: Date;
    sources: unknown;
  } | null;
};

type MovieMetadataData = {
  title: string;
  thumbnail: string | null;
  description: string | null;
  genre: string | null;
  year: string | null;
  duration: string | null;
  rating: string | null;
  quality: string | null;
  releaseDate: string | null;
  actors: string[];
  directors: string[];
  streams: string | null;
  detailSyncedAt?: Date;
};

type FetchedFeedPages = {
  duplicateSkipped: number;
  fetched: number;
  hadFetchErrors: boolean;
  moviesBySource: Map<string, MovieListResult["movies"][number]>;
  pageErrors: string[];
};

export type FeedSyncSummary = {
  target: MovieFeedTarget;
  page?: number;
  pages?: number;
  fetched: number;
  created: number;
  existing: number;
  updated: number;
  unchanged: number;
  upserted: number;
  duplicateSkipped: number;
  skippedUnsupported: number;
  deactivated: number;
  hadFetchErrors: boolean;
  active: number;
  errors: string[];
};

export type CombinedSyncSummary = {
  totalFetched: number;
  totalCreated: number;
  totalExisting: number;
  totalUpdated: number;
  totalUnchanged: number;
  totalUpserted: number;
  totalDuplicateSkipped: number;
  totalSkippedUnsupported: number;
  totalDeactivated: number;
  pages: number;
  targets: Record<MovieFeedTarget, FeedSyncSummary>;
};

export type FeedAuditSummary = {
  target: MovieFeedTarget;
  checked: number;
  playable: number;
  broken: number;
  hidden: number;
  refreshed: number;
  errors: string[];
};

export type CombinedAuditSummary = {
  totalChecked: number;
  totalPlayable: number;
  totalBroken: number;
  totalHidden: number;
  totalRefreshed: number;
  totalErrors: number;
  targets: Record<MovieFeedTarget, FeedAuditSummary>;
  errors: string[];
};

export type TitleCleanupSummary = {
  changed: number;
  scanned: number;
  unchanged: number;
};

const FEED_CONFIG: Record<
  MovieFeedTarget,
  {
    dbField: FeedDbField;
    fetcher: (page?: number) => Promise<MovieListResult>;
  }
> = {
  home: {
    dbField: "inHome",
    fetcher: fetchHome,
  },
  popular: {
    dbField: "inPopular",
    fetcher: fetchPopular,
  },
  new: {
    dbField: "inNew",
    fetcher: fetchNew,
  },
};

export function resolveSyncPages(
  input: FormDataEntryValue | string | number | null | undefined,
) {
  const fallback = Number(process.env.SYNC_PAGES_PER_FEED ?? DEFAULT_SYNC_PAGES);
  const rawValue =
    typeof input === "string"
      ? Number(input)
      : typeof input === "number"
        ? input
        : fallback;
  const safeValue = Number.isFinite(rawValue) ? Math.trunc(rawValue) : fallback;

  if (safeValue < 1) {
    return 1;
  }

  return Math.min(safeValue, MAX_SYNC_PAGES);
}

export function resolveSyncPage(
  input: FormDataEntryValue | string | number | null | undefined,
) {
  const rawValue =
    typeof input === "string"
      ? Number(input)
      : typeof input === "number"
        ? input
        : DEFAULT_SYNC_PAGE;
  const safeValue = Number.isFinite(rawValue)
    ? Math.trunc(rawValue)
    : DEFAULT_SYNC_PAGE;

  if (safeValue < 1) {
    return DEFAULT_SYNC_PAGE;
  }

  return Math.min(safeValue, MAX_SYNC_PAGE);
}

async function fetchFeedPages(
  fetcher: (page?: number) => Promise<MovieListResult>,
  pages: number,
  startPage = 1,
): Promise<FetchedFeedPages> {
  const moviesBySource = new Map<string, MovieListResult["movies"][number]>();
  let fetched = 0;
  let duplicateSkipped = 0;
  const pageErrors: string[] = [];
  const endPage = startPage + pages - 1;
  let totalPages = endPage;

  for (let page = startPage; page <= endPage; page += 1) {
    let result: MovieListResult;

    try {
      result = await fetcher(page);
    } catch (error) {
      pageErrors.push(
        `Page ${page} gagal: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      break;
    }

    fetched += result.fetched;

    if (typeof result.totalPages === "number" && result.totalPages > 0) {
      totalPages = Math.min(totalPages, result.totalPages);
    }

    for (const movie of result.movies) {
      if (moviesBySource.has(movie.sourceUrl)) {
        duplicateSkipped += 1;
      }

      moviesBySource.set(movie.sourceUrl, movie);
    }

    if (page >= totalPages) {
      break;
    }
  }

  return {
    duplicateSkipped,
    fetched,
    hadFetchErrors: pageErrors.length > 0,
    moviesBySource,
    pageErrors,
  };
}

function mergeStringList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeMovieData(
  movie: MovieListResult["movies"][number],
  detail: MovieDetail | null,
  existing?: ExistingSyncedMovie,
): MovieMetadataData {
  const rawTitle = detail?.title ?? movie.title;

  return {
    title: formatMovieTitle(rawTitle, {
      sourceUrl: detail?.sourceUrl ?? movie.sourceUrl,
      year: movie.year ?? existing?.year,
    }),
    thumbnail: detail?.poster ?? movie.thumbnail ?? null,
    description:
      detail?.synopsis ?? movie.description ?? existing?.description ?? null,
    genre:
      detail?.genres.length
        ? mergeStringList(detail.genres)
        : movie.genre ?? existing?.genre ?? null,
    year: movie.year ?? existing?.year ?? null,
    duration: movie.duration ?? existing?.duration ?? null,
    rating: movie.rating ?? null,
    quality: movie.quality ?? null,
    releaseDate: detail?.releaseDate ?? existing?.releaseDate ?? null,
    actors: detail?.actors ?? existing?.actors ?? [],
    directors: detail?.directors ?? existing?.directors ?? [],
    streams: detail?.streams ?? existing?.streams ?? null,
    detailSyncedAt: detail ? new Date() : undefined,
  };
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function hasMovieChanged(
  existing: ExistingSyncedMovie,
  nextData: MovieMetadataData,
  dbField: FeedDbField,
) {
  return (
    existing.title !== nextData.title ||
    existing.thumbnail !== nextData.thumbnail ||
    existing.description !== nextData.description ||
    existing.genre !== nextData.genre ||
    existing.year !== nextData.year ||
    existing.duration !== nextData.duration ||
    existing.rating !== nextData.rating ||
    existing.quality !== nextData.quality ||
    existing.releaseDate !== nextData.releaseDate ||
    existing.streams !== nextData.streams ||
    !areStringArraysEqual(existing.actors, nextData.actors) ||
    !areStringArraysEqual(existing.directors, nextData.directors) ||
    existing[dbField] !== true
  );
}

function resolveStreamCacheTtlMs() {
  const rawValue = Number(
    process.env.STREAM_CACHE_TTL_HOURS ?? DEFAULT_STREAM_CACHE_TTL_HOURS,
  );
  const hours = Number.isFinite(rawValue)
    ? Math.max(1, Math.trunc(rawValue))
    : DEFAULT_STREAM_CACHE_TTL_HOURS;

  return hours * 60 * 60 * 1000;
}

function isStale(date: Date | null | undefined, ttlMs: number) {
  if (!date) {
    return true;
  }

  return Date.now() - date.getTime() > ttlMs;
}

function hasCachedStream(cache: ExistingSyncedMovie["streamCache"]) {
  return Array.isArray(cache?.sources) && cache.sources.length > 0;
}

function isReusableStreamFresh(cache: ExistingSyncedMovie["streamCache"]) {
  return Boolean(cache?.checkedAt) && !isStale(cache?.checkedAt, STREAM_REUSABLE_FRESH_MS);
}

async function fetchMovieEnrichment(sourceUrl: string) {
  let detail: MovieDetail | null = null;
  let stream: SanitizedStreamResponse | null = null;

  try {
    detail = await fetchDetail(sourceUrl, { revalidate: 1800 });
  } catch {
    detail = null;
  }

  try {
    stream = await fetchPlayableStream(sourceUrl, {
      revalidate: 1800,
    });
  } catch {
    stream = null;
  }

  return { detail, stream };
}

async function writeStreamCache(
  movieId: string,
  sourceUrl: string,
  stream: SanitizedStreamResponse,
) {
  await prisma.movieStreamCache.upsert({
    where: {
      movieId,
    },
    create: {
      movieId,
      sourceUrl,
      resolvedFrom: stream.resolvedFrom,
      originalUrl: stream.originalUrl,
      iframe: stream.iframe,
      m3u8: stream.m3u8,
      sources: stream.sources,
      checkedAt: new Date(),
    },
    update: {
      resolvedFrom: stream.resolvedFrom,
      originalUrl: stream.originalUrl,
      iframe: stream.iframe,
      m3u8: stream.m3u8,
      sources: stream.sources,
      checkedAt: new Date(),
    },
  });
}

async function clearStreamCache(movieId: string) {
  await prisma.movieStreamCache.deleteMany({
    where: {
      movieId,
    },
  });
}

async function hideMovieFromCatalog(movieId: string) {
  await prisma.movie.update({
    where: {
      id: movieId,
    },
    data: {
      inHome: false,
      inPopular: false,
      inNew: false,
    },
  });
}

function resolveValidationConcurrency() {
  const rawValue = Number(
    process.env.SYNC_STREAM_VALIDATION_CONCURRENCY ??
      DEFAULT_SYNC_STREAM_VALIDATION_CONCURRENCY,
  );
  const safeValue = Number.isFinite(rawValue)
    ? Math.trunc(rawValue)
    : DEFAULT_SYNC_STREAM_VALIDATION_CONCURRENCY;

  if (safeValue < 1) {
    return 1;
  }

  return Math.min(safeValue, MAX_SYNC_STREAM_VALIDATION_CONCURRENCY);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let index = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const item = items[index];
        index += 1;

        await worker(item);
      }
    }),
  );
}

export async function syncMovieFeed(
  target: MovieFeedTarget,
  options: { page?: number; pages?: number } = {},
): Promise<FeedSyncSummary> {
  const config = FEED_CONFIG[target];
  const page = resolveSyncPage(options.page);
  const pages = options.page ? 1 : resolveSyncPages(options.pages);
  const feed = await fetchFeedPages(config.fetcher, pages, options.page ? page : 1);
  const moviesBySource = feed.moviesBySource;
  const sourceUrls = Array.from(moviesBySource.keys());
  const summary: FeedSyncSummary = {
    target,
    page: options.page ? page : undefined,
    pages: options.page ? undefined : pages,
    fetched: feed.fetched,
    created: 0,
    existing: 0,
    updated: 0,
    unchanged: 0,
    upserted: 0,
    duplicateSkipped: feed.duplicateSkipped,
    skippedUnsupported: 0,
    deactivated: 0,
    hadFetchErrors: feed.hadFetchErrors,
    active: sourceUrls.length,
    errors: [...feed.pageErrors],
  };
  const existingMovies = await prisma.movie.findMany({
    where: {
      sourceUrl: {
        in: sourceUrls,
      },
    },
    select: {
      id: true,
      sourceUrl: true,
      title: true,
      thumbnail: true,
      description: true,
      genre: true,
      year: true,
      duration: true,
      rating: true,
      quality: true,
      releaseDate: true,
      actors: true,
      directors: true,
      streams: true,
      detailSyncedAt: true,
      inHome: true,
      inPopular: true,
      inNew: true,
      streamCache: {
        select: {
          checkedAt: true,
          sources: true,
        },
      },
    },
  });
  const existingBySource = new Map(
    existingMovies.map((movie) => [
      movie.sourceUrl,
      movie as ExistingSyncedMovie,
    ]),
  );

  await runWithConcurrency(
    Array.from(moviesBySource.values()),
    resolveValidationConcurrency(),
    async (movie) => {
      try {
        const feedFlag = { [config.dbField]: true } as Record<
          FeedDbField,
          true
        >;
        const existing = existingBySource.get(movie.sourceUrl);
        const hasReusableStream =
          existing?.[config.dbField] === true &&
          hasCachedStream(existing.streamCache) &&
          isReusableStreamFresh(existing.streamCache);
        const shouldFetchEnrichment =
          !hasReusableStream ||
          isStale(existing?.detailSyncedAt, resolveStreamCacheTtlMs());
        const enrichment = shouldFetchEnrichment
          ? await fetchMovieEnrichment(movie.sourceUrl)
          : { detail: null, stream: null };
        const nextData = normalizeMovieData(movie, enrichment.detail, existing);
        const hasPlayableStream =
          hasReusableStream || Boolean(enrichment.stream?.sources.length);

        if (!hasPlayableStream) {
          summary.skippedUnsupported += 1;

          if (existing?.[config.dbField]) {
            await prisma.movie.update({
              where: {
                sourceUrl: movie.sourceUrl,
              },
              data: {
                [config.dbField]: false,
              } as Record<FeedDbField, false>,
            });
            summary.deactivated += 1;
          }

          return;
        }

        if (!existing) {
          const createdMovie = await prisma.movie.create({
            data: {
              sourceUrl: movie.sourceUrl,
              ...nextData,
              ...feedFlag,
            },
            select: {
              id: true,
            },
          });

          if (enrichment.stream?.sources.length) {
            await writeStreamCache(createdMovie.id, movie.sourceUrl, enrichment.stream);
          }

          summary.created += 1;
          summary.upserted += 1;
          return;
        }

        summary.existing += 1;

        if (!hasMovieChanged(existing, nextData, config.dbField)) {
          if (enrichment.stream?.sources.length) {
            await writeStreamCache(existing.id, movie.sourceUrl, enrichment.stream);
            summary.updated += 1;
            summary.upserted += 1;
            return;
          }

          summary.unchanged += 1;
          return;
        }

        await prisma.movie.update({
          where: {
            sourceUrl: movie.sourceUrl,
          },
          data: {
            ...nextData,
            ...feedFlag,
          },
        });

        if (enrichment.stream?.sources.length) {
          await writeStreamCache(existing.id, movie.sourceUrl, enrichment.stream);
        }

        summary.updated += 1;
        summary.upserted += 1;
      } catch (error) {
        summary.errors.push(
          `Failed to upsert ${movie.sourceUrl}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    },
  );

  return summary;
}

function createAuditSummary(target: MovieFeedTarget): FeedAuditSummary {
  return {
    target,
    checked: 0,
    playable: 0,
    broken: 0,
    hidden: 0,
    refreshed: 0,
    errors: [],
  };
}

function activeTargetsForMovie(movie: {
  inHome: boolean;
  inPopular: boolean;
  inNew: boolean;
}) {
  const targets: MovieFeedTarget[] = [];

  if (movie.inHome) {
    targets.push("home");
  }

  if (movie.inPopular) {
    targets.push("popular");
  }

  if (movie.inNew) {
    targets.push("new");
  }

  return targets;
}

type AuditedMovie = {
  id: string;
  inHome: boolean;
  inNew: boolean;
  inPopular: boolean;
  sourceUrl: string;
  title: string;
};

async function resolveAuditedMovies(target: MovieFeedTarget | "all") {
  return prisma.movie.findMany({
    where:
      target === "all"
        ? {
            OR: [{ inHome: true }, { inPopular: true }, { inNew: true }],
          }
        : {
            [FEED_CONFIG[target].dbField]: true,
          },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      inHome: true,
      inNew: true,
      inPopular: true,
      sourceUrl: true,
      title: true,
    },
  });
}

export async function auditMovieCatalog(
  target: MovieFeedTarget | "all",
  options: { autoHide?: boolean } = {},
): Promise<FeedAuditSummary | CombinedAuditSummary> {
  const autoHide = options.autoHide ?? true;
  const movies = await resolveAuditedMovies(target);
  const targets: Record<MovieFeedTarget, FeedAuditSummary> = {
    home: createAuditSummary("home"),
    popular: createAuditSummary("popular"),
    new: createAuditSummary("new"),
  };
  const errors: string[] = [];
  const totals = {
    broken: 0,
    checked: 0,
    hidden: 0,
    playable: 0,
    refreshed: 0,
  };

  await runWithConcurrency(
    movies,
    resolveValidationConcurrency(),
    async (movie: AuditedMovie) => {
      const affectedTargets =
        target === "all" ? activeTargetsForMovie(movie) : [target];

      totals.checked += 1;
      affectedTargets.forEach((feedTarget) => {
        targets[feedTarget].checked += 1;
      });

      try {
        const stream = await fetchPlayableStream(movie.sourceUrl, {
          revalidate: 60,
        });

        if (!stream.sources.length) {
          totals.broken += 1;
          affectedTargets.forEach((feedTarget) => {
            targets[feedTarget].broken += 1;
          });

          await clearStreamCache(movie.id);

          if (autoHide) {
            await hideMovieFromCatalog(movie.id);
            totals.hidden += 1;
            affectedTargets.forEach((feedTarget) => {
              targets[feedTarget].hidden += 1;
            });
          }

          return;
        }

        await writeStreamCache(movie.id, movie.sourceUrl, stream);
        totals.playable += 1;
        totals.refreshed += 1;
        affectedTargets.forEach((feedTarget) => {
          targets[feedTarget].playable += 1;
          targets[feedTarget].refreshed += 1;
        });
      } catch (error) {
        const message = `Audit gagal untuk ${movie.title}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;

        errors.push(message);
        affectedTargets.forEach((feedTarget) => {
          targets[feedTarget].errors.push(message);
        });
      }
    },
  );

  if (target === "all") {
    return {
      totalChecked: totals.checked,
      totalPlayable: totals.playable,
      totalBroken: totals.broken,
      totalHidden: totals.hidden,
      totalRefreshed: totals.refreshed,
      totalErrors: errors.length,
      targets,
      errors,
    };
  }

  return targets[target];
}

export async function syncAllMovieFeeds(
  options: { pages?: number } = {},
): Promise<CombinedSyncSummary> {
  const pages = resolveSyncPages(options.pages);
  const home = await syncMovieFeed("home", { pages });
  const popular = await syncMovieFeed("popular", { pages });
  const latest = await syncMovieFeed("new", { pages });

  return {
    pages,
    totalCreated: home.created + popular.created + latest.created,
    totalExisting: home.existing + popular.existing + latest.existing,
    totalFetched: home.fetched + popular.fetched + latest.fetched,
    totalUpdated: home.updated + popular.updated + latest.updated,
    totalUnchanged: home.unchanged + popular.unchanged + latest.unchanged,
    totalUpserted: home.upserted + popular.upserted + latest.upserted,
    totalDuplicateSkipped:
      home.duplicateSkipped +
      popular.duplicateSkipped +
      latest.duplicateSkipped,
    totalSkippedUnsupported:
      home.skippedUnsupported +
      popular.skippedUnsupported +
      latest.skippedUnsupported,
    totalDeactivated:
      home.deactivated + popular.deactivated + latest.deactivated,
    targets: {
      home,
      popular,
      new: latest,
    },
  };
}

export async function cleanupMovieTitles(
  options: { batchSize?: number } = {},
): Promise<TitleCleanupSummary> {
  const batchSize = Math.min(Math.max(options.batchSize ?? 200, 25), 500);
  let cursor: string | undefined;
  const summary: TitleCleanupSummary = {
    changed: 0,
    scanned: 0,
    unchanged: 0,
  };

  while (true) {
    const movies = await prisma.movie.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        sourceUrl: true,
        title: true,
        year: true,
      },
      take: batchSize,
    });

    if (!movies.length) {
      break;
    }

    for (const movie of movies) {
      summary.scanned += 1;

      const nextTitle = formatMovieTitle(movie.title, {
        sourceUrl: movie.sourceUrl,
        year: movie.year,
      });

      if (nextTitle === movie.title) {
        summary.unchanged += 1;
        continue;
      }

      await prisma.movie.update({
        where: {
          id: movie.id,
        },
        data: {
          title: nextTitle,
        },
      });
      summary.changed += 1;
    }

    cursor = movies[movies.length - 1]?.id;

    if (movies.length < batchSize) {
      break;
    }
  }

  return summary;
}
