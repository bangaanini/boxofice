import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

import { MovieCardLink } from "@/components/movie/movie-card-link";
import { Button } from "@/components/ui/button";
import { getHomepageMovieData } from "@/lib/movie-feeds";

export const dynamic = "force-dynamic";

function MovieRail({
  href,
  movies,
  title,
}: {
  href: string;
  movies: Awaited<ReturnType<typeof getHomepageMovieData>>["homeMovies"];
  title: string;
}) {
  if (!movies.length) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
      <div className="mb-3 sm:mb-4">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {title}
          </h2>
        </div>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {movies.map((movie) => (
          <MovieCardLink
            key={movie.id}
            movie={movie}
            className="w-[132px] shrink-0 sm:w-[180px] sm:hover:-translate-y-1"
          />
        ))}
        <Link
          href={href}
          className="flex aspect-[2/3] w-[132px] shrink-0 flex-col items-center justify-center rounded-md border border-white/10 bg-white/[0.05] p-4 text-center outline-none transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-300 hover:bg-white/[0.09] sm:w-[180px]"
        >
          <span className="flex size-11 items-center justify-center rounded-md bg-red-600/15 text-red-300 ring-1 ring-red-400/20">
            <ArrowRight className="size-5" />
          </span>
          <span className="mt-4 text-sm font-semibold text-white sm:text-base">
            Lihat semua
          </span>
        </Link>
      </div>
    </section>
  );
}

export default async function Home() {
  const { featured, homeMovies, popularMovies, newMovies } =
    await getHomepageMovieData(18);

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        {featured?.thumbnail ? (
          <Image
            src={featured.thumbnail}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="scale-105 object-cover opacity-35 sm:scale-110 sm:opacity-30 sm:blur-sm"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.86)_42%,rgba(0,0,0,0.55)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(220,38,38,0.26),transparent_30%)]" />

        <div className="relative z-10 mx-auto flex min-h-[420px] w-full max-w-7xl items-end px-4 pb-8 pt-20 sm:min-h-[560px] sm:items-center sm:px-8 sm:py-12 lg:px-10">
          <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-red-400">Box Office</p>
              <h1 className="mt-3 text-4xl font-black leading-none text-white sm:mt-4 sm:text-6xl lg:text-7xl">
                {featured?.title ?? "Netflix-style library, powered by LK21"}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
                {featured ? (
                  <Button
                    asChild
                    size="lg"
                    className="h-11 bg-red-600 px-5 text-white hover:bg-red-500 sm:h-12 sm:px-7"
                  >
                    <Link href={`/movie/${featured.id}`}>
                      <Play className="size-5 fill-current" />
                      Mulai nonton
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            {featured?.thumbnail ? (
              <div className="hidden overflow-hidden rounded-md bg-neutral-950 shadow-2xl shadow-red-950/30 ring-1 ring-white/15 lg:block">
                <div className="relative aspect-[2/3]">
                  <Image
                    src={featured.thumbnail}
                    alt={`${featured.title} poster`}
                    fill
                    unoptimized
                    sizes="300px"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <MovieRail
        href="/browse/home"
        title="Pilihan Untukmu"
        movies={homeMovies}
      />
      <MovieRail
        href="/browse/populer"
        title="Sedang populer"
        movies={popularMovies}
      />
      <MovieRail
        href="/browse/new"
        title="Rilis terbaru"
        movies={newMovies}
      />

      {!homeMovies.length && !popularMovies.length && !newMovies.length ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:px-10">
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-neutral-900/60 px-6 text-center">
            <p className="text-2xl font-semibold text-white">
              Belum ada film
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
