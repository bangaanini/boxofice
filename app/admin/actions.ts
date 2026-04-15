"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAffiliateProgramSettingsSafe } from "@/lib/affiliate";
import { sanitizeAdminRedirectPath } from "@/lib/admin-auth";
import { clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import { getTelegramBotSettingsSafe } from "@/lib/telegram-bot-settings";
import {
  auditMovieCatalog,
  cleanupMovieTitles,
  resolveSyncPage,
  syncMovieFeed,
  type MovieFeedTarget,
} from "@/lib/movie-sync";
import { prisma } from "@/lib/prisma";
import { getVipProgramSettingsSafe } from "@/lib/vip";

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

function buildSingleAuditParams(
  target: MovieFeedTarget,
  summary: Awaited<ReturnType<typeof auditMovieCatalog>>,
) {
  const resolvedSummary = summary as Extract<
    Awaited<ReturnType<typeof auditMovieCatalog>>,
    { target: MovieFeedTarget }
  >;

  return new URLSearchParams({
    audit: resolvedSummary.errors.length ? "partial" : "ok",
    auditBroken: String(resolvedSummary.broken),
    auditChecked: String(resolvedSummary.checked),
    auditErrors: String(resolvedSummary.errors.length),
    auditHidden: String(resolvedSummary.hidden),
    auditMessage: resolvedSummary.errors[0] ?? "",
    auditPlayable: String(resolvedSummary.playable),
    auditRefreshed: String(resolvedSummary.refreshed),
    auditTarget: target,
  });
}

function buildAllAuditParams(
  summary: Extract<
    Awaited<ReturnType<typeof auditMovieCatalog>>,
    { targets: Record<MovieFeedTarget, unknown> }
  >,
) {
  const home = summary.targets.home;
  const popular = summary.targets.popular;
  const latest = summary.targets.new;

  return new URLSearchParams({
    audit: summary.totalErrors > 0 ? "partial" : "ok",
    auditBroken: String(summary.totalBroken),
    auditChecked: String(summary.totalChecked),
    auditErrors: String(summary.totalErrors),
    auditHidden: String(summary.totalHidden),
    auditMessage:
      summary.errors[0] ??
      home.errors[0] ??
      popular.errors[0] ??
      latest.errors[0] ??
      "",
    auditPlayable: String(summary.totalPlayable),
    auditRefreshed: String(summary.totalRefreshed),
    auditTarget: "all",
    auditHomeBroken: String(home.broken),
    auditHomeChecked: String(home.checked),
    auditHomeErrors: String(home.errors.length),
    auditHomeHidden: String(home.hidden),
    auditHomePlayable: String(home.playable),
    auditPopularBroken: String(popular.broken),
    auditPopularChecked: String(popular.checked),
    auditPopularErrors: String(popular.errors.length),
    auditPopularHidden: String(popular.hidden),
    auditPopularPlayable: String(popular.playable),
    auditNewBroken: String(latest.broken),
    auditNewChecked: String(latest.checked),
    auditNewErrors: String(latest.errors.length),
    auditNewHidden: String(latest.hidden),
    auditNewPlayable: String(latest.playable),
  });
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

export async function auditCatalogFromAdmin(formData: FormData) {
  await requireAdminSession();
  const rawTarget = String(formData.get("target") ?? "");
  const redirectBasePath = resolveRedirectTarget(formData, "/admin/sync");
  const target =
    rawTarget === "home" || rawTarget === "popular" || rawTarget === "new"
      ? rawTarget
      : rawTarget === "all"
        ? "all"
        : "all";

  let redirectPath = `${redirectBasePath}?audit=ok&auditTarget=${target}`;

  try {
    const summary = await auditMovieCatalog(target, {
      autoHide: formData.get("autoHideBroken") === "on",
    });
    const params =
      target === "all"
        ? buildAllAuditParams(
            summary as Extract<
              Awaited<ReturnType<typeof auditMovieCatalog>>,
              { targets: Record<MovieFeedTarget, unknown> }
            >,
          )
        : buildSingleAuditParams(
            target,
            summary as Extract<
              Awaited<ReturnType<typeof auditMovieCatalog>>,
              { target: MovieFeedTarget }
            >,
          );

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/sync");
    revalidatePath("/browse/home");
    revalidatePath("/browse/populer");
    revalidatePath("/browse/new");
    redirectPath = `${redirectBasePath}?${params.toString()}`;
  } catch (error) {
    const params = new URLSearchParams({
      audit: "error",
      auditMessage: error instanceof Error ? error.message : "Audit gagal",
      auditTarget: target,
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

function readTextField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readNullableTextField(formData: FormData, key: string) {
  const value = readTextField(formData, key);

  return value || null;
}

function readRequiredUrlField(formData: FormData, key: string, label: string) {
  const value = readTextField(formData, key);

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }

    return url.toString();
  } catch {
    redirect(
      `/admin/settings?bot=error&message=${encodeURIComponent(`${label} wajib berupa URL yang valid.`)}`,
    );
  }
}

function readNullableUrlField(formData: FormData, key: string, label: string) {
  const value = readTextField(formData, key);

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }

    return url.toString();
  } catch {
    redirect(
      `/admin/settings?bot=error&message=${encodeURIComponent(`${label} wajib berupa URL yang valid.`)}`,
    );
  }
}

function readPositiveIntegerField(
  formData: FormData,
  key: string,
  fallback: number,
) {
  const rawValue = Number(formData.get(key) ?? fallback);
  const safeValue = Number.isFinite(rawValue) ? Math.trunc(rawValue) : fallback;

  return Math.max(1, safeValue);
}

export async function updateTelegramBotSettings(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/settings");
  const settingsResult = await getTelegramBotSettingsSafe();

  if (!settingsResult.schemaReady) {
    redirect(
      `${redirectBasePath}?bot=error&message=${encodeURIComponent(
        settingsResult.schemaIssue ??
          "Database runtime belum siap untuk menyimpan pengaturan bot.",
      )}`,
    );
  }

  const welcomeMessage = readTextField(formData, "welcomeMessage");

  if (welcomeMessage.length < 20) {
    redirect(
      `${redirectBasePath}?bot=error&message=${encodeURIComponent("Pesan sambutan minimal 20 karakter.")}`,
    );
  }

  const payload = {
    affiliateGroupLabel: readTextField(formData, "affiliateGroupLabel") || "🏠 Group Affiliate",
    affiliateGroupUrl: readRequiredUrlField(
      formData,
      "affiliateGroupUrl",
      "URL group affiliate",
    ),
    affiliateLabel: readTextField(formData, "affiliateLabel") || "💰 Gabung Affiliate",
    affiliateUrl: readRequiredUrlField(
      formData,
      "affiliateUrl",
      "URL tombol affiliate",
    ),
    botToken: readNullableTextField(formData, "botToken"),
    botUsername: readNullableTextField(formData, "botUsername"),
    channelLabel: readTextField(formData, "channelLabel") || "🎥 Film Box Office",
    channelUrl: readRequiredUrlField(formData, "channelUrl", "URL channel film"),
    miniAppShortName: readNullableTextField(formData, "miniAppShortName"),
    openAppLabel: readTextField(formData, "openAppLabel") || "🎬 Buka",
    openAppUrl: readRequiredUrlField(formData, "openAppUrl", "URL tombol buka"),
    publicAppUrl: readNullableUrlField(
      formData,
      "publicAppUrl",
      "Public App URL",
    ),
    searchLabel: readTextField(formData, "searchLabel") || "🔎 Cari Judul",
    searchUrl: readRequiredUrlField(formData, "searchUrl", "URL tombol cari"),
    supportLabel: readTextField(formData, "supportLabel") || "📞 Hubungi Admin",
    supportUrl: readRequiredUrlField(formData, "supportUrl", "URL support admin"),
    vipLabel: readTextField(formData, "vipLabel") || "💎 Join VIP",
    vipUrl: readRequiredUrlField(formData, "vipUrl", "URL tombol VIP"),
    webhookSecret: readNullableTextField(formData, "webhookSecret"),
    welcomeMessage,
  };

  await prisma.telegramBotSettings.update({
    where: { id: settingsResult.settings.id },
    data: payload,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");

  redirect(
    `${redirectBasePath}?bot=ok&message=${encodeURIComponent("Konfigurasi bot Telegram berhasil diperbarui.")}`,
  );
}

export async function updateVipProgramSettings(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/settings");
  const settingsResult = await getVipProgramSettingsSafe();

  if (!settingsResult.schemaReady) {
    redirect(
      `${redirectBasePath}?vip=error&message=${encodeURIComponent(
        settingsResult.schemaIssue ??
          "Database runtime belum siap untuk menyimpan pengaturan VIP.",
      )}`,
    );
  }

  const previewEnabled = formData.get("previewEnabled") === "on";
  const previewLimitMinutes = readPositiveIntegerField(
    formData,
    "previewLimitMinutes",
    settingsResult.settings.previewLimitMinutes,
  );
  const joinVipLabel = readTextField(formData, "joinVipLabel") || "Buka VIP";
  const joinVipUrl = readRequiredUrlField(formData, "joinVipUrl", "URL tombol VIP");
  const paywallTitle = readTextField(formData, "paywallTitle") || "Lanjutkan dengan VIP";
  const paywallDescription = readTextField(formData, "paywallDescription");

  if (paywallDescription.length < 12) {
    redirect(
      `${redirectBasePath}?vip=error&message=${encodeURIComponent("Deskripsi paywall minimal 12 karakter.")}`,
    );
  }

  await prisma.vipProgramSettings.update({
    where: { id: settingsResult.settings.id },
    data: {
      joinVipLabel,
      joinVipUrl,
      paywallDescription,
      paywallTitle,
      previewEnabled,
      previewLimitMinutes,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/profile");

  redirect(
    `${redirectBasePath}?vip=ok&message=${encodeURIComponent("Pengaturan VIP berhasil diperbarui.")}`,
  );
}

export async function updateUserVipStatus(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/users");
  const userId = readTextField(formData, "userId");
  const intent = readTextField(formData, "intent");
  const durationDays = readPositiveIntegerField(formData, "vipDays", 30);

  if (!userId) {
    redirect(
      `${redirectBasePath}?vip=error&message=${encodeURIComponent("User VIP tidak ditemukan.")}`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, vipExpiresAt: true },
  });

  if (!user) {
    redirect(
      `${redirectBasePath}?vip=error&message=${encodeURIComponent("User VIP tidak ditemukan.")}`,
    );
  }

  if (intent === "revoke") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        vipExpiresAt: null,
        vipStartedAt: null,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/");
    revalidatePath("/profile");

    redirect(
      `${redirectBasePath}?vip=ok&message=${encodeURIComponent(`VIP untuk ${user.name} berhasil dicabut.`)}`,
    );
  }

  const baseDate =
    user.vipExpiresAt && user.vipExpiresAt.getTime() > Date.now()
      ? user.vipExpiresAt
      : new Date();
  const nextExpiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      vipExpiresAt: nextExpiresAt,
      vipStartedAt: new Date(),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/");
  revalidatePath("/profile");

  redirect(
    `${redirectBasePath}?vip=ok&message=${encodeURIComponent(
      `VIP untuk ${user.name} aktif sampai ${new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(nextExpiresAt)}.`,
    )}`,
  );
}

export async function logoutAdmin() {
  await requireAdminSession();
  await clearAdminSessionCookie();

  redirect("/admin/login");
}
