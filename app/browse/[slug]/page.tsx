import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MovieCardLink } from "@/components/movie/movie-card-link";
import { Button } from "@/components/ui/button";
import {
  formatHomeSectionTitle,
  getMoviesByHomeSection,
  isHomeSectionSlug,
} from "@/lib/movie-feeds";

export const revalidate = 60;

type BrowsePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BrowsePage({ params }: BrowsePageProps) {
  const { slug } = await params;
  const exists = await isHomeSectionSlug(slug);

  if (!exists) {
    notFound();
  }

  const page = await getMoviesByHomeSection(slug, { limit: 30 });
  const featured = page.items[0] ?? null;
  const title = formatHomeSectionTitle(slug);

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
            className="scale-105 object-cover opacity-25 sm:scale-110 sm:opacity-20 sm:blur-sm"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.9)_58%,#000_100%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-8 sm:pb-10 lg:px-10">
          <div className="mt-16 max-w-3xl sm:mt-24">
            <h1 className="mt-3 text-4xl font-black leading-none text-white sm:text-6xl">
              {title}
            </h1>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
        {page.items.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {page.items.map((movie) => (
              <MovieCardLink
                key={movie.id}
                movie={movie}
                className="sm:hover:-translate-y-1"
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-neutral-900/60 px-6 text-center">
            <p className="text-2xl font-semibold text-white">
              Belum ada judul di section ini
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
              Jalankan sync home dari admin panel, lalu section akan terisi
              kembali.
            </p>
            <Button asChild className="mt-6">
              <Link href="/admin">Buka admin</Link>
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
