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

export type FeedSlug = "home" | "populer" | "new";

type FeedDefinition = {
  slug: FeedSlug;
  title: string;
  subtitle: string;
  description: string;
};

export const FEED_DEFINITIONS: Record<FeedSlug, FeedDefinition> = {
  home: {
    slug: "home",
    title: "Pilihan beranda",
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
    description: "Film yang baru masuk ke feed terbaru LK21.",
  },
};

type HomepageData = {
  featured: MovieCard | null;
  totalMovies: number;
  homeMovies: MovieCard[];
  popularMovies: MovieCard[];
  newMovies: MovieCard[];
};

export function isFeedSlug(value: string): value is FeedSlug {
  return value === "home" || value === "populer" || value === "new";
}

function getFeedWhere(slug: FeedSlug) {
  switch (slug) {
    case "home":
      return { inHome: true };
    case "populer":
      return { inPopular: true };
    case "new":
      return { inNew: true };
  }
}

export async function getFeedMovies(slug: FeedSlug, limit?: number) {
  try {
    return await prisma.movie.findMany({
      where: getFeedWhere(slug),
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

export async function getHomepageMovieData(limit = 18): Promise<HomepageData> {
  try {
    const [totalMovies, homeMovies, popularMovies, newMovies] = await Promise.all([
      prisma.movie.count(),
      getFeedMovies("home", limit),
      getFeedMovies("populer", limit),
      getFeedMovies("new", limit),
    ]);

    return {
      featured: popularMovies[0] ?? homeMovies[0] ?? newMovies[0] ?? null,
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

export async function getCinematicBackdropMovies(
  limit = 4,
): Promise<BackdropMovie[]> {
  try {
    return await prisma.movie.findMany({
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
    }) as BackdropMovie[];
  } catch (error) {
    console.error("Failed to load cinematic backdrop movies", error);
    return [];
  }
}
