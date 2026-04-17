"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

export function PendingSubmitButton({
  children,
  pendingLabel,
  pendingFieldName,
  pendingFieldValue,
  ...props
}: ButtonProps & {
  pendingLabel: string;
  pendingFieldName?: string;
  pendingFieldValue?: string;
}) {
  const { pending, data } = useFormStatus();
  const isTargetMatch =
    pendingFieldName == null
      ? true
      : data?.get(pendingFieldName) === (pendingFieldValue ?? props.value);
  const isPending = pending && isTargetMatch;

  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {isPending ? pendingLabel : children}
    </Button>
  );
}
