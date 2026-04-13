import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clapperboard, Star, Users } from "lucide-react";

import { PlayButton } from "@/components/movie/play-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchDetail } from "@/lib/movie-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MoviePageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getMovieDetail(sourceUrl: string) {
  try {
    return await fetchDetail(sourceUrl);
  } catch (error) {
    console.error("Failed to load movie detail", error);
    return null;
  }
}

function formatReleaseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function MoviePage({ params }: MoviePageProps) {
  const { id } = await params;
  const movie = await prisma.movie.findUnique({
    where: { id },
  });

  if (!movie) {
    notFound();
  }

  const detail = await getMovieDetail(movie.sourceUrl);
  const poster = detail?.poster ?? movie.thumbnail;
  const synopsis =
    detail?.synopsis ??
    movie.description ??
    "Synopsis is being prepared. Playback links are resolved only when you press play.";
  const releaseDate = formatReleaseDate(detail?.releaseDate);
  const actors = detail?.actors.slice(0, 6) ?? [];
  const directors = detail?.directors.slice(0, 3) ?? [];

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative isolate min-h-screen overflow-hidden pb-24 sm:pb-0">
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="scale-105 object-cover opacity-30 sm:opacity-25 sm:blur-sm"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,#000_72%)] sm:bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.84)_34%,rgba(0,0,0,0.45)_68%,rgba(0,0,0,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_20%,rgba(220,38,38,0.24),transparent_32%)]" />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-8 sm:py-6 lg:px-10">
          <Button asChild variant="ghost" className="w-fit">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>

          <div className="grid flex-1 items-end gap-7 pb-4 pt-40 sm:items-center sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="max-w-3xl space-y-5 sm:space-y-7">
              <div className="flex flex-wrap items-center gap-3">
                {movie.quality ? (
                  <Badge className="border-red-300/30 bg-red-600 text-white">
                    {movie.quality}
                  </Badge>
                ) : null}
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-300">
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                  {movie.rating ?? "N/A"}
                </span>
                {releaseDate ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-neutral-300">
                    <Calendar className="size-4" />
                    {releaseDate}
                  </span>
                ) : null}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold uppercase text-red-400">
                  Now Streaming
                </p>
                <h1 className="max-w-4xl text-4xl font-black leading-none text-white sm:text-6xl lg:text-7xl">
                  {movie.title}
                </h1>
              </div>

              <p className="line-clamp-5 max-w-3xl text-sm leading-6 text-neutral-200 sm:line-clamp-none sm:text-lg sm:leading-8">
                {synopsis}
              </p>

              <div className="hidden flex-wrap gap-3 sm:flex">
                <PlayButton movieId={movie.id} />
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-12 border border-white/10 bg-white/10 px-7 text-white hover:bg-white/15"
                >
                  <Link href="/">Browse more</Link>
                </Button>
              </div>

              <dl className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2 sm:pt-6">
                <div>
                  <dt className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
                    <Users className="size-4 text-red-400" />
                    Cast
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-neutral-200">
                    {actors.length ? actors.join(", ") : "Cast unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
                    <Clapperboard className="size-4 text-red-400" />
                    Director
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-neutral-200">
                    {directors.length
                      ? directors.join(", ")
                      : "Director unavailable"}
                  </dd>
                </div>
              </dl>
            </div>

            <aside className="hidden lg:block">
              <div className="overflow-hidden rounded-md bg-neutral-950 shadow-2xl shadow-red-950/30 ring-1 ring-white/15">
                <div className="relative aspect-[2/3] bg-neutral-900">
                  {poster ? (
                    <Image
                      src={poster}
                      alt={`${movie.title} poster`}
                      fill
                      unoptimized
                      sizes="340px"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-400">
                      Poster unavailable
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur sm:hidden">
        <PlayButton movieId={movie.id} />
      </div>
    </main>
  );
}
