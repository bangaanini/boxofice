"use server";

import { redirect } from "next/navigation";

import { attachAffiliateReferral } from "@/lib/affiliate";
import {
  changeUserPassword,
  createUserSession,
  logoutCurrentUser,
  registerUser,
  requireUserSession,
  verifyUserCredentials,
} from "@/lib/user-auth";

export type UserAuthFormState = {
  error?: string;
};

function sanitizeNextPath(value: string | undefined | null): string {
  if (!value || typeof value !== "string") {
    return "/profile";
  }

  if (!value.startsWith("/")) {
    return "/profile";
  }

  if (value.startsWith("//") || value.startsWith("/api/")) {
    return "/profile";
  }

  return value;
}

export async function loginUserAction(
  _previousState: UserAuthFormState,
  formData: FormData,
): Promise<UserAuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""));

  if (!email.includes("@")) {
    return { error: "Format email belum valid." };
  }

  try {
    const user = await verifyUserCredentials({ email, password });
    await createUserSession(user);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Tidak bisa masuk sekarang.",
    };
  }

  redirect(nextPath);
}

export async function signupUserAction(
  _previousState: UserAuthFormState,
  formData: FormData,
): Promise<UserAuthFormState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const referralCode = String(formData.get("referralCode") ?? "");
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""));

  if (name.trim().length < 2) {
    return { error: "Nama minimal 2 karakter." };
  }

  if (!email.includes("@")) {
    return { error: "Format email belum valid." };
  }

  if (password.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }

  if (password !== confirmPassword) {
    return { error: "Konfirmasi password belum sama." };
  }

  try {
    const user = await registerUser({ email, name, password });
    await attachAffiliateReferral({
      referralCode,
      referredUserId: user.id,
    }).catch(() => undefined);
    await createUserSession(user);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Tidak bisa membuat akun.",
    };
  }

  redirect(nextPath);
}

export async function logoutUserAction() {
  await logoutCurrentUser();
  redirect("/");
}

export async function changePasswordAction(
  _previousState: UserAuthFormState,
  formData: FormData,
): Promise<UserAuthFormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "Password baru minimal 8 karakter." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Konfirmasi password baru belum sama." };
  }

  const user = await requireUserSession();

  try {
    await changeUserPassword({
      currentPassword,
      newPassword,
      userId: user.id,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Tidak bisa ganti password.",
    };
  }

  redirect("/profile");
}
