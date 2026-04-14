"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import {
  resolveSyncPage,
  syncAllMovieFeeds,
  syncMovieFeed,
  type MovieFeedTarget,
} from "@/lib/movie-sync";

function buildSingleTargetParams(
  target: MovieFeedTarget,
  page: number,
  summary: Awaited<ReturnType<typeof syncMovieFeed>>,
) {
  return new URLSearchParams({
    active: String(summary.active),
    created: String(summary.created),
    deactivated: String(summary.deactivated),
    duplicateSkipped: String(summary.duplicateSkipped),
    errors: String(summary.errors.length),
    existing: String(summary.existing),
    fetched: String(summary.fetched),
    message: summary.errors[0] ?? "",
    page: String(page),
    skippedUnsupported: String(summary.skippedUnsupported),
    sync: summary.errors.length ? "partial" : "ok",
    target,
    unchanged: String(summary.unchanged),
    updated: String(summary.updated),
    upserted: String(summary.upserted),
  });
}

function buildAllTargetsParams(
  page: number,
  summary: Awaited<ReturnType<typeof syncAllMovieFeeds>>,
) {
  const home = summary.targets.home;
  const popular = summary.targets.popular;
  const latest = summary.targets.new;
  const syncState = Object.values(summary.targets).some((item) => item.errors.length)
    ? "partial"
    : "ok";

  return new URLSearchParams({
    page: String(page),
    sync: syncState,
    target: "all",
    totalCreated: String(summary.totalCreated),
    totalDuplicateSkipped: String(summary.totalDuplicateSkipped),
    totalErrors: String(
      home.errors.length + popular.errors.length + latest.errors.length,
    ),
    totalExisting: String(summary.totalExisting),
    totalFetched: String(summary.totalFetched),
    totalSkippedUnsupported: String(summary.totalSkippedUnsupported),
    totalUnchanged: String(summary.totalUnchanged),
    totalUpdated: String(summary.totalUpdated),
    message: home.errors[0] ?? popular.errors[0] ?? latest.errors[0] ?? "",
    homeCreated: String(home.created),
    homeExisting: String(home.existing),
    homeFetched: String(home.fetched),
    homeSkippedUnsupported: String(home.skippedUnsupported),
    homeUnchanged: String(home.unchanged),
    homeUpdated: String(home.updated),
    homeErrors: String(home.errors.length),
    popularCreated: String(popular.created),
    popularExisting: String(popular.existing),
    popularFetched: String(popular.fetched),
    popularSkippedUnsupported: String(popular.skippedUnsupported),
    popularUnchanged: String(popular.unchanged),
    popularUpdated: String(popular.updated),
    popularErrors: String(popular.errors.length),
    newCreated: String(latest.created),
    newExisting: String(latest.existing),
    newFetched: String(latest.fetched),
    newSkippedUnsupported: String(latest.skippedUnsupported),
    newUnchanged: String(latest.unchanged),
    newUpdated: String(latest.updated),
    newErrors: String(latest.errors.length),
  });
}

export async function syncMoviesFromAdmin(formData: FormData) {
  await requireAdminSession();
  const rawTarget = String(formData.get("target") ?? "");
  const page = resolveSyncPage(formData.get("page"));
  const target =
    rawTarget === "home" || rawTarget === "popular" || rawTarget === "new"
      ? rawTarget
      : rawTarget === "all"
        ? "all"
        : "home";

  let redirectPath = `/admin?sync=ok&target=${target}&page=${page}`;

  try {
    const params =
      target === "all"
        ? buildAllTargetsParams(page, await syncAllMovieFeeds({ pages: 1 }))
        : buildSingleTargetParams(target, page, await syncMovieFeed(target, { page }));

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/browse/home");
    revalidatePath("/browse/populer");
    revalidatePath("/browse/new");
    redirectPath = `/admin?${params.toString()}`;
  } catch (error) {
    const params = new URLSearchParams({
      message: error instanceof Error ? error.message : "Sync gagal",
      page: String(page),
      sync: "error",
      target,
    });

    redirectPath = `/admin?${params.toString()}`;
  }

  redirect(redirectPath);
}

export async function logoutAdmin() {
  await requireAdminSession();
  await clearAdminSessionCookie();

  redirect("/admin/login");
}
