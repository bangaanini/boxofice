import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clapperboard, Star, Users } from "lucide-react";

import { MovieActionButtons } from "@/components/movie/movie-action-buttons";
import { PlayButton } from "@/components/movie/play-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSession } from "@/lib/user-auth";

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
  const [movie, user] = await Promise.all([
    prisma.movie.findUnique({
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
    }),
    getCurrentUserSession(),
  ]);

  if (!movie) {
    notFound();
  }

  const favorite = user
    ? await prisma.userFavorite.findUnique({
        where: {
          userId_movieId: {
            movieId: movie.id,
            userId: user.id,
          },
        },
        select: {
          id: true,
        },
      })
    : null;

  const poster = movie.thumbnail;
  const fallbackSynopsis =
    movie.description ??
    "Sinopsis belum tersedia. Video akan disiapkan otomatis saat kamu menekan tombol tonton.";
  const releaseDate = formatReleaseDate(movie.releaseDate ?? undefined);

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative isolate overflow-hidden pb-24 sm:min-h-screen sm:pb-0">
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="scale-110 object-cover opacity-20 blur-xl sm:opacity-25"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,#000_62%,#000_100%)] sm:bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.86)_32%,rgba(0,0,0,0.48)_68%,rgba(0,0,0,0.9)_100%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col px-4 pb-6 pt-3 sm:min-h-screen sm:px-8 sm:py-6 lg:px-10">
          <Button
            asChild
            variant="ghost"
            className="w-fit bg-black/25 backdrop-blur sm:bg-transparent"
          >
            <Link href="/" prefetch>
              <ArrowLeft className="size-4" />
              Kembali
            </Link>
          </Button>

          <div className="grid flex-1 gap-5 pt-4 sm:items-center sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="relative mx-auto w-full max-w-[340px] sm:hidden">
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-950 shadow-2xl shadow-black/70 ring-1 ring-white/15">
                {poster ? (
                  <Image
                    src={poster}
                    alt={`${movie.title} poster`}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 88vw, 340px"
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-400">
                    Poster belum tersedia
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-3xl space-y-4 sm:space-y-7">
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
                <p className="mb-2 text-xs font-semibold uppercase text-red-400 sm:mb-3 sm:text-sm">
                  Siap ditonton
                </p>
                <h1 className="max-w-4xl text-3xl font-black leading-tight text-white sm:text-6xl sm:leading-none lg:text-7xl">
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

              <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
                <div className="sm:w-auto">
                  <PlayButton movieId={movie.id} />
                </div>
                <MovieActionButtons
                  initialSaved={Boolean(favorite)}
                  movieId={movie.id}
                  title={movie.title}
                />
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="hidden h-12 border border-white/10 bg-white/10 px-7 text-white hover:bg-white/15 sm:inline-flex"
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
    </main>
  );
}
