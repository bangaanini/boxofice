import { redirect } from "next/navigation";

import { Prisma } from "@/app/generated/prisma/client";
import { fetchDetail } from "@/lib/movie-api";
import { formatMovieTitle } from "@/lib/movie-title";
import { prisma } from "@/lib/prisma";
import { isBlockedMovieCandidate } from "@/lib/movie-visibility";

export const dynamic = "force-dynamic";

type MovieSourcePageProps = {
  searchParams: Promise<{
    sourceUrl?: string;
  }>;
};

export default async function MovieSourcePage({
  searchParams,
}: MovieSourcePageProps) {
  const params = await searchParams;
  const sourceUrl = params.sourceUrl?.trim();

  if (!sourceUrl) {
    redirect("/search");
  }

  const existing = await prisma.movie.findUnique({
    where: { sourceUrl },
    select: {
      description: true,
      id: true,
      sourceUrl: true,
      thumbnail: true,
      title: true,
    },
  });

  if (existing) {
    if (isBlockedMovieCandidate(existing)) {
      redirect("/search?blocked=1");
    }

    redirect(`/movie/${existing.id}`);
  }

  const detail = await fetchDetail(sourceUrl, { revalidate: 1800 }).catch(
    () => null,
  );

  if (!detail || !detail.subjectId) {
    redirect(`/search?notfound=1`);
  }

  if (
    isBlockedMovieCandidate({
      description: detail.synopsis,
      sourceUrl: detail.sourceUrl,
      thumbnail: detail.poster,
      title: detail.title,
    })
  ) {
    redirect("/search?blocked=1");
  }

  const releaseDate = detail.releaseDate ?? null;
  const year = releaseDate ? releaseDate.slice(0, 4) : null;
  const upsertData = {
    detailPath: detail.detailPath,
    subjectId: detail.subjectId,
    subjectType: detail.subjectType ?? 1,
    title: formatMovieTitle(detail.title, {
      sourceUrl,
      year,
    }),
    thumbnail: detail.poster ?? null,
    description: detail.synopsis ?? null,
    genre: detail.genres.length ? detail.genres.join(", ") : null,
    year,
    rating: detail.rating ?? null,
    releaseDate,
    country: detail.country ?? null,
    bahasa: detail.bahasa ?? null,
    hasIndonesianSubtitle: detail.hasIndonesianSubtitle ?? false,
    totalEpisode: detail.totalEpisode ?? 1,
    totalSeason: detail.totalSeason ?? 1,
    seasonsList:
      detail.seasonsList.length
        ? (detail.seasonsList as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    trailerUrl: detail.trailerUrl ?? null,
    detailSyncedAt: new Date(),
  };

  const movie = await prisma.movie.upsert({
    where: { sourceUrl },
    create: {
      sourceUrl,
      ...upsertData,
    },
    update: upsertData,
    select: {
      id: true,
    },
  });

  redirect(`/movie/${movie.id}`);
}
