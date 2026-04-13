import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Star } from "lucide-react";

import { WatchPlayer } from "@/components/movie/watch-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchDetail } from "@/lib/movie-api";

export const dynamic = "force-dynamic";

type SourceWatchPageProps = {
  searchParams: Promise<{
    poster?: string;
    quality?: string;
    rating?: string;
    sourceUrl?: string;
    title?: string;
  }>;
};

function cleanParam(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

async function getUpstreamDetail(sourceUrl: string) {
  try {
    return await fetchDetail(sourceUrl, { revalidate: 1800 });
  } catch (error) {
    console.error("Failed to load upstream watch detail", error);
    return null;
  }
}

async function SourceSynopsis({
  fallback,
  sourceUrl,
}: {
  fallback: string;
  sourceUrl: string;
}) {
  const detail = await getUpstreamDetail(sourceUrl);

  return (
    <p className="max-w-3xl text-sm leading-6 text-neutral-300">
      {detail?.synopsis ?? fallback}
    </p>
  );
}

export default async function SourceWatchPage({
  searchParams,
}: SourceWatchPageProps) {
  const params = await searchParams;
  const sourceUrl = cleanParam(params.sourceUrl);

  if (!sourceUrl) {
    notFound();
  }

  const title = cleanParam(params.title) ?? "Film pilihanmu";
  const poster = cleanParam(params.poster) ?? null;
  const rating = cleanParam(params.rating);
  const quality = cleanParam(params.quality);
  const fallbackSynopsis =
    "Video ini diambil langsung dari hasil pencarian terbaru.";

  return (
    <main className="min-h-screen bg-black pb-24 text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        {poster ? (
          <Image
            src={poster}
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
              <Link href="/search">
                <ArrowLeft className="size-4" />
                Cari lagi
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/" prefetch>
                Beranda
              </Link>
            </Button>
          </div>

          <div className="grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 sm:space-y-5">
              <WatchPlayer sourceUrl={sourceUrl} poster={poster} />

              <div className="space-y-3 px-4 sm:px-0">
                <div className="flex flex-wrap items-center gap-3">
                  {quality ? (
                    <Badge className="border-red-300/30 bg-red-600 text-white">
                      {quality}
                    </Badge>
                  ) : null}
                  {rating ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-300">
                      <Star className="size-4 fill-yellow-400 text-yellow-400" />
                      {rating}
                    </span>
                  ) : null}
                </div>
                <h1 className="text-2xl font-bold text-white sm:text-4xl">
                  {title}
                </h1>
                <Suspense
                  fallback={
                    <p className="max-w-3xl text-sm leading-6 text-neutral-300">
                      {fallbackSynopsis}
                    </p>
                  }
                >
                  <SourceSynopsis
                    fallback={fallbackSynopsis}
                    sourceUrl={sourceUrl}
                  />
                </Suspense>
              </div>
            </div>

            <aside className="hidden lg:block">
              <div className="overflow-hidden rounded-md bg-neutral-950 shadow-2xl shadow-red-950/30 ring-1 ring-white/15">
                <div className="relative aspect-[2/3] bg-neutral-900">
                  {poster ? (
                    <Image
                      src={poster}
                      alt={`${title} poster`}
                      fill
                      unoptimized
                      sizes="320px"
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
