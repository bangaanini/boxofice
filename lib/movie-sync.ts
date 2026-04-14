import {
  fetchHome,
  fetchNew,
  fetchPlayableStream,
  fetchPopular,
  type MovieListResult,
} from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";

export type MovieFeedTarget = "home" | "popular" | "new";
export const DEFAULT_SYNC_PAGE = 1;
export const DEFAULT_SYNC_PAGES = 3;
export const MAX_SYNC_PAGE = 5000;
export const MAX_SYNC_PAGES = 20;

type FeedDbField = "inHome" | "inPopular" | "inNew";

type ExistingSyncedMovie = {
  sourceUrl: string;
  title: string;
  thumbnail: string | null;
  description: string | null;
  rating: string | null;
  quality: string | null;
  inHome: boolean;
  inPopular: boolean;
  inNew: boolean;
};

type MovieMetadataData = {
  title: string;
  thumbnail: string | null;
  description: string | null;
  rating: string | null;
  quality: string | null;
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

function normalizeMovieData(
  movie: MovieListResult["movies"][number],
): MovieMetadataData {
  return {
    title: movie.title,
    thumbnail: movie.thumbnail ?? null,
    description: movie.description ?? null,
    rating: movie.rating ?? null,
    quality: movie.quality ?? null,
  };
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
    existing.rating !== nextData.rating ||
    existing.quality !== nextData.quality ||
    existing[dbField] !== true
  );
}

async function hasPlayableInternalSource(sourceUrl: string) {
  try {
    const stream = await fetchPlayableStream(sourceUrl, { revalidate: 1800 });

    return stream.sources.length > 0;
  } catch {
    return false;
  }
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
      sourceUrl: true,
      title: true,
      thumbnail: true,
      description: true,
      rating: true,
      quality: true,
      inHome: true,
      inPopular: true,
      inNew: true,
    },
  });
  const existingBySource = new Map(
    existingMovies.map((movie) => [
      movie.sourceUrl,
      movie as ExistingSyncedMovie,
    ]),
  );

  for (const movie of moviesBySource.values()) {
    try {
      const nextData = normalizeMovieData(movie);
      const feedFlag = { [config.dbField]: true } as Record<FeedDbField, true>;
      const existing = existingBySource.get(movie.sourceUrl);
      const isPlayable = await hasPlayableInternalSource(movie.sourceUrl);

      if (!isPlayable) {
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

        continue;
      }

      if (!existing) {
        await prisma.movie.create({
          data: {
            sourceUrl: movie.sourceUrl,
            ...nextData,
            ...feedFlag,
          },
        });

        summary.created += 1;
        summary.upserted += 1;
        continue;
      }

      summary.existing += 1;

      if (!hasMovieChanged(existing, nextData, config.dbField)) {
        summary.unchanged += 1;
        continue;
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

      summary.updated += 1;
      summary.upserted += 1;
    } catch (error) {
      summary.errors.push(
        `Failed to upsert ${movie.sourceUrl}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  return summary;
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
