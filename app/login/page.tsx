import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { UserLoginForm } from "@/components/auth/user-login-form";
import { getCinematicBackdropMovies } from "@/lib/movie-feeds";
import { getCurrentUserSession } from "@/lib/user-auth";

export default async function LoginPage() {
  const [user, backdropMovies] = await Promise.all([
    getCurrentUserSession(),
    getCinematicBackdropMovies(),
  ]);

  if (user) {
    redirect("/profile");
  }

  return (
    <AuthShell
      badge="User account"
      backdropMovies={backdropMovies}
      title="Sign in"
      description="Masuk untuk mulai menonton drama favoritmu."
    >
      <UserLoginForm />
    </AuthShell>
  );
}
