import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { MovieCardLink } from "@/components/movie/movie-card-link";
import type { MovieCard } from "@/lib/movie-feeds";

type HomeSectionRowProps = {
  title: string;
  slug: string;
  movies: MovieCard[];
  eager?: boolean;
};

export function HomeSectionRow({
  title,
  slug,
  movies,
  eager = false,
}: HomeSectionRowProps) {
  if (!movies.length) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-white sm:text-lg">{title}</h2>
        <Link
          href={`/browse/${slug}`}
          prefetch={false}
          className="inline-flex items-center gap-1 text-xs font-semibold text-orange-200 transition hover:text-orange-100"
        >
          Lihat semua
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {movies.map((movie, index) => (
          <div
            key={movie.id}
            className="w-[140px] shrink-0 sm:w-[160px] md:w-[180px]"
          >
            <MovieCardLink
              movie={movie}
              prefetch={false}
              priority={eager && index < 4}
              loading={eager && index < 6 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
