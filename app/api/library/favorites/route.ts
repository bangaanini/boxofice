import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserSession } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getMovieId(request: NextRequest) {
  return request.nextUrl.searchParams.get("movieId")?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUserSession();

  if (!user) {
    return NextResponse.json({ saved: false }, { status: 401 });
  }

  const movieId = getMovieId(request);

  if (!movieId) {
    return NextResponse.json({ error: "movieId wajib diisi" }, { status: 400 });
  }

  const favorite = await prisma.userFavorite.findUnique({
    where: {
      userId_movieId: {
        movieId,
        userId: user.id,
      },
    },
    select: {
      id: true,
    },
  });

  return NextResponse.json({ saved: Boolean(favorite) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserSession();

  if (!user) {
    return NextResponse.json({ error: "Login dulu untuk menyimpan film." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    movieId?: unknown;
    saved?: unknown;
  } | null;
  const movieId = typeof body?.movieId === "string" ? body.movieId.trim() : "";

  if (!movieId) {
    return NextResponse.json({ error: "movieId wajib diisi" }, { status: 400 });
  }

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true },
  });

  if (!movie) {
    return NextResponse.json({ error: "Film tidak ditemukan" }, { status: 404 });
  }

  const shouldSave = body?.saved !== false;

  if (!shouldSave) {
    await prisma.userFavorite.deleteMany({
      where: {
        movieId,
        userId: user.id,
      },
    });

    return NextResponse.json({ saved: false });
  }

  await prisma.userFavorite.upsert({
    where: {
      userId_movieId: {
        movieId,
        userId: user.id,
      },
    },
    create: {
      movieId,
      userId: user.id,
    },
    update: {},
  });

  return NextResponse.json({ saved: true });
}
