import {
  fetchDetail,
  fetchFilmboxHome,
  fetchTrending,
  type FilmboxHomeSection,
  type MovieDetail,
  type MovieListResult,
  type NormalizedMovieMetadata,
} from "@/lib/movie-api";
import { formatMovieTitle } from "@/lib/movie-title";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isBlockedMovieCandidate } from "@/lib/movie-visibility";
import {
  countEpisodesFromSeasons,
  normalizeSeasonsList,
} from "@/lib/season-utils";

export const DEFAULT_SYNC_PAGE = 0;
export const DEFAULT_SYNC_PAGES = 3;
export const MAX_SYNC_PAGE = 5000;
export const MAX_SYNC_PAGES = 20;
export const DEFAULT_TRENDING_PER_PAGE = 18;

const DEFAULT_SYNC_DETAIL_CONCURRENCY = 3;
const MAX_SYNC_DETAIL_CONCURRENCY = 8;
const DEFAULT_DETAIL_CACHE_TTL_HOURS = 24;

type ExistingSyncedMovie = {
  id: string;
  sourceUrl: string;
  detailPath: string | null;
  subjectId: string | null;
  subjectType: number;
  title: string;
  thumbnail: string | null;
  description: string | null;
  genre: string | null;
  year: string | null;
  duration: string | null;
  rating: string | null;
  quality: string | null;
  releaseDate: string | null;
  country: string | null;
  bahasa: string | null;
  hasIndonesianSubtitle: boolean;
  totalEpisode: number;
  totalSeason: number;
  seasonsList: unknown;
  trailerUrl: string | null;
  actors: string[];
  directors: string[];
  detailSyncedAt: Date | null;
  inHero: boolean;
  homeSections: string[];
};

type MovieMetadataData = {
  detailPath: string;
  subjectId: string;
  subjectType: number;
  title: string;
  thumbnail: string | null;
  description: string | null;
  genre: string | null;
  year: string | null;
  duration: string | null;
  rating: string | null;
  quality: string | null;
  releaseDate: string | null;
  country: string | null;
  bahasa: string | null;
  hasIndonesianSubtitle: boolean;
  totalEpisode: number;
  totalSeason: number;
  trailerUrl: string | null;
  actors: string[];
  directors: string[];
  seasonsList: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
  detailSyncedAt?: Date;
};

export type SyncCounters = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  skippedUnsupported: number;
  upserted: number;
  errors: string[];
};

export type FilmboxHomeSyncSummary = SyncCounters & {
  heroBanners: number;
  sections: { title: string; slug: string; items: number }[];
};

export type FilmboxTrendingSyncSummary = SyncCounters & {
  fromPage: number;
  toPage: number;
  perPage: number;
};

export type FilmboxHomeBatchSyncSummary = FilmboxHomeSyncSummary & {
  offset: number;
  limit: number;
  totalMovies: number;
  processed: number;
  nextOffset: number;
  done: boolean;
};

export type FilmboxTrendingBatchSyncSummary = SyncCounters & {
  page: number;
  perPage: number;
  offset: number;
  limit: number;
  totalMovies: number;
  processed: number;
  nextOffset: number;
  done: boolean;
  pageFailed: boolean;
};

export type TitleCleanupSummary = {
  changed: number;
  scanned: number;
  unchanged: number;
};

const MOVIE_SELECT = {
  id: true,
  sourceUrl: true,
  detailPath: true,
  subjectId: true,
  subjectType: true,
  title: true,
  thumbnail: true,
  description: true,
  genre: true,
  year: true,
  duration: true,
  rating: true,
  quality: true,
  releaseDate: true,
  country: true,
  bahasa: true,
  hasIndonesianSubtitle: true,
  totalEpisode: true,
  totalSeason: true,
  seasonsList: true,
  trailerUrl: true,
  actors: true,
  directors: true,
  detailSyncedAt: true,
  inHero: true,
  homeSections: true,
} as const;

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

  if (safeValue < 0) {
    return DEFAULT_SYNC_PAGE;
  }

  return Math.min(safeValue, MAX_SYNC_PAGE);
}

