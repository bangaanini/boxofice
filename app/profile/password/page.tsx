import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { Button } from "@/components/ui/button";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import { requireUserSession } from "@/lib/user-auth";

export default async function ProfilePasswordPage() {
  const [, backdropMovies] = await Promise.all([
    requireUserSession(),
    getCinematicBackdropMovies(),
  ]);

  const heroMovie = backdropMovies[0] ?? null;

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
            className="object-cover opacity-[0.14]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.24)_0%,rgba(0,0,0,0.8)_20%,#060606_58%,#050505_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(220,38,38,0.18),transparent_28%)]" />
        </div>
      ) : null}

      <section className="relative z-10 mx-auto w-full max-w-md">
        <Button
          asChild
          variant="ghost"
          className="mb-5 w-fit px-0 text-neutral-300 hover:bg-transparent hover:text-white"
        >
          <Link href="/profile">
            <ArrowLeft className="size-4" />
            Kembali ke profil
          </Link>
        </Button>

        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.82),rgba(8,8,8,0.95))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <span className="inline-flex rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
            Security
          </span>
          <h1 className="mt-4 text-4xl font-black leading-none text-white">
            Ganti Password
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-300">
            Jaga akunmu tetap aman dan siap dipakai kapan saja.
          </p>

          <div className="mt-8">
            <ChangePasswordForm />
          </div>
        </div>
      </section>
    </main>
  );
}
