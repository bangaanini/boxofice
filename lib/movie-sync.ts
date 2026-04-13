import { fetchHome, fetchNew, fetchPopular, type MovieListResult } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";

export type MovieFeedTarget = "home" | "popular" | "new";
export const DEFAULT_SYNC_PAGES = 3;
export const MAX_SYNC_PAGES = 20;

export type FeedSyncSummary = {
  target: MovieFeedTarget;
  fetched: number;
  upserted: number;
  deactivated: number;
  active: number;
  errors: string[];
};

export type CombinedSyncSummary = {
  totalFetched: number;
  totalUpserted: number;
  totalDeactivated: number;
  pages: number;
  targets: Record<MovieFeedTarget, FeedSyncSummary>;
};

const FEED_CONFIG: Record<
  MovieFeedTarget,
  {
    dbField: "inHome" | "inPopular" | "inNew";
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
  let totalPages = pages;

  for (let page = 1; page <= pages; page += 1) {
    const result = await fetcher(page);
    fetched += result.fetched;

    if (typeof result.totalPages === "number" && result.totalPages > 0) {
      totalPages = Math.min(totalPages, result.totalPages);
    }

    for (const movie of result.movies) {
      moviesBySource.set(movie.sourceUrl, movie);
    }

    if (page >= totalPages) {
      break;
    }
  }

  return {
    fetched,
    moviesBySource,
  };
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
    upserted: 0,
    deactivated: 0,
    active: sourceUrls.length,
    errors: [],
  };

  for (const movie of moviesBySource.values()) {
    try {
      const feedFlag = { [config.dbField]: true } as Record<
        typeof config.dbField,
        boolean
      >;

      await prisma.movie.upsert({
        where: {
          sourceUrl: movie.sourceUrl,
        },
        create: {
          sourceUrl: movie.sourceUrl,
          title: movie.title,
          thumbnail: movie.thumbnail,
          description: movie.description,
          rating: movie.rating,
          quality: movie.quality,
          ...feedFlag,
        },
        update: {
          title: movie.title,
          thumbnail: movie.thumbnail,
          description: movie.description,
          rating: movie.rating,
          quality: movie.quality,
          ...feedFlag,
        },
      });

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
    totalFetched: home.fetched + popular.fetched + latest.fetched,
    totalUpserted: home.upserted + popular.upserted + latest.upserted,
    totalDeactivated:
      home.deactivated + popular.deactivated + latest.deactivated,
    targets: {
      home,
      popular,
      new: latest,
    },
  };
}
