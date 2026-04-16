import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Calendar, Clapperboard, Star, Users } from "lucide-react";

import { ImmersiveHidden } from "@/components/feedback/immersive-hidden";
import { DetailWatchActions } from "@/components/movie/detail-watch-actions";
import { MovieCardLink } from "@/components/movie/movie-card-link";
import { SynopsisAccordion } from "@/components/movie/synopsis-accordion";
import { Badge } from "@/components/ui/badge";
import { ensureAffiliateProfileWithCode } from "@/lib/affiliate";
import {
  getMovieDetailData,
  getRelatedMovies,
  type MovieCard,
} from "@/lib/movie-feeds";
import { prisma } from "@/lib/prisma";
import {
  getEnvPublicAppUrl,
  getSeoMetadataSnapshot,
  getTelegramBotSettingsSafe,
} from "@/lib/telegram-bot-settings";
import { getPreferredTelegramShareLinksForUser } from "@/lib/telegram-partner-bots";
import {
  buildTelegramAppStartParam,
  buildTelegramBotChatUrlForUsername,
  buildTelegramMainMiniAppUrlForUsername,
  extractAffiliateCodeFromStartParam,
} from "@/lib/telegram-miniapp";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getVipProgramSettingsSafe, getVipStatus } from "@/lib/vip";
import { isBlockedMovieCandidate } from "@/lib/movie-visibility";

export const dynamic = "force-dynamic";

type MoviePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    play?: string;
    ref?: string;
    start_param?: string;
    startapp?: string;
    tgWebAppStartParam?: string;
  }>;
};

function formatReleaseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildMovieDescription(movie: {
  description: string | null;
  genre: string | null;
  title: string;
  year: string | null;
}) {
  const rawDescription =
    movie.description?.trim() ||
    `Tonton ${movie.title}${movie.year ? ` (${movie.year})` : ""} di Layar BoxOffice langsung dari Telegram.`;

  const compactDescription = rawDescription.replace(/\s+/g, " ").trim();

  if (compactDescription.length <= 180) {
    return compactDescription;
  }

  return `${compactDescription.slice(0, 177).trimEnd()}...`;
}

