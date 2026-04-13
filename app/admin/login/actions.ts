"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminCookieOptions,
  sanitizeAdminRedirectPath,
  verifyAdminCredentials,
} from "@/lib/admin-auth";

export type LoginState = {
  error?: string;
};

export async function loginAdmin(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeAdminRedirectPath(formData.get("next"));

  if (!verifyAdminCredentials(email, password)) {
    return {
      error: "Email atau password admin salah.",
    };
  }

  const token = await createAdminSessionToken(email.trim().toLowerCase());
  const cookieStore = await cookies();

  cookieStore.set({
    ...getAdminCookieOptions(),
    name: ADMIN_SESSION_COOKIE,
    value: token,
  });

  redirect(nextPath);
}
