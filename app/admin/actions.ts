"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import {
  resolveSyncPages,
  syncMovieFeed,
  type MovieFeedTarget,
} from "@/lib/movie-sync";

export async function syncMoviesFromAdmin(formData: FormData) {
  await requireAdminSession();
  const rawTarget = String(formData.get("target") ?? "");
  const pages = resolveSyncPages(formData.get("pages"));
  const target: MovieFeedTarget =
    rawTarget === "home" || rawTarget === "popular" || rawTarget === "new"
      ? rawTarget
      : "home";

  let redirectPath = `/admin?sync=ok&target=${target}&pages=${pages}`;

  try {
    const summary = await syncMovieFeed(target, { pages });
    const params = new URLSearchParams({
      active: String(summary.active),
      created: String(summary.created),
      deactivated: String(summary.deactivated),
      duplicateSkipped: String(summary.duplicateSkipped),
      existing: String(summary.existing),
      fetched: String(summary.fetched),
      pages: String(pages),
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
      pages: String(pages),
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
