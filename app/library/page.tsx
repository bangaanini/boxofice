import Image from "next/image";
import Link from "next/link";
import { Bookmark, Clock3, Play, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { requireUserSession } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LibraryPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

type LibraryMovie = {
  id: string;
  quality: string | null;
  rating: string | null;
  thumbnail: string | null;
  title: string;
};

function formatWatchTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function progressPercent(progressSeconds: number, durationSeconds: number | null) {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (progressSeconds / durationSeconds) * 100));
}

function LibraryTabs({
  activeTab,
  collectionCount,
  historyCount,
}: {
  activeTab: "collection" | "history";
  collectionCount: number;
  historyCount: number;
}) {
  const tabs = [
    {
      count: collectionCount,
      href: "/library?tab=collection",
      icon: Bookmark,
      id: "collection",
      label: "Koleksi",
    },
    {
      count: historyCount,
      href: "/library?tab=history",
      icon: Clock3,
      id: "history",
      label: "History",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-white/10 bg-white/[0.04] p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors",
              isActive
                ? "bg-red-600 text-white"
                : "text-neutral-400 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
            <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px]">
              {tab.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function MoviePoster({ movie }: { movie: LibraryMovie }) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-900 ring-1 ring-white/10">
      {movie.thumbnail ? (
        <Image
          src={movie.thumbnail}
          alt={`${movie.title} poster`}
          fill
          unoptimized
          sizes="(max-width: 640px) 38vw, 180px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-3 text-center text-xs text-neutral-500">
          Poster belum tersedia
        </div>
      )}
      {movie.quality ? (
        <div className="absolute bottom-2 left-2">
          <Badge className="border-red-300/30 bg-red-600 text-white">
            {movie.quality}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}

function CollectionGrid({
  favorites,
}: {
  favorites: Array<{
    createdAt: Date;
    movie: LibraryMovie;
  }>;
}) {
  if (!favorites.length) {
    return (
      <EmptyState
        description="Tekan Simpan di halaman detail film. Semua judul yang kamu pilih akan muncul di sini."
        title="Koleksimu masih kosong"
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {favorites.map((favorite) => (
        <Link
          key={favorite.movie.id}
          href={`/movie/${favorite.movie.id}`}
          prefetch
          className="group outline-none transition-transform active:scale-[0.98] sm:hover:-translate-y-1"
        >
          <MoviePoster movie={favorite.movie} />
          <div className="space-y-2 px-1 py-3">
            <h2 className="line-clamp-2 min-h-9 text-sm font-semibold leading-[18px] text-white">
              {favorite.movie.title}
            </h2>
            <p className="inline-flex items-center gap-1 text-xs text-neutral-400">
              <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
              {favorite.movie.rating ?? "N/A"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function HistoryList({
  histories,
}: {
  histories: Array<{
    durationSeconds: number | null;
    lastWatchedAt: Date;
    movie: LibraryMovie;
    progressSeconds: number;
  }>;
}) {
  if (!histories.length) {
    return (
      <EmptyState
        description="Mulai tonton film, lalu progres terakhirnya akan otomatis tersimpan di sini."
        title="Belum ada riwayat tontonan"
      />
    );
  }

  return (
    <div className="space-y-3">
      {histories.map((history) => {
        const progress = progressPercent(
          history.progressSeconds,
          history.durationSeconds,
        );

        return (
          <Link
            key={history.movie.id}
            href={`/movie/${history.movie.id}?play=resume`}
            prefetch
            className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-md border border-white/10 bg-white/[0.04] p-2 transition-colors hover:bg-white/[0.08] sm:grid-cols-[120px_minmax(0,1fr)]"
          >
            <MoviePoster movie={history.movie} />
            <div className="flex min-w-0 flex-col justify-center py-1">
              <p className="line-clamp-2 text-base font-bold text-white sm:text-lg">
                {history.movie.title}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock3 className="size-3.5" />
                Terakhir di {formatWatchTime(history.progressSeconds)}
                {history.durationSeconds
                  ? ` dari ${formatWatchTime(history.durationSeconds)}`
                  : ""}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-red-600"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950">
                <Play className="size-3.5 fill-current" />
                Lanjutkan
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] px-5 py-10 text-center">
      <p className="text-xl font-bold text-white">{title}</p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-400">
        {description}
      </p>
      <Link
        href="/"
        prefetch
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white"
      >
        Cari tontonan
      </Link>
    </div>
  );
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const [user, params] = await Promise.all([
    requireUserSession(),
    searchParams,
  ]);
  const activeTab = params.tab === "history" ? "history" : "collection";
  const [favorites, histories] = await Promise.all([
    prisma.userFavorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        movie: {
          select: {
            id: true,
            quality: true,
            rating: true,
            thumbnail: true,
            title: true,
          },
        },
      },
    }),
    prisma.watchHistory.findMany({
      where: { userId: user.id },
      orderBy: { lastWatchedAt: "desc" },
      select: {
        durationSeconds: true,
        lastWatchedAt: true,
        movie: {
          select: {
            id: true,
            quality: true,
            rating: true,
            thumbnail: true,
            title: true,
          },
        },
        progressSeconds: true,
      },
      take: 50,
    }),
  ]);

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-6 text-white sm:px-8 sm:py-8 lg:px-10">
      <section className="mx-auto w-full max-w-6xl">
        <p className="text-sm font-semibold text-red-400">Perpustakaan</p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">
          Koleksi dan tontonanmu
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          Simpan film favoritmu dan lanjutkan tontonan dari posisi terakhir.
        </p>

        <div className="mt-6">
          <LibraryTabs
            activeTab={activeTab}
            collectionCount={favorites.length}
            historyCount={histories.length}
          />
        </div>

        <div className="mt-6">
          {activeTab === "collection" ? (
            <CollectionGrid favorites={favorites} />
          ) : (
            <HistoryList histories={histories} />
          )}
        </div>
      </section>
    </main>
  );
}
