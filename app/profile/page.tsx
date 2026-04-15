import Image from "next/image";
import { MessageCircle, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import { requireUserSession } from "@/lib/user-auth";
import { getVipProgramSettingsSafe, getVipStatus } from "@/lib/vip";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ProfilePage() {
  const [user, backdropMovies, vipSettingsResult] = await Promise.all([
    requireUserSession(),
    getCinematicBackdropMovies(),
    getVipProgramSettingsSafe(),
  ]);
  const vipStatus = getVipStatus(user);
  const vipSettings = vipSettingsResult.settings;

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

          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {user.telegramPhotoUrl ? (
                <div className="relative size-14 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                  <Image
                    src={user.telegramPhotoUrl}
                    alt={user.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-bold text-white ring-1 ring-white/10">
                  {initials(user.name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-white">
                  {user.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">

                  <span className="truncate text-sm text-neutral-300">
                    {user.telegramUsername
                      ? `@${user.telegramUsername}`
                      : user.email ?? `ID ${user.telegramId}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(80,22,114,0.28),rgba(21,18,28,0.86))] p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="size-4 text-orange-300" />
              Status VIP
            </p>
            {vipStatus.active ? (
              <>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  Akunmu sedang VIP. Preview otomatis dimatikan dan semua akses penuh tetap aktif sampai masa berlangganan berakhir.
                </p>
                <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                    Aktif sampai
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {vipStatus.expiresAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          month: "long",
                          year: "numeric",
                        }).format(vipStatus.expiresAt)
                      : "-"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-neutral-200">
                  Akunmu masih mode gratis. Preview akan berhenti otomatis setelah{" "}
                  {vipSettings.previewEnabled
                    ? `${vipSettings.previewLimitMinutes} menit`
                    : "batas yang diatur admin"}
                  .
                </p>
                <Button
                  asChild
                  className="mt-4 h-11 bg-red-600 text-white hover:bg-red-500"
                >
                  <a href={vipSettings.joinVipUrl}>
                    {vipSettings.joinVipLabel}
                  </a>
                </Button>
              </>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <MessageCircle className="size-4 text-red-300" />
                Username
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                {user.telegramUsername
                  ? `@${user.telegramUsername}`
                  : "Belum ada username publik"}
              </p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <UserRound className="size-4 text-red-300" />
                Identitas
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                {user.telegramId
                  ? `Telegram ID ${user.telegramId}`
                  : "Akun web lokal"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
