import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { UserSignupForm } from "@/components/auth/user-signup-form";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import { getCurrentUserSession } from "@/lib/user-auth";

export default async function SignupPage() {
  const [user, backdropMovies] = await Promise.all([
    getCurrentUserSession(),
    getCinematicBackdropMovies(),
  ]);

  if (user) {
    redirect("/profile");
  }

  return (
    <AuthShell
      badge="SignUp"
      backdropMovies={backdropMovies}
      title="Sign up"
      description="Buat akun user untuk mulai menonton drama favoritmu."
    >
      <UserSignupForm />
    </AuthShell>
  );
}
