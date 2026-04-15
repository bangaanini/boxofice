import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-black pb-24 text-white sm:pb-8">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[linear-gradient(180deg,rgba(10,10,10,0.96),rgba(10,10,10,0.88))] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full bg-white/15" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32 bg-white/15" />
              <Skeleton className="mt-2 h-3 w-24 bg-white/10" />
            </div>
          </div>

          <Skeleton className="mt-4 h-3 w-32 bg-white/10" />

          <div className="mt-4 space-y-3">
            <div>
              <Skeleton className="mb-2 h-3 w-12 bg-white/10" />
              <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:px-0">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton
                    key={`genre-${index}`}
                    className="h-8 w-20 shrink-0 rounded-full bg-white/10"
                  />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="mb-2 h-3 w-12 bg-white/10" />
              <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:px-0">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton
                    key={`year-${index}`}
                    className="h-8 w-16 shrink-0 rounded-full bg-white/10"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-[182px] sm:pt-[188px]">
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <section
            key={sectionIndex}
            className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-8 sm:py-3 lg:px-10"
          >
            <Skeleton className="mb-3 h-7 w-40 bg-white/10" />
            <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-3 sm:mx-0 sm:px-0">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="w-[132px] shrink-0 sm:w-[180px]">
                  <Skeleton className="aspect-[2/3] w-full bg-white/10" />
                  <Skeleton className="mt-3 h-4 w-11/12 bg-white/10" />
                  <Skeleton className="mt-2 h-3 w-7/12 bg-white/10" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
