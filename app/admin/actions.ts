"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/app/generated/prisma/client";
import {
  ensureAffiliateProfile,
  getAffiliateProgramSettingsSafe,
} from "@/lib/affiliate";
import { sanitizeAdminRedirectPath } from "@/lib/admin-auth";
import { clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import { getPaymentGatewaySettingsSafe } from "@/lib/payments";
import { getTelegramBotProfile } from "@/lib/telegram-bot-api";
import { sendTelegramUserMessage } from "@/lib/telegram-bot";
import {
  publishChannelBroadcast,
} from "@/lib/channel-broadcasts";
import { isDynamicTelegramDeepLink } from "@/lib/telegram-link-policy";
import {
  buildLegacyInlineButtonsFromSettings,
  getTelegramBotSettingsSafe,
  type TelegramInlineButtonConfig,
} from "@/lib/telegram-bot-settings";
import { createPartnerBotWebhookSecret } from "@/lib/telegram-partner-bots";
import {
  auditMovieCatalog,
  cleanupMovieTitles,
  hideRedirectMovies,
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
    totalDeactivated: number;
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
    totalDeactivated: String(summary.totalDeactivated),
    totalDuplicateSkipped: String(summary.totalDuplicateSkipped),
    totalErrors: String(summary.totalErrors),
    totalExisting: String(summary.totalExisting),
    totalFetched: String(summary.totalFetched),
    totalSkippedUnsupported: String(summary.totalSkippedUnsupported),
    totalUnchanged: String(summary.totalUnchanged),
    totalUpdated: String(summary.totalUpdated),
    message: home.errors[0] ?? popular.errors[0] ?? latest.errors[0] ?? "",
    homeCreated: String(home.created),
    homeDeactivated: String(home.deactivated),
    homeExisting: String(home.existing),
    homeFetched: String(home.fetched),
    homeSkippedUnsupported: String(home.skippedUnsupported),
    homeUnchanged: String(home.unchanged),
    homeUpdated: String(home.updated),
    homeErrors: String(home.errors.length),
    popularCreated: String(popular.created),
    popularDeactivated: String(popular.deactivated),
    popularExisting: String(popular.existing),
    popularFetched: String(popular.fetched),
    popularSkippedUnsupported: String(popular.skippedUnsupported),
    popularUnchanged: String(popular.unchanged),
    popularUpdated: String(popular.updated),
    popularErrors: String(popular.errors.length),
    newCreated: String(latest.created),
    newDeactivated: String(latest.deactivated),
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
    totalDeactivated:
      home.deactivated + popular.deactivated + latest.deactivated,
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

export async function hideRedirectMoviesFromAdmin(formData: FormData) {
  await requireAdminSession();
  const redirectBasePath = resolveRedirectTarget(formData, "/admin/sync");

  let redirectPath = `${redirectBasePath}?redirectCleanup=ok`;

  try {
    const summary = await hideRedirectMovies();
    const params = new URLSearchParams({
      redirectCleanup: "ok",
      redirectHidden: String(summary.hidden),
      redirectAlreadyHidden: String(summary.alreadyHidden),
      redirectMatched: String(summary.matched),
      redirectScanned: String(summary.scanned),
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/sync");
    revalidatePath("/browse/home");
    revalidatePath("/browse/populer");
    revalidatePath("/browse/new");
    revalidatePath("/search");
    redirectPath = `${redirectBasePath}?${params.toString()}`;
  } catch (error) {
    const params = new URLSearchParams({
      message:
        error instanceof Error ? error.message : "Gagal menyembunyikan judul redirect",
      redirectCleanup: "error",
    });

    redirectPath = `${redirectBasePath}?${params.toString()}`;
  }

  redirect(redirectPath);
}

export async function refreshWebCacheFromAdmin(formData: FormData) {
  await requireAdminSession();
  const redirectBasePath = resolveRedirectTarget(formData, "/admin/sync");

  try {
    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/library");
    revalidatePath("/browse/[slug]", "page");
    revalidatePath("/movie/[id]", "page");
    revalidatePath("/movie/source");
    revalidatePath("/admin");
    revalidatePath("/admin/sync");

    redirect(
      `${redirectBasePath}?webCache=ok&message=${encodeURIComponent(
        "Cache web berhasil direfresh. Halaman user akan mengikuti data terbaru setelah reload berikutnya.",
      )}`,
    );
  } catch (error) {
    redirect(
      `${redirectBasePath}?webCache=error&message=${encodeURIComponent(
        error instanceof Error ? error.message : "Gagal refresh cache web",
      )}`,
    );
  }
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
  const howItWorksContent = readTextField(formData, "howItWorksContent");
  const rulesContent = readTextField(formData, "rulesContent");

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

  if (howItWorksContent.length < 20 || !howItWorksContent.includes("\n")) {
    redirect(
      `${redirectBasePath}?settings=error&message=${encodeURIComponent("Cara kerja affiliate perlu diisi minimal satu blok judul dan deskripsi.")}`,
    );
  }

  if (rulesContent.length < 20 || !rulesContent.includes("\n")) {
    redirect(
      `${redirectBasePath}?settings=error&message=${encodeURIComponent("Aturan affiliate perlu diisi minimal satu blok pertanyaan dan jawaban.")}`,
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
        howItWorksContent,
        rulesContent,
      },
    });

    if (applyToExisting) {
      await tx.affiliateProfile.updateMany({
        data: {
          commissionRate: defaultCommissionRate,
          commissionRateOverride: null,
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

function readRequiredUrlField(
  formData: FormData,
  key: string,
  label: string,
  redirectBasePath = "/admin/settings",
  statusKey = "bot",
) {
  const value = readTextField(formData, key);

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }

    return url.toString();
  } catch {
    redirect(
      `${redirectBasePath}?${statusKey}=error&message=${encodeURIComponent(`${label} wajib berupa URL yang valid.`)}`,
    );
  }
}

function readInlineButtonUrlField(
  formData: FormData,
  key: string,
  label: string,
  redirectBasePath = "/admin/bot-message",
  statusKey = "botUi",
) {
  const value = readTextField(formData, key);

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }

    if (isDynamicTelegramDeepLink(url)) {
      redirect(
        `${redirectBasePath}?${statusKey}=error&message=${encodeURIComponent(
          `${label} tidak boleh memakai dynamic deep link Telegram. Gunakan link bot biasa atau URL web app langsung.`,
        )}`,
      );
    }

    return url.toString();
  } catch {
    redirect(
      `${redirectBasePath}?${statusKey}=error&message=${encodeURIComponent(`${label} wajib berupa URL yang valid.`)}`,
    );
  }
}

function readNullableUrlField(
  formData: FormData,
  key: string,
  label: string,
  redirectBasePath = "/admin/settings",
  statusKey = "bot",
) {
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
      `${redirectBasePath}?${statusKey}=error&message=${encodeURIComponent(`${label} wajib berupa URL yang valid.`)}`,
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

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function readTelegramInlineButtons(
  formData: FormData,
  redirectBasePath: string,
): TelegramInlineButtonConfig[] {
  const buttons: TelegramInlineButtonConfig[] = [];

  for (let index = 0; index < 10; index += 1) {
    const buttonNumber = index + 1;
    const label = readTextField(formData, `buttonLabel_${buttonNumber}`);
    const url = readTextField(formData, `buttonUrl_${buttonNumber}`);
    const enabled = formData.get(`buttonEnabled_${buttonNumber}`) === "on";

    if (enabled && !label) {
      redirect(
        `${redirectBasePath}?botUi=error&message=${encodeURIComponent(
          `Label tombol ${buttonNumber} wajib diisi jika tombol diaktifkan.`,
        )}`,
      );
    }

    let normalizedUrl = url;

    if (enabled && !url) {
      redirect(
        `${redirectBasePath}?botUi=error&message=${encodeURIComponent(
          `URL tombol ${buttonNumber} wajib diisi jika tombol diaktifkan.`,
        )}`,
      );
    }

    if (url) {
      normalizedUrl = readInlineButtonUrlField(
        formData,
        `buttonUrl_${buttonNumber}`,
        `URL tombol ${buttonNumber}`,
        redirectBasePath,
        "botUi",
      );
    }

    buttons.push({
      enabled: enabled && Boolean(label && normalizedUrl),
      id: `button${buttonNumber}`,
      label,
      url: normalizedUrl,
    });
  }

  return buttons;
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

  const seoDescription = readTextField(formData, "seoDescription");

  if (seoDescription.length < 40) {
    redirect(
      `${redirectBasePath}?bot=error&message=${encodeURIComponent("Deskripsi SEO minimal 40 karakter.")}`,
    );
  }

  const payload = {
    appShortName: readTextField(formData, "appShortName") || "Layar Box Office",
    brandName: readTextField(formData, "brandName") || "Layar Box Office",
    botToken: readNullableTextField(formData, "botToken"),
    botUsername: readNullableTextField(formData, "botUsername"),
    miniAppShortName: readNullableTextField(formData, "miniAppShortName"),
    ownerTelegramId: readNullableTextField(formData, "ownerTelegramId"),
    publicAppUrl: readNullableUrlField(
      formData,
      "publicAppUrl",
      "Public App URL",
      redirectBasePath,
    ),
    seoDescription,
    seoKeywords: readNullableTextField(formData, "seoKeywords"),
    seoTitle: readTextField(formData, "seoTitle") || "Layar Box Office",
    webhookSecret: readNullableTextField(formData, "webhookSecret"),
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

export async function updateTelegramBotPresentationSettings(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/bot-message");
  const settingsResult = await getTelegramBotSettingsSafe();

  if (!settingsResult.schemaReady) {
    redirect(
      `${redirectBasePath}?botUi=error&message=${encodeURIComponent(
        settingsResult.schemaIssue ??
          "Database runtime belum siap untuk menyimpan pesan bot.",
      )}`,
    );
  }

  const welcomeMessage = readTextField(formData, "welcomeMessage");

  if (welcomeMessage.length < 20) {
    redirect(
      `${redirectBasePath}?botUi=error&message=${encodeURIComponent(
        "Pesan sambutan minimal 20 karakter.",
      )}`,
    );
  }

  const inlineButtons = readTelegramInlineButtons(formData, redirectBasePath);
  const hasActiveButton = inlineButtons.some((button) => button.enabled);

  if (!hasActiveButton) {
    redirect(
      `${redirectBasePath}?botUi=error&message=${encodeURIComponent(
        "Minimal aktifkan satu tombol inline.",
      )}`,
    );
  }

  const legacyButtons = buildLegacyInlineButtonsFromSettings({
    affiliateGroupLabel: settingsResult.settings.affiliateGroupLabel,
    affiliateGroupUrl: settingsResult.settings.affiliateGroupUrl,
    affiliateLabel: settingsResult.settings.affiliateLabel,
    affiliateUrl: settingsResult.settings.affiliateUrl,
    channelLabel: settingsResult.settings.channelLabel,
    channelUrl: settingsResult.settings.channelUrl,
    openAppLabel: settingsResult.settings.openAppLabel,
    openAppUrl: settingsResult.settings.openAppUrl,
    searchLabel: settingsResult.settings.searchLabel,
    searchUrl: settingsResult.settings.searchUrl,
    supportLabel: settingsResult.settings.supportLabel,
    supportUrl: settingsResult.settings.supportUrl,
    vipLabel: settingsResult.settings.vipLabel,
    vipUrl: settingsResult.settings.vipUrl,
  });

  const data = {
    inlineButtons: inlineButtons as unknown as Prisma.InputJsonValue,
    welcomeMessage,
    ...(inlineButtons[0]
      ? {
          openAppLabel: inlineButtons[0].label || legacyButtons[0].label,
          openAppUrl: inlineButtons[0].url || legacyButtons[0].url,
        }
      : {}),
    ...(inlineButtons[1]
      ? {
          searchLabel: inlineButtons[1].label || legacyButtons[1].label,
          searchUrl: inlineButtons[1].url || legacyButtons[1].url,
        }
      : {}),
    ...(inlineButtons[2]
      ? {
          affiliateLabel: inlineButtons[2].label || legacyButtons[2].label,
          affiliateUrl: inlineButtons[2].url || legacyButtons[2].url,
        }
      : {}),
    ...(inlineButtons[3]
      ? {
          affiliateGroupLabel:
            inlineButtons[3].label || legacyButtons[3].label,
          affiliateGroupUrl: inlineButtons[3].url || legacyButtons[3].url,
        }
      : {}),
    ...(inlineButtons[4]
      ? {
          channelLabel: inlineButtons[4].label || legacyButtons[4].label,
          channelUrl: inlineButtons[4].url || legacyButtons[4].url,
        }
      : {}),
    ...(inlineButtons[5]
      ? {
          supportLabel: inlineButtons[5].label || legacyButtons[5].label,
          supportUrl: inlineButtons[5].url || legacyButtons[5].url,
        }
      : {}),
    ...(inlineButtons[6]
      ? {
          vipLabel: inlineButtons[6].label || legacyButtons[6].label,
          vipUrl: inlineButtons[6].url || legacyButtons[6].url,
        }
      : {}),
  };

  await prisma.telegramBotSettings.update({
    where: { id: settingsResult.settings.id },
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/bot-message");

  redirect(
    `${redirectBasePath}?botUi=ok&message=${encodeURIComponent(
      "Pesan bot dan inline keyboard berhasil diperbarui.",
    )}`,
  );
}

export async function savePartnerBotFromAdmin(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/partners");
  const ownerUserId = readTextField(formData, "ownerUserId");
  const partnerBotId = readNullableTextField(formData, "partnerBotId");
  const botToken = readTextField(formData, "botToken");
  const defaultChannelUsername = readNullableTextField(
    formData,
    "defaultChannelUsername",
  );
  const label = readNullableTextField(formData, "label");
  const miniAppShortName = readNullableTextField(formData, "miniAppShortName");
  const active = formData.get("active") === "on";

  if (!ownerUserId) {
    redirect(
      `${redirectBasePath}?partner=error&message=${encodeURIComponent("Pemilik bot wajib dipilih.")}`,
    );
  }

  if (!botToken) {
    redirect(
      `${redirectBasePath}?partner=error&message=${encodeURIComponent("Bot token Telegram wajib diisi.")}`,
    );
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!owner) {
    redirect(
      `${redirectBasePath}?partner=error&message=${encodeURIComponent("User pemilik bot tidak ditemukan.")}`,
    );
  }

  await ensureAffiliateProfile({
    id: owner.id,
    name: owner.name,
  });

  const botProfile = await getTelegramBotProfile(botToken).catch((error) => {
    redirect(
      `${redirectBasePath}?partner=error&message=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : "Bot token Telegram tidak valid.",
      )}`,
    );
  });

  const existingByTelegramBotId = await prisma.partnerBot.findUnique({
    where: { telegramBotId: botProfile.telegramBotId },
    select: {
      id: true,
      webhookSecret: true,
    },
  });

  if (
    partnerBotId &&
    existingByTelegramBotId &&
    existingByTelegramBotId.id !== partnerBotId
  ) {
    redirect(
      `${redirectBasePath}?partner=error&message=${encodeURIComponent(
        `Bot @${botProfile.botUsername} sudah terdaftar di record lain.`,
      )}`,
    );
  }

  const recordId = partnerBotId || existingByTelegramBotId?.id || null;
  const payload = {
    active,
    botName: botProfile.botName,
    botToken: botToken.trim(),
    botUsername: botProfile.botUsername,
    defaultChannelUsername,
    label,
    miniAppShortName,
    ownerUserId: owner.id,
    telegramBotId: botProfile.telegramBotId,
    webhookSecret:
      existingByTelegramBotId?.webhookSecret ?? createPartnerBotWebhookSecret(),
  };

  if (recordId) {
    await prisma.partnerBot.update({
      where: { id: recordId },
      data: payload,
    });
  } else {
    await prisma.partnerBot.create({
      data: payload,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/partners");
  revalidatePath("/admin/users");
  revalidatePath("/affiliate");

  redirect(
    `${redirectBasePath}?partner=ok&message=${encodeURIComponent(
      `Bot @${botProfile.botUsername} berhasil ${recordId ? "diperbarui" : "ditambahkan"}.`,
    )}`,
  );
}

export async function publishAdminChannelBroadcastAction(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(
    formData,
    "/admin/channel-broadcasts",
  );
  const channelUsername = readTextField(formData, "channelUsername");
  const movieId = readTextField(formData, "movieId");
  const caption = readTextField(formData, "caption");
  const buttonLabel = readTextField(formData, "buttonLabel");
  const pinMessage = formData.get("pinMessage") === "on";
  const includeMainBot = formData.get("includeMainBot") === "on";
  const selectedPartnerBotIds = formData
    .getAll("partnerBotIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!movieId) {
    redirect(
      `${redirectBasePath}?broadcast=error&message=${encodeURIComponent("Pilih film yang ingin dibroadcast dulu.")}`,
    );
  }

  if (!includeMainBot && selectedPartnerBotIds.length === 0) {
    redirect(
      `${redirectBasePath}?broadcast=error&message=${encodeURIComponent("Pilih minimal satu target broadcast.")}`,
    );
  }

  const telegram = await getTelegramBotSettingsSafe();
  const selectedPartnerBots = selectedPartnerBotIds.length
    ? await prisma.partnerBot.findMany({
        where: {
          active: true,
          id: {
            in: selectedPartnerBotIds,
          },
        },
        select: {
          botName: true,
          botToken: true,
          botUsername: true,
          defaultChannelUsername: true,
          id: true,
          label: true,
          miniAppShortName: true,
          ownerUserId: true,
        },
      })
    : [];

  const targetErrors: string[] = [];
  const successLabels: string[] = [];

  if (includeMainBot) {
    if (!telegram.runtime.botToken?.trim() || !telegram.runtime.botUsername?.trim()) {
      targetErrors.push("Bot utama belum lengkap. Isi bot token dan username lebih dulu.");
    } else if (!channelUsername) {
      targetErrors.push("Channel default bot utama belum diisi di form broadcast.");
    } else {
      try {
        const result = await publishChannelBroadcast({
          botKind: "default",
          botToken: telegram.runtime.botToken,
          botUsername: telegram.runtime.botUsername,
          buttonLabel,
          caption,
          channelUsername,
          miniAppShortName: telegram.runtime.miniAppShortName,
          movieId,
          pinMessage,
        });

        successLabels.push(
          result.pinError
            ? `bot utama terkirim, tapi pin gagal`
            : "bot utama terkirim",
        );
      } catch (error) {
        targetErrors.push(
          `Bot utama: ${
            error instanceof Error ? error.message : "Broadcast gagal dikirim."
          }`,
        );
      }
    }
  }

  for (const partnerBot of selectedPartnerBots) {
    if (!partnerBot.defaultChannelUsername?.trim()) {
      targetErrors.push(
        `${partnerBot.label?.trim() || partnerBot.botName} belum punya channel default.`,
      );
      continue;
    }

    try {
      const result = await publishChannelBroadcast({
        botKind: "partner",
        botToken: partnerBot.botToken,
        botUsername: partnerBot.botUsername,
        buttonLabel,
        caption,
        channelUsername: partnerBot.defaultChannelUsername,
        miniAppShortName: partnerBot.miniAppShortName,
        movieId,
        ownerUserId: partnerBot.ownerUserId,
        partnerBotId: partnerBot.id,
        pinMessage,
      });

      successLabels.push(
        result.pinError
          ? `${partnerBot.label?.trim() || partnerBot.botName} terkirim, tapi pin gagal`
          : `${partnerBot.label?.trim() || partnerBot.botName} terkirim`,
      );
    } catch (error) {
      targetErrors.push(
        `${partnerBot.label?.trim() || partnerBot.botName}: ${
          error instanceof Error ? error.message : "Broadcast gagal dikirim."
        }`,
      );
    }
  }

  revalidatePath("/admin/channel-broadcasts");
  revalidatePath("/partner-bot/broadcast");

  if (!successLabels.length) {
    redirect(
      `${redirectBasePath}?broadcast=error&message=${encodeURIComponent(
        targetErrors[0] ?? "Broadcast tidak berhasil dikirim ke target mana pun.",
      )}`,
    );
  }

  const summary = [
    `${successLabels.length} target berhasil`,
    targetErrors.length ? `${targetErrors.length} target gagal` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const detail = targetErrors.length ? ` (${targetErrors.join(" | ")})` : "";

  redirect(
    `${redirectBasePath}?broadcast=ok&message=${encodeURIComponent(`${summary}${detail}`)}`,
  );
}

export async function deletePartnerBotFromAdmin(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/partners");
  const partnerBotId = readTextField(formData, "partnerBotId");

  if (!partnerBotId) {
    redirect(
      `${redirectBasePath}?partner=error&message=${encodeURIComponent("Partner bot tidak ditemukan.")}`,
    );
  }

  const existing = await prisma.partnerBot.findUnique({
    where: { id: partnerBotId },
    select: {
      botUsername: true,
      id: true,
    },
  });

  if (!existing) {
    redirect(
      `${redirectBasePath}?partner=error&message=${encodeURIComponent("Partner bot tidak ditemukan.")}`,
    );
  }

  await prisma.partnerBot.delete({
    where: { id: existing.id },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/partners");
  revalidatePath("/affiliate");

  redirect(
    `${redirectBasePath}?partner=ok&message=${encodeURIComponent(
      `Bot @${existing.botUsername} berhasil dihapus.`,
    )}`,
  );
}

export async function updateVipProgramSettings(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/vip");
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
  const joinVipUrl = readRequiredUrlField(
    formData,
    "joinVipUrl",
    "URL tombol VIP",
    redirectBasePath,
    "vip",
  );
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
  revalidatePath("/admin/vip");
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/vip");

  redirect(
      `${redirectBasePath}?vip=ok&message=${encodeURIComponent("Pengaturan VIP berhasil diperbarui.")}`,
    );
}

export async function updatePaymentGatewaySettings(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/payments");
  const settingsResult = await getPaymentGatewaySettingsSafe();

  if (!settingsResult.schemaReady) {
    redirect(
      `${redirectBasePath}?payment=error&message=${encodeURIComponent(
        settingsResult.schemaIssue ??
          "Database runtime belum siap untuk menyimpan payment gateway.",
      )}`,
    );
  }

  const provider = readTextField(formData, "provider") || "paymenku";
  const checkoutButtonLabel =
    readTextField(formData, "checkoutButtonLabel") || "Aktifkan sekarang";

  if (provider !== "paymenku") {
    redirect(
      `${redirectBasePath}?payment=error&message=${encodeURIComponent("Untuk tahap ini provider yang didukung baru Paymenku.")}`,
    );
  }

  await prisma.paymentGatewaySettings.update({
    where: { id: settingsResult.settings.id },
    data: {
      checkoutButtonLabel,
      enabled: formData.get("enabled") === "on",
      provider,
      stripePublishableKey: null,
      stripeSecretKey: readNullableTextField(formData, "paymenkuApiKey"),
      stripeWebhookSecret: readNullableTextField(formData, "paymenkuWebhookToken"),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/vip");

  redirect(
    `${redirectBasePath}?payment=ok&message=${encodeURIComponent("Payment gateway berhasil diperbarui.")}`,
  );
}

export async function publishMainChannelBroadcastAction(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(
    formData,
    "/admin/channel-broadcasts",
  );
  const channelUsername = readTextField(formData, "channelUsername");
  const movieId = readTextField(formData, "movieId");
  const caption = readTextField(formData, "caption");
  const buttonLabel = readTextField(formData, "buttonLabel");
  const pinMessage = formData.get("pinMessage") === "on";

  if (!movieId) {
    redirect(
      `${redirectBasePath}?broadcast=error&message=${encodeURIComponent("Pilih film yang ingin dibroadcast dulu.")}`,
    );
  }

  const telegram = await getTelegramBotSettingsSafe();

  if (!telegram.runtime.botToken?.trim() || !telegram.runtime.botUsername?.trim()) {
    redirect(
      `${redirectBasePath}?broadcast=error&message=${encodeURIComponent("Bot utama belum lengkap. Isi bot token dan username lebih dulu.")}`,
    );
  }

  let successMessage = "";

  try {
    const result = await publishChannelBroadcast({
      botKind: "default",
      botToken: telegram.runtime.botToken,
      botUsername: telegram.runtime.botUsername,
      buttonLabel,
      caption,
      channelUsername,
      miniAppShortName: telegram.runtime.miniAppShortName,
      movieId,
      pinMessage,
    });

    revalidatePath("/admin/channel-broadcasts");

    successMessage = result.pinError
      ? `Broadcast terkirim, tapi pin post gagal: ${result.pinError}`
      : "Broadcast channel berhasil dikirim.";
  } catch (error) {
    redirect(
      `${redirectBasePath}?broadcast=error&message=${encodeURIComponent(error instanceof Error ? error.message : "Broadcast channel gagal dikirim.")}`,
    );
  }

  redirect(
    `${redirectBasePath}?broadcast=ok&message=${encodeURIComponent(successMessage)}`,
  );
}

export async function createOrUpdateVipPlan(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/payments");
  const planId = readTextField(formData, "planId");
  const title = readTextField(formData, "title");
  const description = readTextField(formData, "description");
  const slug = slugify(readTextField(formData, "slug") || title);
  const durationDays = readPositiveIntegerField(formData, "durationDays", 30);
  const priceAmount = readPositiveIntegerField(formData, "priceAmount", 49000);
  const sortOrder = readPositiveIntegerField(formData, "sortOrder", 1);
  const currency = readTextField(formData, "currency").toUpperCase() || "IDR";

  if (title.length < 3) {
    redirect(
      `${redirectBasePath}?plan=error&message=${encodeURIComponent("Judul paket minimal 3 karakter.")}`,
    );
  }

  if (description.length < 12) {
    redirect(
      `${redirectBasePath}?plan=error&message=${encodeURIComponent("Deskripsi paket minimal 12 karakter.")}`,
    );
  }

  if (!slug) {
    redirect(
      `${redirectBasePath}?plan=error&message=${encodeURIComponent("Slug paket belum valid.")}`,
    );
  }

  const payload = {
    active: formData.get("active") === "on",
    badge: readNullableTextField(formData, "badge"),
    ctaLabel: readTextField(formData, "ctaLabel") || "Aktifkan sekarang",
    currency,
    description,
    durationDays,
    highlight: formData.get("highlight") === "on",
    priceAmount,
    slug,
    sortOrder,
    title,
  };

  try {
    if (planId) {
      await prisma.vipPlan.update({
        where: { id: planId },
        data: payload,
      });
    } else {
      await prisma.vipPlan.create({
        data: payload,
      });
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      String(error.code) === "P2002"
    ) {
      redirect(
        `${redirectBasePath}?plan=error&message=${encodeURIComponent("Slug paket sudah dipakai. Gunakan slug lain.")}`,
      );
    }

    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/vip");

  redirect(
    `${redirectBasePath}?plan=ok&message=${encodeURIComponent(
      planId ? "Paket VIP berhasil diperbarui." : "Paket VIP baru berhasil ditambahkan.",
    )}`,
  );
}

export async function updateUserAffiliateCommission(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/users");
  const userId = readTextField(formData, "userId");
  const rawRate = String(formData.get("commissionRateOverride") ?? "").trim();
  const settingsResult = await getAffiliateProgramSettingsSafe();

  if (!userId) {
    redirect(
      `${redirectBasePath}?user=error&message=${encodeURIComponent("User affiliate tidak ditemukan.")}`,
    );
  }

  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!profile) {
    redirect(
      `${redirectBasePath}?user=error&message=${encodeURIComponent("Profil affiliate user belum tersedia.")}`,
    );
  }

  if (!rawRate) {
    await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        commissionRateOverride: null,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/affiliate");

    redirect(
      `${redirectBasePath}?user=updated&message=${encodeURIComponent(
        `Komisi ${profile.user.name} kembali mengikuti global ${settingsResult.settings.defaultCommissionRate}%.`,
      )}`,
    );
  }

  const rate = Math.trunc(Number(rawRate));

  if (!Number.isFinite(rate) || rate < 1 || rate > 100) {
    redirect(
      `${redirectBasePath}?user=error&message=${encodeURIComponent("Komisi individu harus di antara 1% sampai 100%.")}`,
    );
  }

  await prisma.affiliateProfile.update({
    where: { id: profile.id },
    data: {
      commissionRateOverride: rate,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/affiliate");

  redirect(
    `${redirectBasePath}?user=updated&message=${encodeURIComponent(
      `Komisi individu ${profile.user.name} disetel ke ${rate}%.`,
    )}`,
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

export async function deleteUserAccount(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/users");
  const userId = readTextField(formData, "userId");

  if (!userId) {
    redirect(
      `${redirectBasePath}?user=error&message=${encodeURIComponent("User tidak ditemukan.")}`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      id: true,
      name: true,
    },
  });

  if (!user) {
    redirect(
      `${redirectBasePath}?user=error&message=${encodeURIComponent("User tidak ditemukan atau sudah dihapus.")}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const referral = await tx.affiliateReferral.findUnique({
      where: { referredUserId: user.id },
      select: {
        commissionEarned: true,
        profile: {
          select: {
            activeReferrals: true,
            availableBalance: true,
            id: true,
            totalCommission: true,
            totalSignups: true,
          },
        },
        status: true,
      },
    });

    if (referral) {
      const shouldReduceActiveReferral = referral.status === "active";

      await tx.affiliateProfile.update({
        where: { id: referral.profile.id },
        data: {
          activeReferrals: shouldReduceActiveReferral
            ? Math.max(0, referral.profile.activeReferrals - 1)
            : referral.profile.activeReferrals,
          availableBalance: Math.max(
            0,
            referral.profile.availableBalance - referral.commissionEarned,
          ),
          totalCommission: Math.max(
            0,
            referral.profile.totalCommission - referral.commissionEarned,
          ),
          totalSignups: Math.max(0, referral.profile.totalSignups - 1),
        },
      });

      if (referral.commissionEarned > 0) {
        await tx.affiliateActivity.create({
          data: {
            amount: -referral.commissionEarned,
            description:
              `User referral ${user.name} dihapus oleh admin. ` +
              "Komisi test dari user ini ikut dibersihkan.",
            profileId: referral.profile.id,
            title: "Komisi referral dibatalkan",
            type: "commission_reversed",
          },
        });
      }
    }

    await tx.user.delete({
      where: { id: user.id },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/payments");
  revalidatePath("/affiliate");
  revalidatePath("/library");
  revalidatePath("/profile");
  revalidatePath("/vip");

  redirect(
    `${redirectBasePath}?user=deleted&message=${encodeURIComponent(
      `User ${user.name || user.email || user.id} berhasil dihapus untuk test ulang.`,
    )}`,
  );
}

export async function manageAffiliatePayoutRequest(formData: FormData) {
  await requireAdminSession();

  const redirectBasePath = resolveRedirectTarget(formData, "/admin/withdrawals");
  const payoutId = readTextField(formData, "payoutId");
  const intent = readTextField(formData, "intent");
  const note = readNullableTextField(formData, "note");

  if (!payoutId) {
    redirect(
      `${redirectBasePath}?withdraw=error&message=${encodeURIComponent("Permintaan penarikan tidak ditemukan.")}`,
    );
  }

  const payout = await prisma.affiliatePayoutRequest.findUnique({
    where: { id: payoutId },
    select: {
      amount: true,
      id: true,
      payoutProvider: true,
      profile: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
              telegramId: true,
            },
          },
        },
      },
      recipientName: true,
      status: true,
    },
  });

  if (!payout) {
    redirect(
      `${redirectBasePath}?withdraw=error&message=${encodeURIComponent("Permintaan penarikan tidak ditemukan.")}`,
    );
  }

  if (intent === "approve") {
    if (payout.status === "paid") {
      redirect(
        `${redirectBasePath}?withdraw=error&message=${encodeURIComponent("Permintaan ini sudah ditandai dibayar.")}`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id: payout.id },
        data: {
          note,
          status: "approved",
        },
      });

      await tx.affiliateActivity.create({
        data: {
          amount: payout.amount,
          description:
            `Admin menyetujui penarikan ${payout.payoutProvider} atas nama ${payout.recipientName}.`,
          profileId: payout.profile.id,
          title: "Penarikan disetujui",
          type: "payout_approved",
        },
      });
    });

    await sendTelegramUserMessage({
      telegramId: payout.profile.user.telegramId,
      text:
        `✅ Penarikan komisi Box Office berhasil diproses.\n\n` +
        `Nominal: ${new Intl.NumberFormat("id-ID", {
          currency: "IDR",
          maximumFractionDigits: 0,
          style: "currency",
        }).format(payout.amount)}\n` +
        `Metode: ${payout.payoutProvider}\n` +
        `Penerima: ${payout.recipientName}\n\n` +
        `Cek saldo affiliate kamu untuk melihat histori terbaru.`,
    }).catch(() => null);

    revalidatePath("/affiliate");
    revalidatePath("/admin");
    revalidatePath("/admin/withdrawals");

    redirect(
      `${redirectBasePath}?withdraw=ok&message=${encodeURIComponent(`Permintaan ${payout.profile.user.name} berhasil disetujui.`)}`,
    );
  }

  if (intent === "reject") {
    if (payout.status === "rejected") {
      redirect(
        `${redirectBasePath}?withdraw=error&message=${encodeURIComponent("Permintaan ini sudah ditolak sebelumnya.")}`,
      );
    }

    if (payout.status === "paid") {
      redirect(
        `${redirectBasePath}?withdraw=error&message=${encodeURIComponent("Permintaan yang sudah dibayar tidak bisa ditolak.")}`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id: payout.id },
        data: {
          note,
          processedAt: new Date(),
          status: "rejected",
        },
      });

      await tx.affiliateProfile.update({
        where: { id: payout.profile.id },
        data: {
          availableBalance: {
            increment: payout.amount,
          },
          pendingBalance: {
            decrement: payout.amount,
          },
        },
      });

      await tx.affiliateActivity.create({
        data: {
          amount: payout.amount,
          description:
            note ??
            "Permintaan penarikan ditolak admin dan saldo dikembalikan ke saldo tersedia.",
          profileId: payout.profile.id,
          title: "Penarikan ditolak",
          type: "payout_rejected",
        },
      });
    });

    revalidatePath("/affiliate");
    revalidatePath("/admin");
    revalidatePath("/admin/withdrawals");

    redirect(
      `${redirectBasePath}?withdraw=ok&message=${encodeURIComponent(`Permintaan ${payout.profile.user.name} ditolak dan saldo dikembalikan.`)}`,
    );
  }

  if (intent === "paid") {
    if (payout.status === "paid") {
      redirect(
        `${redirectBasePath}?withdraw=error&message=${encodeURIComponent("Permintaan ini sudah selesai dibayar.")}`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id: payout.id },
        data: {
          note,
          processedAt: new Date(),
          status: "paid",
        },
      });

      await tx.affiliateProfile.update({
        where: { id: payout.profile.id },
        data: {
          pendingBalance: {
            decrement: payout.amount,
          },
          withdrawnBalance: {
            increment: payout.amount,
          },
        },
      });

      await tx.affiliateActivity.create({
        data: {
          amount: payout.amount,
          description:
            note ??
            `Penarikan ${payout.payoutProvider} sudah dikirim ke ${payout.recipientName}.`,
          profileId: payout.profile.id,
          title: "Penarikan dibayar",
          type: "payout_paid",
        },
      });
    });

    revalidatePath("/affiliate");
    revalidatePath("/admin");
    revalidatePath("/admin/withdrawals");

    redirect(
      `${redirectBasePath}?withdraw=ok&message=${encodeURIComponent(`Permintaan ${payout.profile.user.name} ditandai sudah dibayar.`)}`,
    );
  }

  redirect(
    `${redirectBasePath}?withdraw=error&message=${encodeURIComponent("Aksi penarikan tidak dikenal.")}`,
  );
}

export async function logoutAdmin() {
  await requireAdminSession();
  await clearAdminSessionCookie();

  redirect("/admin/login");
}