function resolvePerPage(
  input: FormDataEntryValue | string | number | null | undefined,
) {
  const rawValue =
    typeof input === "string"
      ? Number(input)
      : typeof input === "number"
        ? input
        : DEFAULT_TRENDING_PER_PAGE;
  const safeValue = Number.isFinite(rawValue)
    ? Math.trunc(rawValue)
    : DEFAULT_TRENDING_PER_PAGE;

  return Math.min(Math.max(safeValue, 1), 60);
}

function resolveBatchLimit(
  input: FormDataEntryValue | string | number | null | undefined,
  fallback: number,
) {
  const rawValue =
    typeof input === "string"
      ? Number(input)
      : typeof input === "number"
        ? input
        : fallback;
  const safeValue = Number.isFinite(rawValue)
    ? Math.trunc(rawValue)
    : fallback;

  return Math.min(Math.max(safeValue, 1), 60);
}

function resolveDetailTtlMs() {
  const rawValue = Number(
    process.env.STREAM_CACHE_TTL_HOURS ??
      process.env.DETAIL_CACHE_TTL_HOURS ??
      DEFAULT_DETAIL_CACHE_TTL_HOURS,
  );
  const hours = Number.isFinite(rawValue)
    ? Math.max(1, Math.trunc(rawValue))
    : DEFAULT_DETAIL_CACHE_TTL_HOURS;

  return hours * 60 * 60 * 1000;
}

function isStale(date: Date | null | undefined, ttlMs: number) {
  if (!date) {
    return true;
  }

  return Date.now() - date.getTime() > ttlMs;
}

function resolveDetailConcurrency() {
  const rawValue = Number(
    process.env.SYNC_STREAM_VALIDATION_CONCURRENCY ??
      process.env.SYNC_DETAIL_CONCURRENCY ??
      DEFAULT_SYNC_DETAIL_CONCURRENCY,
  );
  const safeValue = Number.isFinite(rawValue)
    ? Math.trunc(rawValue)
    : DEFAULT_SYNC_DETAIL_CONCURRENCY;

  if (safeValue < 1) {
    return 1;
  }

  return Math.min(safeValue, MAX_SYNC_DETAIL_CONCURRENCY);
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

function mergeStringList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const set = new Set(left);

  for (const value of right) {
    if (!set.has(value)) {
      return false;
    }
  }

  return true;
}

