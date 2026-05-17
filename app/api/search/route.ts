import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { excludeBlockedMoviesWhere } from "@/lib/movie-visibility";
import type { Prisma } from "@/app/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 18;

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
    const where: Prisma.MovieWhereInput = excludeBlockedMoviesWhere({
      ...(subjectType ? { subjectType } : {}),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    });

    const skip = (page - 1) * PAGE_SIZE;

    const [totalCount, rows] = await Promise.all([
      prisma.movie.count({ where }),
      prisma.movie.findMany({
        where,
        orderBy: [
          { inHero: "desc" },
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          sourceUrl: true,
          detailPath: true,
          subjectId: true,
          subjectType: true,
          title: true,
          thumbnail: true,
          rating: true,
          quality: true,
          year: true,
          description: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const movies = rows.map((row) => ({
      sourceUrl: row.sourceUrl,
      detailPath: row.detailPath ?? row.sourceUrl,
      subjectId: row.subjectId ?? "",
      subjectType: row.subjectType,
      title: row.title,
      thumbnail: row.thumbnail ?? undefined,
      description: row.description ?? undefined,
      rating: row.rating ?? undefined,
      quality: row.quality ?? undefined,
      year: row.year ?? undefined,
      movieId: row.id,
    }));

    return NextResponse.json(
      {
        fetched: rows.length,
        movies,
        page,
        totalPages,
        totalCount,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pencarian sedang tidak bisa digunakan.",
      },
      { status: 500 },
    );
  }
}
