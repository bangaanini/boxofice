"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

import type { BackdropMovie } from "@/lib/movie-feeds";
import { cn } from "@/lib/utils";

type HomeHeroProps = {
  banners: BackdropMovie[];
};

const ROTATE_INTERVAL_MS = 6000;

export function HomeHero({ banners }: HomeHeroProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (banners.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, ROTATE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [banners.length]);

  const visibleSet = React.useMemo(() => {
    if (banners.length <= 1) {
      return new Set([0]);
    }

    const prevIndex = (activeIndex - 1 + banners.length) % banners.length;
    const nextIndex = (activeIndex + 1) % banners.length;

    return new Set([prevIndex, activeIndex, nextIndex]);
  }, [activeIndex, banners.length]);

  if (banners.length === 0) {
    return null;
  }

  const goPrev = () =>
    setActiveIndex((current) =>
      current === 0 ? banners.length - 1 : current - 1,
    );
  const goNext = () =>
    setActiveIndex((current) => (current + 1) % banners.length);

  const activeBanner = banners[activeIndex];

  return (
    <section className="relative overflow-hidden">
      <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
        {banners.map((banner, index) => {
          const isActive = activeIndex === index;
          const shouldRender = visibleSet.has(index);

          return (
            <div
              key={banner.id}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 transition-opacity duration-700",
                isActive ? "opacity-100" : "opacity-0",
              )}
            >
              {shouldRender ? (
                <Image
                  src={banner.thumbnail}
                  alt={banner.title}
                  fill
                  preload={index === 0}
                  loading={index === 0 ? undefined : "lazy"}
                  decoding="async"
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  className="object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-8 sm:px-8 sm:pb-12 lg:px-12">
                <div className="mx-auto w-full max-w-7xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-200">
                    Featured
                  </p>
                  <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                    {banner.title}
                  </h1>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/movie/${banner.id}`}
                      prefetch={false}
                      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-500"
                    >
                      <Play className="size-4 fill-current" />
                      Tonton sekarang
                    </Link>
                    <Link
                      href={`/movie/${banner.id}`}
                      prefetch={false}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                    >
                      Detail
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {banners.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Banner sebelumnya"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60 sm:inline-flex"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Banner berikutnya"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60 sm:inline-flex"
            >
              <ChevronRight className="size-5" />
            </button>

            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
              {banners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Pilih banner ${index + 1}`}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-all",
                    activeIndex === index
                      ? "bg-white"
                      : "bg-white/30 hover:bg-white/50",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <span className="sr-only">{activeBanner.title}</span>
    </section>
  );
}
