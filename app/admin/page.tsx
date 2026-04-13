import Link from "next/link";
import { LogOut, Play, RefreshCw, ShieldCheck } from "lucide-react";

import { logoutAdmin, syncMoviesFromAdmin } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/admin-session";
import { DEFAULT_SYNC_PAGES, MAX_SYNC_PAGES } from "@/lib/movie-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getAdminDashboardData() {
  const [totalMovies, homeCount, popularCount, newCount] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { inHome: true } }),
    prisma.movie.count({ where: { inPopular: true } }),
    prisma.movie.count({ where: { inNew: true } }),
  ]);

  return {
    homeCount,
    newCount,
    popularCount,
    totalMovies,
  };
}

type AdminPageProps = {
  searchParams: Promise<{
    active?: string;
    deactivated?: string;
    fetched?: string;
    message?: string;
    pages?: string;
    sync?: string;
    target?: string;
    upserted?: string;
  }>;
};

const FEED_BUTTONS = [
  { label: "Sync Home", target: "home" },
  { label: "Sync Populer", target: "popular" },
  { label: "Sync New", target: "new" },
] as const;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const session = await requireAdminSession();
  const { totalMovies, homeCount, popularCount, newCount } =
    await getAdminDashboardData();

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 bg-neutral-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-400">
              <ShieldCheck className="size-4" />
              Admin aktif
            </p>
            <h1 className="mt-2 text-3xl font-black leading-none sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-neutral-400">{session.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button asChild className="h-11">
              <Link href="/">
                <Play className="size-4 fill-current" />
                Lihat App
              </Link>
            </Button>
            <form action={logoutAdmin} className="col-span-2 sm:col-span-1">
              <Button
                type="submit"
                variant="ghost"
                className="h-11 w-full border border-white/10"
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
        {params.sync ? (
          <div className="mb-5 rounded-md border border-white/10 bg-white/[0.06] p-4 text-sm leading-6 text-neutral-200">
            {params.sync === "error" ? (
              <span className="text-red-200">
                Sync {params.target ?? "feed"} gagal:{" "}
                {params.message ?? "upstream tidak merespons"}
              </span>
            ) : (
              <span>
                Sync {params.target ?? "feed"} {params.pages ?? DEFAULT_SYNC_PAGES} page selesai. Fetched{" "}
                {params.fetched ?? "0"}, upserted {params.upserted ?? "0"},
                aktif {params.active ?? "0"}, dinonaktifkan{" "}
                {params.deactivated ?? "0"}.
              </span>
            )}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-neutral-400">Film home</p>
            <p className="mt-2 text-3xl font-black">{homeCount}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-neutral-400">Film populer</p>
            <p className="mt-2 text-3xl font-black">{popularCount}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-neutral-400">Film new</p>
            <p className="mt-2 text-3xl font-black">{newCount}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm text-neutral-400">Total film</p>
            <p className="mt-2 text-3xl font-black">{totalMovies}</p>
          </div>
        </div>

        <div className="mt-8 rounded-md border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <p className="text-sm font-semibold text-red-400">Sinkronisasi feed</p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">
            Jalankan per endpoint
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
            Sinkronkan metadata lokal langsung dari kategori home, populer, dan
            new. Halaman depan akan otomatis mengikuti hasil sync terakhir.
          </p>

          <form action={syncMoviesFromAdmin} className="mt-5 space-y-4">
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-neutral-300">
                Jumlah page per sync
              </label>
              <input
                name="pages"
                type="number"
                min={1}
                max={MAX_SYNC_PAGES}
                defaultValue={params.pages ?? String(DEFAULT_SYNC_PAGES)}
                className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-base text-white outline-none focus:border-red-400"
              />
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                Maksimal {MAX_SYNC_PAGES} page per endpoint untuk sekali jalan.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {FEED_BUTTONS.map((item) => (
                <Button
                  key={item.target}
                  type="submit"
                  name="target"
                  value={item.target}
                  variant="secondary"
                  className="h-12 w-full border border-white/10 bg-white/10 text-white hover:bg-white/15"
                >
                  <RefreshCw className="size-4" />
                  {item.label}
                </Button>
              ))}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
