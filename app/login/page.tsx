import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { UserLoginForm } from "@/components/auth/user-login-form";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

function sanitizeNextPath(value: string | undefined): string {
  if (!value) {
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next }, user] = await Promise.all([
    searchParams,
    getCurrentUserSession(),
  ]);
  const nextPath = sanitizeNextPath(next);

  if (user) {
    redirect(nextPath);
  }

  const backdropMovies = await getCinematicBackdropMovies(4);

  return (
    <AuthShell
      backdropMovies={backdropMovies}
      badge="Login Box Office"
      title="Selamat datang kembali."
      description="Masuk dengan email dan password kamu untuk lanjut menonton di web. Sudah punya akun Telegram? Buka Mini App lewat link di bawah."
    >
      <UserLoginForm nextPath={next ? nextPath : undefined} />
    </AuthShell>
  );
}
