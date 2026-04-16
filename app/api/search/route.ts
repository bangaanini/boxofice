import { NextResponse, type NextRequest } from "next/server";

import { fetchSearch, MovieApiError } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampPage(value: string | null) {
  const parsed = Number(value ?? "1");

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = clampPage(request.nextUrl.searchParams.get("page"));

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Masukkan minimal 2 karakter untuk mencari film." },
      { status: 400 },
    );
  }

  try {
    const result = await fetchSearch(query, page);
    const sourceUrls = Array.from(
      new Set(
        result.movies
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
              id: true,
              sourceUrl: true,
            },
          })
          .catch(() => [])
      : [];
    const movieIdBySource = new Map(
      existingMovies.map((movie) => [movie.sourceUrl, movie.id]),
    );

    return NextResponse.json(
      {
        fetched: result.fetched,
        movies: result.movies.map((movie) => ({
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
    const status = error instanceof MovieApiError && error.status === 404 ? 404 : 502;

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
