import { unstable_cache } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  excludeBlockedMoviesWhere,
  isBlockedMovieCandidate,
} from "@/lib/movie-visibility";

export type MovieCard = {
  id: string;
  title: string;
  thumbnail: string | null;
  rating: string | null;
  quality: string | null;
};

export type BackdropMovie = {
  id: string;
  thumbnail: string;
  title: string;
};

export type RelatedMovieInput = {
  currentMovieId: string;
  genre?: string | null;
  subjectType?: number | null;
  homeSections?: string[] | null;
  limit?: number;
};

export type SeasonInfo = {
  season: number;
  totalEpisodes: number;
  episodes: number[];
};

export type MovieDetailData = {
  actors: string[];
  description: string | null;
  directors: string[];
  duration: string | null;
  genre: string | null;
  id: string;
  detailPath: string | null;
  subjectId: string | null;
  subjectType: number;
  inHero: boolean;
  homeSections: string[];
  quality: string | null;
  rating: string | null;
  releaseDate: string | null;
  country: string | null;
  bahasa: string | null;
  hasIndonesianSubtitle: boolean;
  totalEpisode: number;
  totalSeason: number;
  seasonsList: SeasonInfo[] | null;
  trailerUrl: string | null;
  thumbnail: string | null;
  title: string;
  year: string | null;
};

export type HomepageFilters = {
  genre?: string | null;
  year?: string | null;
};

export type HomepageFilterOptions = {
  genres: string[];
  years: string[];
};

export type CatalogPage = {
  items: MovieCard[];
  nextOffset: number | null;
  totalMovies: number;
};

export type BroadcastMovieCard = {
  description: string | null;
  id: string;
  rating: string | null;
  thumbnail: string | null;
  title: string;
  year: string | null;
};

export type HomepageSection = {
  title: string;
  slug: string;
  movies: MovieCard[];
};

export type HomepageData = {
  heroBanners: BackdropMovie[];
  sections: HomepageSection[];
  totalMovies: number;
};

const FEED_REVALIDATE_SECONDS = 60 * 5;
const FILTER_REVALIDATE_SECONDS = 60 * 10;
const MAX_HERO_BANNERS = 12;
const MAX_SECTION_ITEMS = 18;

