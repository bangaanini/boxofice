import Image from "next/image";
import { notFound } from "next/navigation";
import { Calendar, Clapperboard, Star, Users } from "lucide-react";

import { ImmersiveHidden } from "@/components/feedback/immersive-hidden";
import { DetailWatchActions } from "@/components/movie/detail-watch-actions";
import { MovieCardLink } from "@/components/movie/movie-card-link";
import { SynopsisAccordion } from "@/components/movie/synopsis-accordion";
import { Badge } from "@/components/ui/badge";
import {
  getMovieDetailData,
  getRelatedMovies,
  type MovieCard,
} from "@/lib/movie-feeds";
import { prisma } from "@/lib/prisma";
import { requireUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type MoviePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    play?: string;
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

function RelatedMoviesSection({ movies }: { movies: MovieCard[] }) {
  if (!movies.length) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-8 sm:pb-12 sm:pt-8 lg:px-10">
      <div className="mb-3 flex items-center justify-between gap-4 sm:mb-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Film serupa
        </h2>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {movies.map((movie) => (
          <MovieCardLink
            key={movie.id}
            movie={movie}
            className="w-[132px] shrink-0 sm:w-[180px] sm:hover:-translate-y-1"
          />
        ))}
      </div>
    </section>
  );
}

export default async function MoviePage({ params, searchParams }: MoviePageProps) {
  const [{ id }, query, user] = await Promise.all([
    params,
    searchParams,
    requireUserSession(),
  ]);
  const movie = await getMovieDetailData(id);

  if (!movie) {
    notFound();
  }

  const [favorite, relatedMovies] = await Promise.all([
    prisma.userFavorite.findUnique({
      where: {
        userId_movieId: {
          movieId: movie.id,
          userId: user.id,
        },
      },
      select: {
        id: true,
      },
    }),
    getRelatedMovies({
      currentMovieId: movie.id,
      genre: movie.genre,
      inHome: movie.inHome,
      inNew: movie.inNew,
      inPopular: movie.inPopular,
      limit: 14,
    }),
  ]);
  const shouldOpenPlayer = query.play === "1" || query.play === "true";

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
          <div className="grid flex-1 gap-4 pt-2 sm:items-center sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="relative mx-auto w-full max-w-[315px] sm:hidden">
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-950 shadow-2xl shadow-black/70 ring-1 ring-white/15">
                {poster ? (
                  <Image
                    src={poster}
                    alt={`${movie.title} poster`}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 82vw, 315px"
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

            <div className="max-w-3xl space-y-3 sm:space-y-7">
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
                <h1 className="max-w-4xl text-3xl font-black leading-tight text-white sm:text-6xl sm:leading-none lg:text-7xl">
                  {movie.title}
                </h1>
              </div>

              {movie.genre ? (
                <p className="text-sm font-medium text-neutral-400">
                  {movie.genre}
                </p>
              ) : null}

              <DetailWatchActions
                initialSaved={Boolean(favorite)}
                initialOpen={shouldOpenPlayer}
                movieId={movie.id}
                poster={poster}
                title={movie.title}
              />

              <SynopsisAccordion text={fallbackSynopsis} />

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

      <ImmersiveHidden>
        <RelatedMoviesSection movies={relatedMovies} />
      </ImmersiveHidden>
    </main>
  );
}
