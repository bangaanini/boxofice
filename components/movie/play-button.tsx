"use client";

import * as React from "react";
import { Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type PlayButtonProps = {
  movieId: string;
};

export function PlayButton({ movieId }: PlayButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  function play() {
    setIsLoading(true);
    router.push(`/watch/${movieId}`);
  }

  return (
    <Button
      type="button"
      size="lg"
      onClick={play}
      disabled={isLoading}
      className="h-12 w-full bg-red-600 px-7 text-white hover:bg-red-500 sm:w-auto"
    >
      {isLoading ? (
        <RefreshCw className="size-5 animate-spin" />
      ) : (
        <Play className="size-5 fill-current" />
      )}
      {isLoading ? "Opening player" : "Play"}
    </Button>
  );
}