function getStoredSeasonsListInput(existing?: ExistingSyncedMovie) {
  const seasonsList = normalizeSeasonsList(existing?.seasonsList);

  return seasonsList
    ? (seasonsList as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;
}

function hasSeriesEpisodeMetadataGap(
  movie: NormalizedMovieMetadata,
  existing?: ExistingSyncedMovie,
) {
  const subjectType = existing?.subjectType ?? movie.subjectType;

  if (subjectType !== 2) {
    return false;
  }

  const seasonsList = normalizeSeasonsList(existing?.seasonsList);
  const episodeCount = countEpisodesFromSeasons(seasonsList);

  return !seasonsList?.length || !episodeCount;
}

function seasonsListChanged(
  existing: ExistingSyncedMovie,
  next: MovieMetadataData,
) {
  return (
    JSON.stringify(normalizeSeasonsList(existing.seasonsList)) !==
    JSON.stringify(normalizeSeasonsList(next.seasonsList))
  );
}

function normalizeMovieData(
  movie: NormalizedMovieMetadata,
  detail: MovieDetail | null,
  existing?: ExistingSyncedMovie,
): MovieMetadataData {
  const rawTitle = detail?.title ?? movie.title;
  const releaseDate =
    detail?.releaseDate ?? movie.releaseDate ?? existing?.releaseDate ?? null;
  const yearFromRelease = releaseDate ? releaseDate.slice(0, 4) : null;
  const year = movie.year ?? yearFromRelease ?? existing?.year ?? null;
  const bahasa = detail?.bahasa ?? movie.bahasa ?? existing?.bahasa ?? null;
  const detailSeasonsList = normalizeSeasonsList(detail?.seasonsList);
  const existingSeasonsList = normalizeSeasonsList(existing?.seasonsList);
  const effectiveSeasonsList = detailSeasonsList ?? existingSeasonsList;
  const totalEpisodeFromSeasons =
    countEpisodesFromSeasons(effectiveSeasonsList);
  const totalEpisode = Math.max(
    detail?.totalEpisode ??
      existing?.totalEpisode ??
      movie.totalEpisode ??
      1,
    totalEpisodeFromSeasons ?? 1,
  );
  const totalSeason = Math.max(
    detail?.totalSeason ?? existing?.totalSeason ?? movie.totalSeason ?? 1,
    effectiveSeasonsList?.length ?? 1,
  );

  return {
    detailPath: detail?.detailPath ?? movie.detailPath,
    subjectId: detail?.subjectId ?? movie.subjectId,
    subjectType: detail?.subjectType ?? movie.subjectType ?? 1,
    title: formatMovieTitle(rawTitle, {
      sourceUrl: detail?.sourceUrl ?? movie.sourceUrl,
      year,
    }),
    thumbnail: detail?.poster ?? movie.thumbnail ?? existing?.thumbnail ?? null,
    description:
      detail?.synopsis ?? movie.description ?? existing?.description ?? null,
    genre: detail?.genres.length
      ? mergeStringList(detail.genres)
      : movie.genre ?? existing?.genre ?? null,
    year,
    duration: movie.duration ?? existing?.duration ?? null,
    rating: detail?.rating ?? movie.rating ?? existing?.rating ?? null,
    quality: movie.quality ?? existing?.quality ?? null,
    releaseDate,
    country: detail?.country ?? movie.country ?? existing?.country ?? null,
    bahasa,
    hasIndonesianSubtitle:
      detail?.hasIndonesianSubtitle ??
      movie.hasIndonesianSubtitle ??
      existing?.hasIndonesianSubtitle ??
      false,
    totalEpisode,
    totalSeason,
    trailerUrl: detail?.trailerUrl ?? existing?.trailerUrl ?? null,
    actors: existing?.actors ?? [],
    directors: existing?.directors ?? [],
    seasonsList: detailSeasonsList
      ? (detailSeasonsList as unknown as Prisma.InputJsonValue)
      : getStoredSeasonsListInput(existing),
    detailSyncedAt: detail ? new Date() : undefined,
  };
}

function hasMovieChanged(
  existing: ExistingSyncedMovie,
  next: MovieMetadataData,
  inHero: boolean,
  homeSections: string[],
) {
  return (
    existing.title !== next.title ||
    existing.thumbnail !== next.thumbnail ||
    existing.description !== next.description ||
    existing.genre !== next.genre ||
    existing.year !== next.year ||
    existing.releaseDate !== next.releaseDate ||
    existing.duration !== next.duration ||
    existing.rating !== next.rating ||
    existing.country !== next.country ||
    existing.bahasa !== next.bahasa ||
    existing.hasIndonesianSubtitle !== next.hasIndonesianSubtitle ||
    existing.totalEpisode !== next.totalEpisode ||
    existing.totalSeason !== next.totalSeason ||
    seasonsListChanged(existing, next) ||
    existing.trailerUrl !== next.trailerUrl ||
    existing.detailPath !== next.detailPath ||
    existing.subjectId !== next.subjectId ||
    existing.subjectType !== next.subjectType ||
    existing.inHero !== inHero ||
    !arraysEqual(existing.homeSections, homeSections)
  );
}

async function fetchDetailQuietly(detailPath: string) {
  try {
    return await fetchDetail(detailPath, { revalidate: 1800 });
  } catch (error) {
    console.error(`Failed to fetch detail for ${detailPath}`, error);
    return null;
  }
}

type UpsertContext = {
  inHero: boolean;
  homeSections: string[];
};

async function upsertMovieFromMetadata(
  movie: NormalizedMovieMetadata,
  existingMap: Map<string, ExistingSyncedMovie>,
  counters: SyncCounters,
  context: UpsertContext,
) {
  try {
    const existing = existingMap.get(movie.sourceUrl);

    if (
      isBlockedMovieCandidate({
        description: movie.description,
        sourceUrl: movie.sourceUrl,
        thumbnail: movie.thumbnail,
        title: movie.title,
      })
    ) {
      counters.skippedUnsupported += 1;
      return;
    }

    const ttlMs = resolveDetailTtlMs();
    const needsDetail =
      !existing ||
      isStale(existing.detailSyncedAt, ttlMs) ||
      !existing.subjectId ||
      hasSeriesEpisodeMetadataGap(movie, existing);
    const detail = needsDetail
      ? await fetchDetailQuietly(movie.sourceUrl)
      : null;
    const nextData = normalizeMovieData(movie, detail, existing);

    if (
      isBlockedMovieCandidate({
        description: nextData.description,
        sourceUrl: movie.sourceUrl,
        thumbnail: nextData.thumbnail,
        title: nextData.title,
      })
    ) {
      counters.skippedUnsupported += 1;
      return;
    }

    if (!existing) {
      const created = await prisma.movie.create({
        data: {
          sourceUrl: movie.sourceUrl,
          ...nextData,
          inHero: context.inHero,
          homeSections: context.homeSections,
        },
        select: { id: true },
      });

      counters.created += 1;
      counters.upserted += 1;
      existingMap.set(movie.sourceUrl, {
        id: created.id,
        sourceUrl: movie.sourceUrl,
        detailPath: nextData.detailPath,
        subjectId: nextData.subjectId,
        subjectType: nextData.subjectType,
        title: nextData.title,
        thumbnail: nextData.thumbnail,
        description: nextData.description,
        genre: nextData.genre,
        year: nextData.year,
        duration: nextData.duration,
        rating: nextData.rating,
        quality: nextData.quality,
        releaseDate: nextData.releaseDate,
        country: nextData.country,
        bahasa: nextData.bahasa,
        hasIndonesianSubtitle: nextData.hasIndonesianSubtitle,
        totalEpisode: nextData.totalEpisode,
        totalSeason: nextData.totalSeason,
        seasonsList: normalizeSeasonsList(nextData.seasonsList),
        trailerUrl: nextData.trailerUrl,
        actors: nextData.actors,
        directors: nextData.directors,
        detailSyncedAt: nextData.detailSyncedAt ?? null,
        inHero: context.inHero,
        homeSections: context.homeSections,
      });
      return;
    }

    if (
      !hasMovieChanged(existing, nextData, context.inHero, context.homeSections)
    ) {
      counters.unchanged += 1;
      return;
    }

    await prisma.movie.update({
      where: { sourceUrl: movie.sourceUrl },
      data: {
        ...nextData,
        inHero: context.inHero,
        homeSections: context.homeSections,
      },
    });

    counters.updated += 1;
    counters.upserted += 1;
    existingMap.set(movie.sourceUrl, {
      ...existing,
      ...nextData,
      detailSyncedAt: nextData.detailSyncedAt ?? existing.detailSyncedAt,
      homeSections: context.homeSections,
      inHero: context.inHero,
      seasonsList: normalizeSeasonsList(nextData.seasonsList),
      sourceUrl: movie.sourceUrl,
    });
  } catch (error) {
    counters.errors.push(
      `Failed to upsert ${movie.sourceUrl}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

function emptyCounters(): SyncCounters {
  return {
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skippedUnsupported: 0,
    upserted: 0,
    errors: [],
  };
}

function buildSectionContext(
  sourceUrl: string,
  heroSet: Set<string>,
  sectionsBySource: Map<string, Set<string>>,
): UpsertContext {
  return {
    inHero: heroSet.has(sourceUrl),
    homeSections: Array.from(
      sectionsBySource.get(sourceUrl) ?? new Set<string>(),
    ),
  };
}

function combineHomeMovies(
  heroBanners: NormalizedMovieMetadata[],
  sections: FilmboxHomeSection[],
) {
  const heroSet = new Set<string>();
  const sectionsBySource = new Map<string, Set<string>>();
  const moviesBySource = new Map<string, NormalizedMovieMetadata>();

  for (const banner of heroBanners) {
    heroSet.add(banner.sourceUrl);
    moviesBySource.set(banner.sourceUrl, banner);
  }

  for (const section of sections) {
    for (const item of section.items) {
      moviesBySource.set(item.sourceUrl, item);
      const existing = sectionsBySource.get(item.sourceUrl);

      if (existing) {
        existing.add(section.slug);
      } else {
        sectionsBySource.set(item.sourceUrl, new Set([section.slug]));
      }
    }
  }

  return { heroSet, sectionsBySource, moviesBySource };
}

export async function syncFilmboxHomeBatch(
  options: { offset?: number; limit?: number } = {},
): Promise<FilmboxHomeBatchSyncSummary> {
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const limit = resolveBatchLimit(options.limit, 9);
  const home = await fetchFilmboxHome();
  const { heroSet, sectionsBySource, moviesBySource } = combineHomeMovies(
    home.heroBanners,
    home.sections,
  );
  const allMovies = Array.from(moviesBySource.values());
  const batchMovies = allMovies.slice(offset, offset + limit);
  const counters = emptyCounters();
  counters.fetched = batchMovies.length;

  const sourceUrls = batchMovies.map((movie) => movie.sourceUrl);
  const existing = sourceUrls.length
    ? await prisma.movie.findMany({
        where: { sourceUrl: { in: sourceUrls } },
        select: MOVIE_SELECT,
      })
    : [];
  const existingMap = new Map(
    existing.map((entry) => [entry.sourceUrl, entry as ExistingSyncedMovie]),
  );

  await runWithConcurrency(
    batchMovies,
    resolveDetailConcurrency(),
    async (movie) => {
      const context = buildSectionContext(
        movie.sourceUrl,
        heroSet,
        sectionsBySource,
      );
      await upsertMovieFromMetadata(movie, existingMap, counters, context);
    },
  );

  const nextOffset = Math.min(offset + batchMovies.length, allMovies.length);

  return {
    ...counters,
    heroBanners: home.heroBanners.length,
    sections: home.sections.map((section) => ({
      slug: section.slug,
      title: section.title,
      items: section.items.length,
    })),
    offset,
    limit,
    totalMovies: allMovies.length,
    processed: batchMovies.length,
    nextOffset,
    done: nextOffset >= allMovies.length,
  };
}

export async function syncFilmboxHome(): Promise<FilmboxHomeSyncSummary> {
  const home = await fetchFilmboxHome();
  const { heroSet, sectionsBySource, moviesBySource } = combineHomeMovies(
    home.heroBanners,
    home.sections,
  );
  const counters = emptyCounters();
  counters.fetched = moviesBySource.size;

  const sourceUrls = Array.from(moviesBySource.keys());
  const existing = sourceUrls.length
    ? await prisma.movie.findMany({
        where: { sourceUrl: { in: sourceUrls } },
        select: MOVIE_SELECT,
      })
    : [];
  const existingMap = new Map(
    existing.map((entry) => [entry.sourceUrl, entry as ExistingSyncedMovie]),
  );

  await runWithConcurrency(
    Array.from(moviesBySource.values()),
    resolveDetailConcurrency(),
    async (movie) => {
      const context = buildSectionContext(
        movie.sourceUrl,
        heroSet,
        sectionsBySource,
      );
      await upsertMovieFromMetadata(movie, existingMap, counters, context);
    },
  );

  return {
    ...counters,
    heroBanners: home.heroBanners.length,
    sections: home.sections.map((section) => ({
      slug: section.slug,
      title: section.title,
      items: section.items.length,
    })),
  };
}

export async function syncTrendingPageBatch(options: {
  page?: number;
  perPage?: number;
  offset?: number;
  limit?: number;
}): Promise<FilmboxTrendingBatchSyncSummary> {
  const page = resolveSyncPage(options.page ?? 0);
  const perPage = resolvePerPage(options.perPage ?? DEFAULT_TRENDING_PER_PAGE);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const limit = resolveBatchLimit(options.limit, 9);
  const counters = emptyCounters();
  let result: MovieListResult;

  try {
    result = await fetchTrending(page, perPage);
  } catch (error) {
    counters.errors.push(
      `Page ${page} gagal: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );

    return {
      ...counters,
      page,
      perPage,
      offset,
      limit,
      totalMovies: 0,
      processed: 0,
      nextOffset: 0,
      done: true,
      pageFailed: true,
    };
  }

  const batchMovies = Array.from(
    new Map(
      result.movies
        .slice(offset, offset + limit)
        .map((movie) => [movie.sourceUrl, movie]),
    ).values(),
  );
  counters.fetched = batchMovies.length;

  const sourceUrls = batchMovies.map((movie) => movie.sourceUrl);
  const existing = sourceUrls.length
    ? await prisma.movie.findMany({
        where: { sourceUrl: { in: sourceUrls } },
        select: MOVIE_SELECT,
      })
    : [];
  const existingMap = new Map(
    existing.map((entry) => [entry.sourceUrl, entry as ExistingSyncedMovie]),
  );

  await runWithConcurrency(
    batchMovies,
    resolveDetailConcurrency(),
    async (movie) => {
      const existingEntry = existingMap.get(movie.sourceUrl);
      const context: UpsertContext = {
        inHero: existingEntry?.inHero ?? false,
        homeSections: existingEntry?.homeSections ?? [],
      };
      await upsertMovieFromMetadata(movie, existingMap, counters, context);
    },
  );

  const nextOffset = Math.min(
    offset + Math.max(batchMovies.length, limit),
    result.movies.length,
  );

  return {
    ...counters,
    page,
    perPage,
    offset,
    limit,
    totalMovies: result.movies.length,
    processed: batchMovies.length,
    nextOffset,
    done: nextOffset >= result.movies.length,
    pageFailed: false,
  };
}

export async function syncTrendingPages(options: {
  fromPage?: number;
  toPage?: number;
  perPage?: number;
}): Promise<FilmboxTrendingSyncSummary> {
  const fromPage = resolveSyncPage(options.fromPage ?? 0);
  const toPageRaw = resolveSyncPage(options.toPage ?? fromPage);
  const toPage = Math.max(fromPage, toPageRaw);
  const perPage = resolvePerPage(options.perPage ?? DEFAULT_TRENDING_PER_PAGE);
  const counters = emptyCounters();
  const collected = new Map<string, NormalizedMovieMetadata>();

  for (let page = fromPage; page <= toPage; page += 1) {
    let result: MovieListResult;

    try {
      result = await fetchTrending(page, perPage);
    } catch (error) {
      counters.errors.push(
        `Page ${page} gagal: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      break;
    }

    counters.fetched += result.fetched;

    for (const movie of result.movies) {
      collected.set(movie.sourceUrl, movie);
    }

    if (result.movies.length === 0) {
      break;
    }
  }

  const sourceUrls = Array.from(collected.keys());
  const existing = sourceUrls.length
    ? await prisma.movie.findMany({
        where: { sourceUrl: { in: sourceUrls } },
        select: MOVIE_SELECT,
      })
    : [];
  const existingMap = new Map(
    existing.map((entry) => [entry.sourceUrl, entry as ExistingSyncedMovie]),
  );

  await runWithConcurrency(
    Array.from(collected.values()),
    resolveDetailConcurrency(),
    async (movie) => {
      const existingEntry = existingMap.get(movie.sourceUrl);
      const context: UpsertContext = {
        inHero: existingEntry?.inHero ?? false,
        homeSections: existingEntry?.homeSections ?? [],
      };
      await upsertMovieFromMetadata(movie, existingMap, counters, context);
    },
  );

  return {
    ...counters,
    fromPage,
    toPage,
    perPage,
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
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: { id: "asc" },
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
        where: { id: movie.id },
        data: { title: nextTitle },
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
