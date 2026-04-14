import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Star } from "lucide-react";

import { WatchPlayer } from "@/components/movie/watch-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getWatchData(id: string) {
  const user = await getCurrentUserSession();
  const [movie, recommendations, history] = await Promise.all([
    prisma.movie.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        thumbnail: true,
        description: true,
        rating: true,
        quality: true,
      },
    }),
    prisma.movie.findMany({
      where: {
        id: {
          not: id,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 12,
      select: {
        id: true,
        title: true,
        thumbnail: true,
        rating: true,
        quality: true,
      },
    }),
    user
      ? prisma.watchHistory.findUnique({
          where: {
            userId_movieId: {
              movieId: id,
              userId: user.id,
            },
          },
          select: {
            progressSeconds: true,
          },
        })
      : null,
  ]);

  if (!movie) {
    return null;
  }

  return { history, movie, recommendations };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params;
  const data = await getWatchData(id);

  if (!data) {
    notFound();
  }

  const { history, movie, recommendations } = data;

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
          <div className="flex items-center justify-between gap-3 px-3 py-3 sm:mb-5 sm:px-0 sm:py-0">
            <Button asChild variant="ghost">
              <Link href={`/movie/${movie.id}`}>
                <ArrowLeft className="size-4" />
                Detail
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/" prefetch>
                <Info className="size-4" />
                Beranda
              </Link>
            </Button>
          </div>

          <div className="grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 sm:space-y-5">
              <WatchPlayer
                initialProgressSeconds={history?.progressSeconds ?? 0}
                movieId={movie.id}
                poster={movie.thumbnail}
              />

              <div className="space-y-3 px-4 sm:px-0">
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
                </div>
                <h1 className="text-2xl font-bold text-white sm:text-4xl">
                  {movie.title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-neutral-300">
                  {movie.description ??
                    "Pilih kualitas yang nyaman, tekan play, lalu lanjutkan tontonanmu."}
                </p>
              </div>
            </div>

            <aside className="hidden lg:block">
              <p className="mb-3 text-sm font-semibold text-neutral-300">
                Berikutnya
              </p>
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href={`/movie/${item.id}`}
                    prefetch
                    className="group grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md bg-white/5 p-2 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-900">
                      {item.thumbnail ? (
                        <Image
                          src={item.thumbnail}
                          alt={`${item.title} poster`}
                          fill
                          unoptimized
                          sizes="72px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 py-1">
                      <p className="line-clamp-2 text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="mt-2 text-xs text-neutral-400">
                        {item.quality ?? "Film"} · {item.rating ?? "N/A"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
        <div className="mb-4 sm:mb-5">
          <p className="text-sm font-semibold text-red-400">
            Rekomendasi untukmu
          </p>
          <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
            Lanjut pilih tontonan
          </h2>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
          {recommendations.map((item) => (
            <Link
              key={item.id}
              href={`/movie/${item.id}`}
              prefetch
              className="group w-[132px] shrink-0 outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-300 sm:w-auto sm:hover:-translate-y-1"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-900 shadow-xl shadow-black/40 ring-1 ring-white/10">
                {item.thumbnail ? (
                  <Image
                    src={item.thumbnail}
                    alt={`${item.title} poster`}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-sm text-neutral-400">
                    Poster belum tersedia
                  </div>
                )}

                {item.quality ? (
                  <div className="absolute bottom-3 left-3">
                    <Badge className="border-red-300/30 bg-red-600 text-white">
                      {item.quality}
                    </Badge>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 px-1.5 py-3 sm:p-3">
                <h3 className="line-clamp-2 min-h-9 text-xs font-semibold leading-[18px] text-white sm:min-h-10 sm:text-sm sm:leading-5">
                  {item.title}
                </h3>
                <p className="inline-flex items-center gap-1 text-xs text-neutral-400">
                  <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                  {item.rating ?? "N/A"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
