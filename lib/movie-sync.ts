import {
  fetchHome,
  fetchNew,
  fetchPopular,
  type MovieListResult,
} from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";

export type MovieFeedTarget = "home" | "popular" | "new";
export const DEFAULT_SYNC_PAGES = 3;
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

export type FeedSyncSummary = {
  target: MovieFeedTarget;
  fetched: number;
  created: number;
  existing: number;
  updated: number;
  unchanged: number;
  upserted: number;
  duplicateSkipped: number;
  deactivated: number;
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

async function fetchFeedPages(
  fetcher: (page?: number) => Promise<MovieListResult>,
  pages: number,
) {
  const moviesBySource = new Map<string, MovieListResult["movies"][number]>();
  let fetched = 0;
  let duplicateSkipped = 0;
  let totalPages = pages;

  for (let page = 1; page <= pages; page += 1) {
    const result = await fetcher(page);
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
    moviesBySource,
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

export async function syncMovieFeed(
  target: MovieFeedTarget,
  options: { pages?: number } = {},
): Promise<FeedSyncSummary> {
  const config = FEED_CONFIG[target];
  const pages = resolveSyncPages(options.pages);
  const feed = await fetchFeedPages(config.fetcher, pages);
  const moviesBySource = feed.moviesBySource;
  const sourceUrls = Array.from(moviesBySource.keys());
  const summary: FeedSyncSummary = {
    target,
    fetched: feed.fetched,
    created: 0,
    existing: 0,
    updated: 0,
    unchanged: 0,
    upserted: 0,
    duplicateSkipped: feed.duplicateSkipped,
    deactivated: 0,
    active: sourceUrls.length,
    errors: [],
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

  const deactivateData = { [config.dbField]: false } as Record<
    typeof config.dbField,
    boolean
  >;
  const deactivateResult = await prisma.movie.updateMany({
    where: sourceUrls.length
      ? {
          [config.dbField]: true,
          sourceUrl: {
            notIn: sourceUrls,
          },
        }
      : {
          [config.dbField]: true,
        },
    data: deactivateData,
  });

  summary.deactivated = deactivateResult.count;
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
    totalDeactivated:
      home.deactivated + popular.deactivated + latest.deactivated,
    targets: {
      home,
      popular,
      new: latest,
    },
  };
}
