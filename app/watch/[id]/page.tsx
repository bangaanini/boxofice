import Image from "next/image";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { ImmersiveHidden } from "@/components/feedback/immersive-hidden";
import { WatchPlayer } from "@/components/movie/watch-player";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    se?: string;
    ep?: string;
  }>;
};

async function getWatchData(id: string) {
  const movie = await prisma.movie.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      thumbnail: true,
      description: true,
      rating: true,
      quality: true,
      subjectType: true,
      totalSeason: true,
      totalEpisode: true,
      hasIndonesianSubtitle: true,
    },
  });

  if (!movie) {
    return null;
  }

  return { movie };
}

function clampInt(value: string | undefined, fallback: number, max: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), Math.max(1, max));
}

export default async function WatchPage({
  params,
  searchParams,
}: WatchPageProps) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams,
    requireUserSession(),
  ]);
  const data = await getWatchData(id);

  if (!data) {
    notFound();
  }

  const { movie } = data;
  const isSeries = movie.subjectType === 2;
  const seasonNumber = isSeries
    ? clampInt(query.se, 1, movie.totalSeason || 1)
    : 0;
  const episodeNumber = isSeries
    ? clampInt(query.ep, 1, movie.totalEpisode || 1)
    : 0;
  const episodeLabel = isSeries
    ? `Season ${seasonNumber} · Episode ${episodeNumber}`
    : null;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        {movie.thumbnail ? (
          <Image
            src={movie.thumbnail}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="scale-110 object-cover opacity-20 blur-sm"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),#000_88%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-0 py-0 sm:px-8 sm:py-5 lg:px-10">
          <div className="space-y-4 sm:space-y-5">
            <WatchPlayer
              movieId={movie.id}
              poster={movie.thumbnail}
              season={seasonNumber}
              episode={episodeNumber}
            />

            <ImmersiveHidden>
              <div className="space-y-3 px-4 pb-6 sm:px-0">
                <div className="flex flex-wrap items-center gap-3">
                  {movie.quality ? (
                    <Badge className="border-red-300/30 bg-red-600 text-white">
                      {movie.quality}
                    </Badge>
                  ) : null}
                  {movie.hasIndonesianSubtitle ? (
                    <Badge className="border-emerald-300/30 bg-emerald-600 text-white">
                      Subtitle: Indonesia
                    </Badge>
                  ) : null}
                  {episodeLabel ? (
                    <Badge className="border-sky-300/30 bg-sky-600 text-white">
                      {episodeLabel}
                    </Badge>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-300">
                    <Star className="size-4 fill-yellow-400 text-yellow-400" />
                    {movie.rating ?? "N/A"}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white sm:text-4xl">
                  {movie.title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-neutral-300">
                  {movie.description ??
                    "Pilih kualitas yang nyaman, tekan play, lalu nikmati tontonanmu."}
                </p>
              </div>
            </ImmersiveHidden>
          </div>
        </div>
      </section>
    </main>
  );
}
