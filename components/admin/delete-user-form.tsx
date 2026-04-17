"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type DeleteUserFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  compact?: boolean;
  redirectTo: string;
  userId: string;
  userName: string;
};

function DeleteSubmitButton({ compact = false }: { compact?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      aria-busy={pending}
      className={compact ? "h-9 text-xs" : "h-9 w-full text-xs"}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      {pending ? "Menghapus..." : "Hapus user"}
    </Button>
  );
}

export function DeleteUserForm({
  action,
  compact = false,
  redirectTo,
  userId,
  userName,
}: DeleteUserFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Hapus user ${userName}? Session, favorit, history, order VIP, dan data affiliate user ini ikut dibersihkan.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className={
        compact
          ? "flex items-center"
          : "rounded-[16px] border border-red-400/15 bg-red-500/10 p-3"
      }
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="userId" value={userId} />
      <DeleteSubmitButton compact={compact} />
      {!compact ? (
        <p className="mt-2 text-xs leading-5 text-red-100/80">
          Untuk reset akun test Telegram.
        </p>
      ) : null}
    </form>
  );
}
