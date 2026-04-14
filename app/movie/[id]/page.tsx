import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clapperboard, Star, Users } from "lucide-react";

import { PlayButton } from "@/components/movie/play-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MoviePageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

function MovieCredits({
  actors,
  directors,
}: {
  actors: string[];
  directors: string[];
}) {
  return (
    <dl className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2 sm:pt-6">
      <div>
        <dt className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
          <Users className="size-4 text-red-400" />
          Pemeran
        </dt>
        <dd className="mt-2 text-sm leading-6 text-neutral-200">
          {actors.length ? actors.slice(0, 6).join(", ") : "Pemeran belum tersedia"}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
          <Clapperboard className="size-4 text-red-400" />
          Sutradara
        </dt>
        <dd className="mt-2 text-sm leading-6 text-neutral-200">
          {directors.length
            ? directors.slice(0, 3).join(", ")
            : "Sutradara belum tersedia"}
        </dd>
      </div>
    </dl>
  );
}

export default async function MoviePage({ params }: MoviePageProps) {
  const { id } = await params;
  const movie = await prisma.movie.findUnique({
    where: { id },
    select: {
      description: true,
      genre: true,
      id: true,
      quality: true,
      rating: true,
      releaseDate: true,
      actors: true,
      directors: true,
      thumbnail: true,
      title: true,
      year: true,
      duration: true,
    },
  });

  if (!movie) {
    notFound();
  }

  const poster = movie.thumbnail;
  const fallbackSynopsis =
    movie.description ??
    "Sinopsis belum tersedia. Video akan disiapkan otomatis saat kamu menekan tombol tonton.";
  const releaseDate = formatReleaseDate(movie.releaseDate ?? undefined);

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative isolate min-h-screen overflow-hidden pb-36 sm:pb-0">
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
            <Link href="/" prefetch>
              <ArrowLeft className="size-4" />
              Kembali
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
                {movie.year ? (
                  <span className="text-sm text-neutral-300">{movie.year}</span>
                ) : null}
                {releaseDate ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-neutral-300">
                    <Calendar className="size-4" />
                    {releaseDate}
                  </span>
                ) : null}
                {movie.duration ? (
                  <span className="text-sm text-neutral-300">
                    {movie.duration}
                  </span>
                ) : null}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold uppercase text-red-400">
                  Siap ditonton
                </p>
                <h1 className="max-w-4xl text-4xl font-black leading-none text-white sm:text-6xl lg:text-7xl">
                  {movie.title}
                </h1>
              </div>

              {movie.genre ? (
                <p className="text-sm font-medium text-neutral-400">
                  {movie.genre}
                </p>
              ) : null}

              <p className="line-clamp-5 max-w-3xl text-sm leading-6 text-neutral-200 sm:line-clamp-none sm:text-lg sm:leading-8">
                {fallbackSynopsis}
              </p>

              <div className="hidden flex-wrap gap-3 sm:flex">
                <PlayButton movieId={movie.id} />
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-12 border border-white/10 bg-white/10 px-7 text-white hover:bg-white/15"
                >
                  <Link href="/" prefetch>
                    Jelajahi lagi
                  </Link>
                </Button>
              </div>

              <MovieCredits actors={movie.actors} directors={movie.directors} />
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
                      Poster belum tersedia
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 px-4 py-3 sm:hidden">
        <div className="rounded-[14px] border border-white/10 bg-black/90 p-2 backdrop-blur">
          <PlayButton movieId={movie.id} />
        </div>
      </div>
    </main>
  );
}
