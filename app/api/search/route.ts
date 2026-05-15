import { NextResponse, type NextRequest } from "next/server";

import { fetchSearch, MovieApiError } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";
import { isBlockedMovieCandidate } from "@/lib/movie-visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampPage(value: string | null) {
  const parsed = Number(value ?? "1");

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function parseSubjectType(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const truncated = Math.trunc(parsed);
  return truncated === 1 || truncated === 2 ? truncated : undefined;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = clampPage(request.nextUrl.searchParams.get("page"));
  const subjectType = parseSubjectType(
    request.nextUrl.searchParams.get("subjectType"),
  );

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Masukkan minimal 2 karakter untuk mencari film." },
      { status: 400 },
    );
  }

  try {
    const result = await fetchSearch(query, page, 18, subjectType);
    const safeMovies = result.movies.filter(
      (movie) => !isBlockedMovieCandidate(movie),
    );
    const sourceUrls = Array.from(
      new Set(
        safeMovies
          .map((movie) => movie.sourceUrl)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const existingMovies = sourceUrls.length
      ? await prisma.movie
          .findMany({
            where: {
              sourceUrl: {
                in: sourceUrls,
              },
            },
            select: {
              description: true,
              id: true,
              sourceUrl: true,
              thumbnail: true,
              title: true,
            },
          })
          .catch(() => [])
      : [];
    const unsafeSourceUrls = new Set(
      existingMovies
        .filter((movie) => isBlockedMovieCandidate(movie))
        .map((movie) => movie.sourceUrl),
    );
    const movieIdBySource = new Map(
      existingMovies
        .filter((movie) => !unsafeSourceUrls.has(movie.sourceUrl))
        .map((movie) => [movie.sourceUrl, movie.id]),
    );
    const visibleMovies = safeMovies.filter(
      (movie) => !unsafeSourceUrls.has(movie.sourceUrl),
    );

    return NextResponse.json(
      {
        fetched: result.fetched,
        movies: visibleMovies.map((movie) => ({
          ...movie,
          movieId: movieIdBySource.get(movie.sourceUrl) ?? null,
        })),
        page: result.page ?? page,
        totalPages: result.totalPages,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const status =
      error instanceof MovieApiError && error.status === 404 ? 404 : 502;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pencarian sedang tidak bisa digunakan.",
      },
      { status },
    );
  }
}
