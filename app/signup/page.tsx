import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { UserSignupForm } from "@/components/auth/user-signup-form";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import { getCurrentUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

type SignupPageProps = {
  searchParams: Promise<{
    next?: string;
    ref?: string;
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

function normalizeReferralCode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.toUpperCase();
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const [{ next, ref }, user] = await Promise.all([
    searchParams,
    getCurrentUserSession(),
  ]);
  const nextPath = sanitizeNextPath(next);
  const referralCode = normalizeReferralCode(ref);

  if (user) {
    redirect(nextPath);
  }

  const backdropMovies = await getCinematicBackdropMovies(4);

  return (
    <AuthShell
      backdropMovies={backdropMovies}
      badge="Daftar Box Office"
      title="Mulai nonton dalam hitungan detik."
      description="Buat akun gratis dengan email dan password. Cocok untuk kamu yang tidak pakai Telegram."
    >
      <UserSignupForm
        referralCode={referralCode}
        nextPath={next ? nextPath : undefined}
      />
    </AuthShell>
  );
}
