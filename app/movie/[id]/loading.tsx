import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative min-h-screen overflow-hidden pb-24 sm:pb-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,#000_72%)] sm:bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.84)_34%,rgba(0,0,0,0.45)_68%,rgba(0,0,0,0.9)_100%)]" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-8 sm:py-6 lg:px-10">
          <Button asChild variant="ghost" className="w-fit">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>

          <div className="grid flex-1 items-end gap-7 pb-4 pt-40 sm:items-center sm:gap-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="max-w-3xl space-y-5 sm:space-y-7">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-12 bg-red-500/30" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div>
                <Skeleton className="mb-3 h-4 w-28 bg-red-500/30" />
                <Skeleton className="h-11 w-11/12 max-w-xl sm:h-16" />
                <Skeleton className="mt-3 h-11 w-8/12 max-w-lg sm:h-16" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-11/12 max-w-xl" />
                <Skeleton className="h-4 w-9/12 max-w-lg" />
              </div>
              <Skeleton className="hidden h-12 w-32 bg-red-500/25 sm:block" />
              <div className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2 sm:pt-6">
                <div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-3 h-4 w-11/12" />
                  <Skeleton className="mt-2 h-4 w-8/12" />
                </div>
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-4 w-10/12" />
                </div>
              </div>
            </div>

            <aside className="hidden lg:block">
              <Skeleton className="aspect-[2/3] w-full" />
            </aside>
          </div>
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur sm:hidden">
        <Skeleton className="h-12 w-full bg-red-500/25" />
      </div>
    </main>
  );
}
