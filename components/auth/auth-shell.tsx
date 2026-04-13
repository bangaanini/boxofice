import type { ReactNode } from "react";
import Image from "next/image";

import type { BackdropMovie } from "@/lib/movie-feeds";

type AuthShellProps = {
  badge: string;
  backdropMovies?: BackdropMovie[];
  children: ReactNode;
  description: string;
  title: string;
};

export function AuthShell({
  badge,
  backdropMovies = [],
  children,
  description,
  title,
}: AuthShellProps) {
  const heroMovie = backdropMovies[0] ?? null;
  const stackMovies = backdropMovies.slice(1, 4);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-28 pt-8 text-white">
      {heroMovie ? (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={heroMovie.thumbnail}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-[0.18]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.76)_22%,#070707_62%,#050505_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(220,38,38,0.22),transparent_28%)]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(220,38,38,0.18),transparent_28%),linear-gradient(180deg,#140d0d_0%,#050505_100%)]" />
      )}

      {stackMovies.length ? (
        <div className="pointer-events-none absolute inset-x-4 top-24 z-0 flex gap-3 opacity-35">
          {stackMovies.map((movie, index) => (
            <div
              key={movie.id}
              className="relative aspect-[2/3] w-[84px] overflow-hidden rounded-md border border-white/8 shadow-2xl"
              style={{
                transform: `translateY(${index * 14}px) rotate(${index === 1 ? "-5deg" : index === 2 ? "4deg" : "0deg"})`,
              }}
            >
              <Image
                src={movie.thumbnail}
                alt=""
                fill
                sizes="84px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/25" />
            </div>
          ))}
        </div>
      ) : null}

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col">


        <div className="mt-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,22,0.82),rgba(8,8,8,0.94))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <span className="inline-flex rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
            {badge}
          </span>
          <h1 className="mt-4 text-[2.35rem] font-black leading-none text-white">
            {title}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-neutral-300">
            {description}
          </p>

          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
