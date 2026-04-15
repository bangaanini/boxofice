import { unstable_cache } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

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
  inHome?: boolean;
  inNew?: boolean;
  inPopular?: boolean;
  limit?: number;
};
export type MovieDetailData = {
  actors: string[];
  description: string | null;
  directors: string[];
  duration: string | null;
  genre: string | null;
  id: string;
  inHome: boolean;
  inNew: boolean;
  inPopular: boolean;
  quality: string | null;
  rating: string | null;
  releaseDate: string | null;
  thumbnail: string | null;
  title: string;
  year: string | null;
};

export type FeedSlug = "home" | "populer" | "new";
export type HomepageFilters = {
  genre?: string | null;
  year?: string | null;
};

export type HomepageFilterOptions = {
  genres: string[];
  years: string[];
};

type FeedDefinition = {
  slug: FeedSlug;
  title: string;
  subtitle: string;
  description: string;
};

export const FEED_DEFINITIONS: Record<FeedSlug, FeedDefinition> = {
  home: {
    slug: "home",
    title: "Pilihan Untukmu",
    subtitle: "Feed home",
    description: "Katalog utama yang tampil di beranda Box Office.",
  },
  populer: {
    slug: "populer",
    title: "Sedang populer",
    subtitle: "Feed populer",
    description: "Judul yang lagi ramai dan paling sering dicari.",
  },
  new: {
    slug: "new",
    title: "Rilis terbaru",
    subtitle: "Feed new",
    description: "Film yang baru masuk",
  },
};

type HomepageData = {
  featured: MovieCard | null;
  totalMovies: number;
  homeMovies: MovieCard[];
  popularMovies: MovieCard[];
  newMovies: MovieCard[];
};

const FEED_REVALIDATE_SECONDS = 60 * 5;
const FILTER_REVALIDATE_SECONDS = 60 * 10;

export function isFeedSlug(value: string): value is FeedSlug {
  return value === "home" || value === "populer" || value === "new";
}

