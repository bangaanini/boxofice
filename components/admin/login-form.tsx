"use client";

import * as React from "react";
import { Lock, Mail, RefreshCw } from "lucide-react";

import { loginAdmin, type LoginState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";

type LoginFormProps = {
  defaultEmail: string;
  nextPath: string;
};

const initialState: LoginState = {};

export function LoginForm({ defaultEmail, nextPath }: LoginFormProps) {
  const [state, formAction, isPending] = React.useActionState(
    loginAdmin,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Email
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.06] px-3 text-neutral-100 focus-within:border-red-400">
          <Mail className="size-5 text-neutral-500" />
          <input
            name="email"
            type="email"
            defaultValue={defaultEmail}
            autoComplete="email"
            required
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-600"
            placeholder="admin@boxofice.local"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-300">
          Password
        </span>
        <span className="flex h-12 items-center gap-3 rounded-md border border-white/10 bg-white/[0.06] px-3 text-neutral-100 focus-within:border-red-400">
          <Lock className="size-5 text-neutral-500" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-600"
            placeholder="Password admin"
          />
        </span>
      </label>

      {state.error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full bg-red-600 text-white hover:bg-red-500"
      >
        {isPending ? (
          <RefreshCw className="size-5 animate-spin" />
        ) : (
          <Lock className="size-5" />
        )}
        {isPending ? "Masuk..." : "Masuk Admin"}
      </Button>
    </form>
  );
}
