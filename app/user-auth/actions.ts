"use server";

import { redirect } from "next/navigation";

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

export async function loginUserAction(
  _previousState: UserAuthFormState,
  formData: FormData,
): Promise<UserAuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

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

  redirect("/profile");
}

export async function signupUserAction(
  _previousState: UserAuthFormState,
  formData: FormData,
): Promise<UserAuthFormState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

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
    await createUserSession(user);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Tidak bisa membuat akun.",
    };
  }

  redirect("/profile");
}

export async function logoutUserAction() {
  await logoutCurrentUser();
  redirect("/login");
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
