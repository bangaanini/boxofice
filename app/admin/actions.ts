"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAffiliateProgramSettingsSafe } from "@/lib/affiliate";
import { sanitizeAdminRedirectPath } from "@/lib/admin-auth";
import { clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import {
  cleanupMovieTitles,
  resolveSyncPage,
  syncMovieFeed,
  type MovieFeedTarget,
} from "@/lib/movie-sync";
import { prisma } from "@/lib/prisma";

function resolveRedirectTarget(
  formData: FormData,
  fallbackPath: string,
) {
  const path = sanitizeAdminRedirectPath(formData.get("redirectTo"));

  return path || fallbackPath;
}

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
  summary: {
    targets: Record<
      MovieFeedTarget,
      Awaited<ReturnType<typeof syncMovieFeed>>
    >;
    totalCreated: number;
    totalDuplicateSkipped: number;
    totalErrors: number;
    totalExisting: number;
    totalFetched: number;
    totalSkippedUnsupported: number;
    totalUnchanged: number;
    totalUpdated: number;
  },
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
    totalErrors: String(summary.totalErrors),
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

async function syncAllFeedsForPage(page: number) {
  const [home, popular, latest] = await Promise.all([
    syncMovieFeed("home", { page }),
    syncMovieFeed("popular", { page }),
    syncMovieFeed("new", { page }),
  ]);

  return {
    targets: {
      home,
      new: latest,
      popular,
    },
    totalCreated: home.created + popular.created + latest.created,
    totalDuplicateSkipped:
      home.duplicateSkipped +
      popular.duplicateSkipped +
      latest.duplicateSkipped,
    totalErrors: home.errors.length + popular.errors.length + latest.errors.length,
    totalExisting: home.existing + popular.existing + latest.existing,
    totalFetched: home.fetched + popular.fetched + latest.fetched,
    totalSkippedUnsupported:
      home.skippedUnsupported +
      popular.skippedUnsupported +
      latest.skippedUnsupported,
    totalUnchanged: home.unchanged + popular.unchanged + latest.unchanged,
    totalUpdated: home.updated + popular.updated + latest.updated,
  };
}

export async function syncMoviesFromAdmin(formData: FormData) {
  await requireAdminSession();
  const rawTarget = String(formData.get("target") ?? "");
  const page = resolveSyncPage(formData.get("page"));
  const redirectBasePath = resolveRedirectTarget(formData, "/admin/sync");
  const target =
    rawTarget === "home" || rawTarget === "popular" || rawTarget === "new"
      ? rawTarget
      : rawTarget === "all"
        ? "all"
        : "home";

  let redirectPath = `${redirectBasePath}?sync=ok&target=${target}&page=${page}`;

  try {
    const params =
      target === "all"
        ? buildAllTargetsParams(page, await syncAllFeedsForPage(page))
        : buildSingleTargetParams(target, page, await syncMovieFeed(target, { page }));

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/sync");
    revalidatePath("/admin/users");
    revalidatePath("/admin/settings");
    revalidatePath("/browse/home");
    revalidatePath("/browse/populer");
    revalidatePath("/browse/new");
    redirectPath = `${redirectBasePath}?${params.toString()}`;
  } catch (error) {
    const params = new URLSearchParams({
      message: error instanceof Error ? error.message : "Sync gagal",
      page: String(page),
      sync: "error",
      target,
    });

    redirectPath = `${redirectBasePath}?${params.toString()}`;
  }

  redirect(redirectPath);
}

export async function cleanupMovieTitlesFromAdmin(formData: FormData) {
  await requireAdminSession();
  const redirectBasePath = resolveRedirectTarget(formData, "/admin/sync");

  let redirectPath = `${redirectBasePath}?titleCleanup=ok`;

  try {
    const summary = await cleanupMovieTitles();
    const params = new URLSearchParams({
      titleCleanup: "ok",
      titleChanged: String(summary.changed),
      titleScanned: String(summary.scanned),
      titleUnchanged: String(summary.unchanged),
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/sync");
    revalidatePath("/browse/home");
    revalidatePath("/browse/populer");
    revalidatePath("/browse/new");
    redirectPath = `${redirectBasePath}?${params.toString()}`;
  } catch (error) {
    const params = new URLSearchParams({
      message:
        error instanceof Error ? error.message : "Gagal membersihkan judul",
      titleCleanup: "error",
    });

    redirectPath = `${redirectBasePath}?${params.toString()}`;
  }

  redirect(redirectPath);
}

export async function updateAffiliateProgramSettings(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/settings");
  const rawRate = Number(formData.get("defaultCommissionRate") ?? 0);
  const defaultCommissionRate = Math.trunc(rawRate);

  if (!Number.isFinite(defaultCommissionRate) || defaultCommissionRate < 1) {
    redirect(
      `${redirectBasePath}?settings=error&message=${encodeURIComponent("Presentase komisi minimal 1%.")}`,
    );
  }

  if (defaultCommissionRate > 100) {
    redirect(
      `${redirectBasePath}?settings=error&message=${encodeURIComponent("Presentase komisi maksimal 100%.")}`,
    );
  }

  const applyToExisting = formData.get("applyToExisting") === "on";
  const settingsResult = await getAffiliateProgramSettingsSafe();

  if (!settingsResult.schemaReady) {
    redirect(
      `${redirectBasePath}?settings=error&message=${encodeURIComponent(
        settingsResult.schemaIssue ??
          "Database runtime belum siap untuk menyimpan setting affiliate.",
      )}`,
    );
  }
  const settings = settingsResult.settings;

  await prisma.$transaction(async (tx) => {
    await tx.affiliateProgramSettings.update({
      where: { id: settings.id },
      data: {
        defaultCommissionRate,
      },
    });

    if (applyToExisting) {
      await tx.affiliateProfile.updateMany({
        data: {
          commissionRate: defaultCommissionRate,
        },
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/settings");
  revalidatePath("/affiliate");

  const params = new URLSearchParams({
    applyToExisting: applyToExisting ? "1" : "0",
    message: "Presentase komisi berhasil diperbarui.",
    rate: String(defaultCommissionRate),
    settings: "ok",
  });

  redirect(`${redirectBasePath}?${params.toString()}`);
}

export async function logoutAdmin() {
  await requireAdminSession();
  await clearAdminSessionCookie();

  redirect("/admin/login");
}
