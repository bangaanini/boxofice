"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SynopsisAccordionProps = {
  text: string;
};

export function SynopsisAccordion({ text }: SynopsisAccordionProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const shouldCollapse = text.length > 180;

  return (
    <div className="max-w-3xl">
      <p
        className={cn(
          "text-sm leading-6 text-neutral-200 sm:text-lg sm:leading-8",
          shouldCollapse && !isOpen && "line-clamp-3 sm:line-clamp-4",
        )}
      >
        {text}
      </p>
      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-400"
          aria-expanded={isOpen}
        >
          {isOpen ? "Tutup sinopsis" : "Selengkapnya"}
          <ChevronDown
            className={cn("size-4 transition-transform", isOpen && "rotate-180")}
          />
        </button>
      ) : null}
    </div>
  );
}
