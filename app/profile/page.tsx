import Image from "next/image";
import Link from "next/link";
import { ChevronRight, KeyRound, LogOut, Mail } from "lucide-react";

import { logoutUserAction } from "@/app/user-auth/actions";
import { Button } from "@/components/ui/button";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import { requireUserSession } from "@/lib/user-auth";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ProfilePage() {
  const [user, backdropMovies] = await Promise.all([
    requireUserSession(),
    getCinematicBackdropMovies(),
  ]);

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
            className="object-cover opacity-[0.16]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.72)_20%,#080808_58%,#050505_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(220,38,38,0.24),transparent_28%)]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(220,38,38,0.18),transparent_24%),linear-gradient(180deg,#110909_0%,#050505_100%)]" />
      )}

      <section className="relative z-10 mx-auto w-full max-w-md">


        {stackMovies.length ? (
          <div className="pointer-events-none mt-4 flex gap-3 opacity-35">
            {stackMovies.map((movie, index) => (
              <div
                key={movie.id}
                className="relative aspect-[2/3] w-[82px] overflow-hidden rounded-md border border-white/8 shadow-2xl"
                style={{
                  transform: `translateY(${index * 10}px) rotate(${index === 1 ? "-5deg" : index === 2 ? "4deg" : "0deg"})`,
                }}
              >
                <Image
                  src={movie.thumbnail}
                  alt=""
                  fill
                  sizes="82px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/30" />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.82),rgba(8,8,8,0.95))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-300">
            Account
          </p>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-bold text-white ring-1 ring-white/10">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-white">
                  {user.name}
                </p>
                <p className="mt-1 inline-flex max-w-full items-center gap-2 truncate text-sm text-neutral-300">
                  <Mail className="size-4 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </p>
              </div>
            </div>

            <form action={logoutUserAction}>
              <Button
                type="submit"
                className="h-10 rounded-md bg-red-600 px-4 text-white shadow-[0_12px_24px_rgba(220,38,38,0.28)] hover:bg-red-500"
              >
                <LogOut className="size-4" />
                Keluar
              </Button>
            </form>
          </div>

          <p className="mt-5 text-sm leading-6 text-neutral-300">
            Simpan akunmu untuk lanjut menonton lebih cepat di perangkat ini.
          </p>
        </div>

        <div className="mt-4">
          <Link
            href="/profile/password"
            className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-4 transition-colors hover:bg-white/[0.08]"
          >
            <span className="inline-flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-red-500/10 text-red-200 ring-1 ring-red-400/10">
                <KeyRound className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  Ganti Password
                </span>
                <span className="block text-xs text-neutral-400">
                  Perbarui akses akunmu
                </span>
              </span>
            </span>
            <ChevronRight className="size-5 text-neutral-500" />
          </Link>
        </div>
      </section>
    </main>
  );
}
