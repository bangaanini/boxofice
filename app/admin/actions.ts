"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import {
  resolveSyncPage,
  syncMovieFeed,
  type MovieFeedTarget,
} from "@/lib/movie-sync";

export async function syncMoviesFromAdmin(formData: FormData) {
  await requireAdminSession();
  const rawTarget = String(formData.get("target") ?? "");
  const page = resolveSyncPage(formData.get("page"));
  const target: MovieFeedTarget =
    rawTarget === "home" || rawTarget === "popular" || rawTarget === "new"
      ? rawTarget
      : "home";

  let redirectPath = `/admin?sync=ok&target=${target}&page=${page}`;

  try {
    const summary = await syncMovieFeed(target, { page });
    const params = new URLSearchParams({
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

    revalidatePath("/");
    revalidatePath("/admin");
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
