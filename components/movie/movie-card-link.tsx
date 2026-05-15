import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MovieCard } from "@/lib/movie-feeds";

type MovieCardLinkProps = {
  movie: MovieCard;
  className?: string;
  href?: string;
  loading?: "eager" | "lazy";
  prefetch?: boolean;
  priority?: boolean;
};

function MovieCardLinkComponent({
  movie,
  className,
  href,
  loading = "lazy",
  prefetch = true,
  priority = false,
}: MovieCardLinkProps) {
  return (
    <Link
      href={href ?? `/movie/${movie.id}`}
      prefetch={prefetch}
      data-haptic="light"
      className={cn(
        "group block outline-none transition-transform active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-red-300",
        className,
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-[18px] bg-neutral-900 shadow-[0_20px_40px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_26px_60px_rgba(0,0,0,0.55)]">
        {movie.thumbnail ? (
          <Image
            src={movie.thumbnail}
            alt={`${movie.title} poster`}
            fill
            unoptimized
            loading={priority ? "eager" : loading}
            priority={priority}
            decoding="async"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 180px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-neutral-400">
            Poster belum tersedia
          </div>
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.08)_40%,rgba(0,0,0,0.78)_100%)]" />

        <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.32)] backdrop-blur-md">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            {movie.rating ?? "N/A"}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="rounded-[14px] bg-black/20 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-[2px]">
            <h3 className="line-clamp-2 text-[12px] font-semibold leading-[1.3] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-[13px]">
              {movie.title}
            </h3>
          </div>
        </div>
      </div>
    </Link>
  );
}

export const MovieCardLink = React.memo(
  MovieCardLinkComponent,
  (previous, next) =>
    previous.className === next.className &&
    previous.href === next.href &&
    previous.loading === next.loading &&
    previous.prefetch === next.prefetch &&
    previous.priority === next.priority &&
    previous.movie.id === next.movie.id &&
    previous.movie.title === next.movie.title &&
    previous.movie.thumbnail === next.movie.thumbnail &&
    previous.movie.rating === next.movie.rating,
);