function normalizeFilterValue(value?: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeSeasonsList(value: unknown): SeasonInfo[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seasons: SeasonInfo[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const seasonNumber = Number(record.season);
    const totalEpisodes = Number(record.totalEpisodes ?? record.total_episodes);
    const rawEpisodes = Array.isArray(record.episodes) ? record.episodes : [];
    const episodes: number[] = [];

    for (const ep of rawEpisodes) {
      const parsed = Number(ep);

      if (Number.isFinite(parsed)) {
        episodes.push(parsed);
      }
    }

    if (!Number.isFinite(seasonNumber)) {
      continue;
    }

    seasons.push({
      season: seasonNumber,
      totalEpisodes: Number.isFinite(totalEpisodes)
        ? totalEpisodes
        : episodes.length,
      episodes,
    });
  }

  return seasons.length ? seasons : null;
}

function getCatalogWhere(filters: HomepageFilters = {}): Prisma.MovieWhereInput {
  const genre = normalizeFilterValue(filters.genre);
  const year = normalizeFilterValue(filters.year);

  return excludeBlockedMoviesWhere({
    ...(genre
      ? {
          genre: {
            contains: genre,
            mode: "insensitive",
          },
        }
      : {}),
    ...(year ? { year } : {}),
  });
}

const CATALOG_ORDER_BY: Prisma.MovieOrderByWithRelationInput[] = [
  { inHero: "desc" },
  { updatedAt: "desc" },
  { id: "desc" },
];

const getCatalogPageCached = unstable_cache(
  async (
    offset: number,
    limit: number,
    genre?: string | null,
    year?: string | null,
  ): Promise<CatalogPage> => {
    const where = getCatalogWhere({ genre, year });
    const items = await prisma.movie.findMany({
      where,
      orderBy: CATALOG_ORDER_BY,
      skip: offset,
      take: limit + 1,
      select: {
        id: true,
        quality: true,
        rating: true,
        thumbnail: true,
        title: true,
      },
    });
    const hasMore = items.length > limit;
    const visibleItems = hasMore ? items.slice(0, limit) : items;

    return {
      items: visibleItems,
      nextOffset: hasMore ? offset + visibleItems.length : null,
      totalMovies: offset + visibleItems.length + (hasMore ? 1 : 0),
    };
  },
  ["catalog-page-data"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

const getHomepageBroadcastMoviesCached = unstable_cache(
  async (limit: number): Promise<BroadcastMovieCard[]> => {
    return prisma.movie.findMany({
      where: getCatalogWhere(),
      orderBy: CATALOG_ORDER_BY,
      take: limit,
      select: {
        description: true,
        id: true,
        rating: true,
        thumbnail: true,
        title: true,
        year: true,
      },
    });
  },
  ["homepage-broadcast-movies"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getCatalogPage(
  options: HomepageFilters & {
    limit?: number;
    offset?: number;
  } = {},
): Promise<CatalogPage> {
  const limit = Math.max(1, Math.min(options.limit ?? 18, 30));
  const offset = Math.max(0, options.offset ?? 0);
  const genre = normalizeFilterValue(options.genre);
  const year = normalizeFilterValue(options.year);

  try {
    return await getCatalogPageCached(offset, limit, genre, year);
  } catch (error) {
    console.error("Failed to load catalog page", error);

    return {
      items: [],
      nextOffset: null,
      totalMovies: 0,
    };
  }
}

export async function getHomepageBroadcastMovies(
  limit = 20,
): Promise<BroadcastMovieCard[]> {
  const safeLimit = Math.max(1, Math.min(limit, 30));

  try {
    return await getHomepageBroadcastMoviesCached(safeLimit);
  } catch (error) {
    console.error("Failed to load homepage broadcast movies", error);
    return [];
  }
}

function slugToDisplay(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const getHomepageDataCached = unstable_cache(
  async (): Promise<HomepageData> => {
    const [heroBanners, totalMovies, sectionAggregates] = await Promise.all([
      prisma.movie.findMany({
        where: excludeBlockedMoviesWhere({
          inHero: true,
          thumbnail: { not: null },
        }),
        orderBy: { updatedAt: "desc" },
        take: MAX_HERO_BANNERS,
        select: {
          id: true,
          thumbnail: true,
          title: true,
        },
      }) as Promise<BackdropMovie[]>,
      prisma.movie.count({ where: excludeBlockedMoviesWhere({}) }),
      prisma.$queryRaw<{ slug: string; movie_count: bigint }[]>`
        SELECT slug, COUNT(*)::bigint AS movie_count
        FROM (
          SELECT unnest("homeSections") AS slug
          FROM "Movie"
          WHERE array_length("homeSections", 1) > 0
        ) AS expanded
        GROUP BY slug
        ORDER BY movie_count DESC
        LIMIT 30
      `,
    ]);

    const slugs = sectionAggregates.map((row) => row.slug).filter(Boolean);
    const sections: HomepageSection[] = [];

    if (slugs.length) {
      const sectionResults = await Promise.all(
        slugs.map((slug) =>
          prisma.movie
            .findMany({
              where: excludeBlockedMoviesWhere({
                homeSections: { has: slug },
              }),
              orderBy: { updatedAt: "desc" },
              take: MAX_SECTION_ITEMS,
              select: {
                id: true,
                title: true,
                thumbnail: true,
                rating: true,
                quality: true,
              },
            })
            .then((movies) => ({ slug, movies })),
        ),
      );

      for (const { slug, movies } of sectionResults) {
        if (!movies.length) {
          continue;
        }

        sections.push({
          slug,
          title: slugToDisplay(slug),
          movies,
        });
      }
    }

    return {
      heroBanners,
      sections,
      totalMovies,
    };
  },
  ["homepage-filmbox-data"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getHomepageData(): Promise<HomepageData> {
  try {
    return await getHomepageDataCached();
  } catch (error) {
    console.error("Failed to load homepage data", error);
    return {
      heroBanners: [],
      sections: [],
      totalMovies: 0,
    };
  }
}

const getMoviesByHomeSectionCached = unstable_cache(
  async (
    slug: string,
    offset: number,
    limit: number,
  ): Promise<CatalogPage> => {
    const items = await prisma.movie.findMany({
      where: excludeBlockedMoviesWhere({
        homeSections: { has: slug },
      }),
      orderBy: [{ inHero: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit + 1,
      select: {
        id: true,
        quality: true,
        rating: true,
        thumbnail: true,
        title: true,
      },
    });
    const hasMore = items.length > limit;
    const visibleItems = hasMore ? items.slice(0, limit) : items;

    return {
      items: visibleItems,
      nextOffset: hasMore ? offset + visibleItems.length : null,
      totalMovies: offset + visibleItems.length + (hasMore ? 1 : 0),
    };
  },
  ["movies-by-home-section"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getMoviesByHomeSection(
  slug: string,
  options: { limit?: number; offset?: number } = {},
): Promise<CatalogPage> {
  const limit = Math.max(1, Math.min(options.limit ?? 18, 30));
  const offset = Math.max(0, options.offset ?? 0);

  try {
    return await getMoviesByHomeSectionCached(slug, offset, limit);
  } catch (error) {
    console.error(`Failed to load section ${slug}`, error);
    return {
      items: [],
      nextOffset: null,
      totalMovies: 0,
    };
  }
}

export async function isHomeSectionSlug(slug: string): Promise<boolean> {
  try {
    const count = await prisma.movie.count({
      where: { homeSections: { has: slug } },
    });
    return count > 0;
  } catch (error) {
    console.error(`Failed to verify section ${slug}`, error);
    return false;
  }
}

const getHomepageFilterOptionsCached = unstable_cache(
  async (): Promise<HomepageFilterOptions> => {
    const movies = await prisma.movie.findMany({
      where: excludeBlockedMoviesWhere({
        OR: [
          { genre: { not: null } },
          { year: { not: null } },
        ],
      }),
      select: {
        genre: true,
        year: true,
      },
    });
    const genreCounts = new Map<string, number>();
    const yearSet = new Set<string>();

    for (const movie of movies) {
      if (movie.year?.trim()) {
        yearSet.add(movie.year.trim());
      }

      if (!movie.genre) {
        continue;
      }

      const genres = movie.genre
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      for (const genre of genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const genres = [...genreCounts.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })
      .slice(0, 12)
      .map(([genre]) => genre);
    const years = [...yearSet]
      .sort((left, right) => Number(right) - Number(left))
      .slice(0, 10);

    return { genres, years };
  },
  ["homepage-filter-options"],
  { revalidate: FILTER_REVALIDATE_SECONDS },
);

export async function getHomepageFilterOptions(): Promise<HomepageFilterOptions> {
  try {
    return await getHomepageFilterOptionsCached();
  } catch (error) {
    console.error("Failed to load homepage filter options", error);
    return {
      genres: [],
      years: [],
    };
  }
}

export async function getRelatedMovies({
  currentMovieId,
  genre,
  subjectType,
  homeSections,
  limit = 12,
}: RelatedMovieInput): Promise<MovieCard[]> {
  try {
    return await getRelatedMoviesCached(
      currentMovieId,
      genre ?? null,
      subjectType ?? null,
      homeSections ?? null,
      limit,
    );
  } catch (error) {
    console.error("Failed to load related movies", error);
    return [];
  }
}

const getRelatedMoviesCached = unstable_cache(
  async (
    currentMovieId: string,
    genre: string | null,
    subjectType: number | null,
    homeSections: string[] | null,
    limit: number,
  ): Promise<MovieCard[]> => {
    const genreTerms =
      genre
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3) ?? [];
    const relatedConditions: Prisma.MovieWhereInput[] = [
      ...genreTerms.map<Prisma.MovieWhereInput>((value) => ({
        genre: { contains: value },
      })),
      ...(homeSections && homeSections.length
        ? [
            {
              homeSections: { hasSome: homeSections },
            } as Prisma.MovieWhereInput,
          ]
        : []),
    ];
    const movies = await prisma.movie.findMany({
      where: excludeBlockedMoviesWhere({
        id: { not: currentMovieId },
        ...(subjectType ? { subjectType } : {}),
        ...(relatedConditions.length ? { OR: relatedConditions } : {}),
      }),
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        quality: true,
        rating: true,
        thumbnail: true,
        title: true,
      },
    });

    if (movies.length >= Math.min(limit, 6)) {
      return movies;
    }

    const fallbackMovies = await prisma.movie.findMany({
      where: excludeBlockedMoviesWhere({
        id: { not: currentMovieId },
        NOT: {
          id: { in: movies.map((movie) => movie.id) },
        },
      }),
      orderBy: { updatedAt: "desc" },
      take: limit - movies.length,
      select: {
        id: true,
        quality: true,
        rating: true,
        thumbnail: true,
        title: true,
      },
    });

    return [...movies, ...fallbackMovies];
  },
  ["movie-related"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

const getMovieDetailDataCached = unstable_cache(
  async (id: string): Promise<MovieDetailData | null> => {
    const movie = await prisma.movie.findUnique({
      where: { id },
      select: {
        actors: true,
        description: true,
        directors: true,
        duration: true,
        genre: true,
        id: true,
        detailPath: true,
        subjectId: true,
        subjectType: true,
        inHero: true,
        homeSections: true,
        quality: true,
        rating: true,
        releaseDate: true,
        country: true,
        bahasa: true,
        hasIndonesianSubtitle: true,
        totalEpisode: true,
        totalSeason: true,
        seasonsList: true,
        trailerUrl: true,
        thumbnail: true,
        title: true,
        year: true,
      },
    });

    if (!movie || isBlockedMovieCandidate(movie)) {
      return null;
    }

    return {
      ...movie,
      seasonsList: normalizeSeasonsList(movie.seasonsList),
    };
  },
  ["movie-detail-data"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getMovieDetailData(
  id: string,
): Promise<MovieDetailData | null> {
  try {
    return await getMovieDetailDataCached(id);
  } catch (error) {
    console.error(`Failed to load movie detail for ${id}`, error);
    return null;
  }
}

const getCinematicBackdropMoviesCached = unstable_cache(
  async (limit: number): Promise<BackdropMovie[]> => {
    return prisma.movie.findMany({
      where: excludeBlockedMoviesWhere({
        thumbnail: { not: null },
      }),
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        thumbnail: true,
        title: true,
      },
    }) as Promise<BackdropMovie[]>;
  },
  ["cinematic-backdrop-movies"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getCinematicBackdropMovies(
  limit = 4,
): Promise<BackdropMovie[]> {
  try {
    return await getCinematicBackdropMoviesCached(limit);
  } catch (error) {
    console.error("Failed to load cinematic backdrop movies", error);
    return [];
  }
}