function normalizeFilterValue(value?: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function getFeedWhere(
  slug: FeedSlug,
  filters: HomepageFilters = {},
): Prisma.MovieWhereInput {
  const genre = normalizeFilterValue(filters.genre);
  const year = normalizeFilterValue(filters.year);
  switch (slug) {
    case "home":
      return {
        inHome: true,
        ...(genre
          ? {
              genre: {
                contains: genre,
                mode: "insensitive",
              },
            }
          : {}),
        ...(year ? { year } : {}),
      };
    case "populer":
      return {
        inPopular: true,
        ...(genre
          ? {
              genre: {
                contains: genre,
                mode: "insensitive",
              },
            }
          : {}),
        ...(year ? { year } : {}),
      };
    case "new":
      return {
        inNew: true,
        ...(genre
          ? {
              genre: {
                contains: genre,
                mode: "insensitive",
              },
            }
          : {}),
        ...(year ? { year } : {}),
      };
  }
}

const getFeedMoviesCached = unstable_cache(
  async (
    slug: FeedSlug,
    limit?: number,
    genre?: string | null,
    year?: string | null,
  ) => {
    return prisma.movie.findMany({
      where: getFeedWhere(slug, { genre, year }),
      orderBy: { updatedAt: "desc" },
      ...(typeof limit === "number" ? { take: limit } : {}),
      select: {
        id: true,
        title: true,
        thumbnail: true,
        rating: true,
        quality: true,
      },
    });
  },
  ["movie-feed-movies"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getFeedMovies(
  slug: FeedSlug,
  options?: number | ({ limit?: number } & HomepageFilters),
) {
  const limit = typeof options === "number" ? options : options?.limit;
  const genre =
    typeof options === "number" ? null : normalizeFilterValue(options?.genre);
  const year =
    typeof options === "number" ? null : normalizeFilterValue(options?.year);

  try {
    return await getFeedMoviesCached(slug, limit, genre, year);
  } catch (error) {
    console.error(`Failed to load feed movies for ${slug}`, error);
    return [];
  }
}

export async function getFeedPageData(slug: FeedSlug) {
  try {
    const [count, movies] = await Promise.all([
      prisma.movie.count({ where: getFeedWhere(slug) }),
      getFeedMovies(slug),
    ]);

    return {
      count,
      definition: FEED_DEFINITIONS[slug],
      movies,
    };
  } catch (error) {
    console.error(`Failed to load feed page data for ${slug}`, error);

    return {
      count: 0,
      definition: FEED_DEFINITIONS[slug],
      movies: [],
    };
  }
}

const getHomepageMovieDataCached = unstable_cache(
  async (limit: number, genre?: string | null, year?: string | null) => {
    const filters = { genre, year };
    const [totalMovies, homeMovies, popularMovies, newMovies] = await Promise.all([
      prisma.movie.count({
        where: {
          ...(genre
            ? {
                genre: {
                  contains: genre,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(year ? { year } : {}),
        },
      }),
      getFeedMoviesCached("home", limit, genre, year),
      getFeedMoviesCached("populer", limit, genre, year),
      getFeedMoviesCached("new", limit, genre, year),
    ]);

    return {
      featured: popularMovies[0] ?? homeMovies[0] ?? newMovies[0] ?? null,
      homeMovies,
      newMovies,
      popularMovies,
      totalMovies,
      filters,
    };
  },
  ["homepage-movie-data"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getHomepageMovieData(
  options: number | ({ limit?: number } & HomepageFilters) = 18,
): Promise<HomepageData> {
  const limit = typeof options === "number" ? options : options.limit ?? 18;
  const genre =
    typeof options === "number" ? null : normalizeFilterValue(options.genre);
  const year =
    typeof options === "number" ? null : normalizeFilterValue(options.year);

  try {
    const { featured, homeMovies, newMovies, popularMovies, totalMovies } =
      await getHomepageMovieDataCached(limit, genre, year);

    return {
      featured,
      homeMovies,
      newMovies,
      popularMovies,
      totalMovies,
    };
  } catch (error) {
    console.error("Failed to load homepage movies", error);

    return {
      featured: null,
      homeMovies: [],
      newMovies: [],
      popularMovies: [],
      totalMovies: 0,
    };
  }
}

const getHomepageFilterOptionsCached = unstable_cache(
  async (): Promise<HomepageFilterOptions> => {
    const movies = await prisma.movie.findMany({
      where: {
        OR: [
          {
            genre: {
              not: null,
            },
          },
          {
            year: {
              not: null,
            },
          },
        ],
      },
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
  inHome,
  inNew,
  inPopular,
  limit = 12,
}: RelatedMovieInput): Promise<MovieCard[]> {
  try {
    return await getRelatedMoviesCached(
      currentMovieId,
      genre ?? null,
      Boolean(inHome),
      Boolean(inNew),
      Boolean(inPopular),
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
    inHome: boolean,
    inNew: boolean,
    inPopular: boolean,
    limit: number,
  ): Promise<MovieCard[]> => {
    const genreTerms =
      genre
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3) ?? [];
    const relatedConditions = [
      ...genreTerms.map((value) => ({
        genre: {
          contains: value,
        },
      })),
      ...(inPopular ? [{ inPopular: true }] : []),
      ...(inNew ? [{ inNew: true }] : []),
      ...(inHome ? [{ inHome: true }] : []),
    ];
    const movies = await prisma.movie.findMany({
      where: {
        id: {
          not: currentMovieId,
        },
        ...(relatedConditions.length ? { OR: relatedConditions } : {}),
      },
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
      where: {
        id: {
          not: currentMovieId,
        },
        NOT: {
          id: {
            in: movies.map((movie) => movie.id),
          },
        },
      },
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
    return prisma.movie.findUnique({
      where: { id },
      select: {
        actors: true,
        description: true,
        directors: true,
        duration: true,
        genre: true,
        id: true,
        inHome: true,
        inNew: true,
        inPopular: true,
        quality: true,
        rating: true,
        releaseDate: true,
        thumbnail: true,
        title: true,
        year: true,
      },
    });
  },
  ["movie-detail-data"],
  { revalidate: FEED_REVALIDATE_SECONDS },
);

export async function getMovieDetailData(id: string): Promise<MovieDetailData | null> {
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
      where: {
        thumbnail: {
          not: null,
        },
      },
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
