import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10">
        <div className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-8 sm:py-5 lg:px-10">
          <div className="flex items-center justify-between gap-3 px-3 py-3 sm:mb-5 sm:px-0 sm:py-0">
            <Button asChild variant="ghost">
              <Link href="/">
                <ArrowLeft className="size-4" />
                Details
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">
                <Info className="size-4" />
                Browse
              </Link>
            </Button>
          </div>

          <div className="grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 sm:space-y-5">
              <Skeleton className="aspect-video w-full rounded-none sm:rounded-md" />
              <div className="space-y-3 px-4 sm:px-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-12 bg-red-500/30" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-8 w-10/12 max-w-lg" />
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-8/12 max-w-xl" />
              </div>
            </div>

            <aside className="hidden lg:block">
              <Skeleton className="mb-3 h-4 w-20" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md bg-white/5 p-2 ring-1 ring-white/10"
                  >
                    <Skeleton className="aspect-[2/3] w-full" />
                    <div className="py-1">
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="mt-2 h-3 w-7/12" />
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 lg:px-10">
        <Skeleton className="h-4 w-24 bg-red-500/30" />
        <Skeleton className="mt-2 h-7 w-40" />
        <div className="-mx-4 mt-5 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="w-[132px] shrink-0 sm:w-auto">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="mt-3 h-4 w-11/12" />
              <Skeleton className="mt-2 h-3 w-7/12" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