export async function generateMetadata({
  params,
}: Pick<MoviePageProps, "params">): Promise<Metadata> {
  const { id } = await params;
  const [movie, telegram] = await Promise.all([
    getMovieDetailData(id),
    getTelegramBotSettingsSafe(),
  ]);

  if (!movie) {
    return {
      title: "Film tidak ditemukan",
    };
  }

  const seo = getSeoMetadataSnapshot(telegram.settings);
  const title = movie.year ? `${movie.title} (${movie.year})` : movie.title;
  const description = buildMovieDescription(movie);
  const canonicalUrl = `${telegram.runtime.publicAppUrl || getEnvPublicAppUrl()}/movie/${movie.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      siteName: seo.brandName,
      type: "video.movie",
      url: canonicalUrl,
      images: movie.thumbnail
        ? [
            {
              url: movie.thumbnail,
              alt: `Poster ${movie.title}`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: movie.thumbnail ? [movie.thumbnail] : undefined,
    },
  };
}

function MovieCredits({
  actors,
  directors,
}: {
  actors: string[];
  directors: string[];
}) {
  return (
    <dl className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2 sm:pt-6">
      <div>
        <dt className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
          <Users className="size-4 text-red-400" />
          Pemeran
        </dt>
        <dd className="mt-2 text-sm leading-6 text-neutral-200">
          {actors.length ? actors.slice(0, 6).join(", ") : "Pemeran belum tersedia"}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-2 text-sm font-semibold text-neutral-400">
          <Clapperboard className="size-4 text-red-400" />
          Sutradara
        </dt>
        <dd className="mt-2 text-sm leading-6 text-neutral-200">
          {directors.length
            ? directors.slice(0, 3).join(", ")
            : "Sutradara belum tersedia"}
        </dd>
      </div>
    </dl>
  );
}

function RelatedMoviesSection({ movies }: { movies: MovieCard[] }) {
  if (!movies.length) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-1 sm:px-8 sm:pb-12 sm:pt-4 lg:px-10">
      <div className="mb-3 flex items-center justify-between gap-4 sm:mb-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Film serupa
        </h2>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {movies.map((movie) => (
          <MovieCardLink
            key={movie.id}
            movie={movie}
            className="w-[132px] shrink-0 sm:w-[180px] sm:hover:-translate-y-1"
          />
        ))}
      </div>
    </section>
  );
}

export default async function MoviePage({ params, searchParams }: MoviePageProps) {
  const [{ id }, query, user, vipSettingsResult] = await Promise.all([
    params,
    searchParams,
    getCurrentUserSession(),
    getVipProgramSettingsSafe(),
  ]);
  const movie = await getMovieDetailData(id);

  if (!movie) {
    notFound();
  }

  if (isBlockedMovieCandidate(movie)) {
    notFound();
  }
  const incomingReferralCode = extractAffiliateCodeFromStartParam(
    query.ref ??
      query.start_param ??
      query.startapp ??
      query.tgWebAppStartParam ??
      null,
  );
  const [favorite, relatedMovies, telegram] = await Promise.all([
    user
      ? prisma.userFavorite.findUnique({
          where: {
            userId_movieId: {
              movieId: movie.id,
              userId: user.id,
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve(null),
    getRelatedMovies({
      currentMovieId: movie.id,
      genre: movie.genre,
      inHome: movie.inHome,
      inNew: movie.inNew,
      inPopular: movie.inPopular,
      limit: 14,
    }),
    !user ? getTelegramBotSettingsSafe() : Promise.resolve(null),
  ]);
  const shouldOpenPlayer = query.play === "1" || query.play === "true";
  const vipStatus = getVipStatus(user ?? {});
  const vipSettings = vipSettingsResult.settings;

  const poster = movie.thumbnail;
  const fallbackSynopsis =
    movie.description ??
    "Sinopsis belum tersedia. Video akan disiapkan otomatis saat kamu menekan tombol tonton.";
  const shareDescription = buildMovieDescription(movie);
  const releaseDate = formatReleaseDate(movie.releaseDate ?? undefined);
  const affiliateProfile = user
    ? await ensureAffiliateProfileWithCode({
        id: user.id,
        name: user.name,
      }).catch(() => null)
    : null;
  const shareReferralCode = affiliateProfile?.referralCode ?? incomingReferralCode;
  const shareUrl = new URL(`/movie/${movie.id}`, getEnvPublicAppUrl());

  if (shareReferralCode) {
    shareUrl.searchParams.set("ref", shareReferralCode);
  }

  const telegramShareStartParam = affiliateProfile?.referralCode
    ? buildTelegramAppStartParam({
        movieId: movie.id,
        referralCode: affiliateProfile.referralCode,
      })
    : "";
  const telegramShareLinks =
    telegramShareStartParam && affiliateProfile?.referralCode && user
      ? await getPreferredTelegramShareLinksForUser({
          startParam: telegramShareStartParam,
          userId: user.id,
        }).catch(() => null)
      : null;
  const telegramShareUrl =
    telegramShareLinks?.mainMiniAppUrl ||
    telegramShareLinks?.miniAppUrl ||
    telegramShareLinks?.chatUrl ||
    null;
  const authStartParam = buildTelegramAppStartParam({
    movieId: movie.id,
    referralCode: incomingReferralCode,
  });
  const authBotChatUrl = telegram
    ? buildTelegramBotChatUrlForUsername(telegram.runtime.botUsername, authStartParam)
    : null;
  const authMiniAppUrl = telegram
    ? buildTelegramMainMiniAppUrlForUsername(
        telegram.runtime.botUsername,
        authStartParam,
      )
    : null;

  if (Boolean(user) && shouldOpenPlayer) {
    redirect(`/watch/${movie.id}`);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative isolate overflow-hidden">
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="object-cover object-center"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.12)_28%,rgba(0,0,0,0.58)_58%,rgba(0,0,0,0.92)_82%,#000_100%)] sm:bg-[linear-gradient(90deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.42)_28%,rgba(0,0,0,0.7)_56%,rgba(0,0,0,0.96)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.58)_26%,#000_100%)] sm:h-56" />

        <div className="relative z-10 mx-auto flex min-h-[76svh] w-full max-w-7xl flex-col justify-end px-4 pb-6 pt-[calc(env(safe-area-inset-top)+28px)] sm:min-h-[92svh] sm:px-8 sm:pb-10 sm:pt-[calc(env(safe-area-inset-top)+48px)] lg:px-10">
          <div className="max-w-3xl space-y-3 sm:space-y-5">
            <div className="pt-4 sm:pt-6">
              <div className="rounded-[24px] border border-white/10 bg-black/10 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-[2px] sm:max-w-2xl sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
              <DetailWatchActions
                authBotChatUrl={authBotChatUrl}
                authMiniAppUrl={authMiniAppUrl}
                initialSaved={Boolean(favorite)}
                movieId={movie.id}
                requiresAuth={!user}
                shareText={shareDescription}
                shareUrl={shareUrl.toString()}
                telegramShareUrl={telegramShareUrl}
                title={movie.title}
              />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {movie.quality ? (
                <Badge className="border-red-300/30 bg-red-600 text-white">
                  {movie.quality}
                </Badge>
              ) : null}
              <Badge className="border-white/10 bg-white/10 text-white">
                {vipStatus.active
                  ? "VIP aktif"
                  : vipSettings.previewEnabled
                    ? `Preview ${vipSettings.previewLimitMinutes} menit`
                    : "Akses standar"}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-300">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                {movie.rating ?? "N/A"}
              </span>
              {movie.year ? (
                <span className="text-sm text-neutral-300">{movie.year}</span>
              ) : null}
              {releaseDate ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-neutral-300">
                  <Calendar className="size-4" />
                  {releaseDate}
                </span>
              ) : null}
              {movie.duration ? (
                <span className="text-sm text-neutral-300">{movie.duration}</span>
              ) : null}
            </div>

            <div>
              <h1 className="max-w-4xl text-3xl font-black leading-tight text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)] sm:text-6xl sm:leading-none lg:text-7xl">
                {movie.title}
              </h1>
            </div>

            {movie.genre ? (
              <p className="max-w-2xl text-sm font-medium text-neutral-200 sm:text-base">
                {movie.genre}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-5 lg:px-10">
        <div className="max-w-3xl space-y-5 sm:space-y-6">
          <SynopsisAccordion text={fallbackSynopsis} />
          <MovieCredits actors={movie.actors} directors={movie.directors} />
        </div>
      </section>

      <ImmersiveHidden>
        <RelatedMoviesSection movies={relatedMovies} />
      </ImmersiveHidden>
    </main>
  );
}
