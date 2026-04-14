import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePositiveInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.trunc(number);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserSession();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    completed?: unknown;
    durationSeconds?: unknown;
    movieId?: unknown;
    progressSeconds?: unknown;
  } | null;
  const movieId = typeof body?.movieId === "string" ? body.movieId.trim() : "";

  if (!movieId) {
    return NextResponse.json({ error: "movieId wajib diisi" }, { status: 400 });
  }

  const progressSeconds = safePositiveInteger(body?.progressSeconds);
  const rawDuration = safePositiveInteger(body?.durationSeconds);
  const durationSeconds = rawDuration > 0 ? rawDuration : null;
  const completed =
    body?.completed === true ||
    (durationSeconds !== null && progressSeconds >= Math.max(durationSeconds - 20, 1));

  if (!completed && progressSeconds < 5) {
    return NextResponse.json({ ok: true, skipped: "progress_too_low" });
  }

  await prisma.watchHistory.upsert({
    where: {
      userId_movieId: {
        movieId,
        userId: user.id,
      },
    },
    create: {
      completed,
      durationSeconds,
      movieId,
      progressSeconds,
      userId: user.id,
    },
    update: {
      completed,
      ...(durationSeconds !== null ? { durationSeconds } : {}),
      lastWatchedAt: new Date(),
      progressSeconds,
    },
  });

  return NextResponse.json({ ok: true });
}
