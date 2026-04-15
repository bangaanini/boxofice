"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ImmersiveHiddenProps = {
  children: React.ReactNode;
  className?: string;
};

export function ImmersiveHidden({
  children,
  className,
}: ImmersiveHiddenProps) {
  const [isImmersivePlayerOpen, setIsImmersivePlayerOpen] = React.useState(false);

  React.useEffect(() => {
    function syncImmersiveState() {
      setIsImmersivePlayerOpen(
        document.body.dataset.playerImmersive === "true",
      );
    }

    syncImmersiveState();
    window.addEventListener(
      "boxofice-immersive-change",
      syncImmersiveState as EventListener,
    );

    return () => {
      window.removeEventListener(
        "boxofice-immersive-change",
        syncImmersiveState as EventListener,
      );
    };
  }, []);

  return (
    <div
      className={cn(
        className,
        isImmersivePlayerOpen && "pointer-events-none hidden opacity-0",
      )}
    >
      {children}
    </div>
  );
}
