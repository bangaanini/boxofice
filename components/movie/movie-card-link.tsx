import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MovieCard } from "@/lib/movie-feeds";

type MovieCardLinkProps = {
  movie: MovieCard;
  className?: string;
};

export function MovieCardLink({ movie, className }: MovieCardLinkProps) {
  return (
    <Link
      href={`/movie/${movie.id}`}
      prefetch
      data-haptic="light"
      className={cn(
        "group outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-300",
        className,
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-900 shadow-xl shadow-black/40 ring-1 ring-white/10">
        {movie.thumbnail ? (
          <Image
            src={movie.thumbnail}
            alt={`${movie.title} poster`}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, 180px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-neutral-400">
            Poster belum tersedia
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-3">
          {movie.quality ? (
            <Badge className="border-red-300/30 bg-red-600 text-white">
              {movie.quality}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 px-1.5 py-3 sm:p-3">
        <h3 className="line-clamp-2 min-h-9 text-xs font-semibold leading-[18px] text-white sm:min-h-10 sm:text-sm sm:leading-5">
          {movie.title}
        </h3>
        <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
            {movie.rating ?? "N/A"}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-red-300">
            <Play className="size-3.5 fill-current" />
            Lihat
          </span>
        </div>
      </div>
    </Link>
  );
}
