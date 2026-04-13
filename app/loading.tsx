import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-4 pb-8 pt-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="h-4 w-28 bg-red-500/30" />
          <Skeleton className="mt-4 h-12 w-11/12 max-w-xl" />
          <Skeleton className="mt-3 h-12 w-8/12 max-w-lg" />
          <Skeleton className="mt-5 h-4 w-full max-w-md" />
          <Skeleton className="mt-2 h-4 w-10/12 max-w-sm" />
          <Skeleton className="mt-7 h-11 w-32 bg-red-500/25" />
        </div>
      </section>

      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <section
          key={sectionIndex}
          className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 lg:px-10"
        >
          <Skeleton className="h-4 w-24 bg-red-500/30" />
          <Skeleton className="mt-2 h-7 w-44" />
          <div className="-mx-4 mt-5 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="w-[132px] shrink-0 sm:w-[180px]">
                <Skeleton className="aspect-[2/3] w-full" />
                <Skeleton className="mt-3 h-4 w-11/12" />
                <Skeleton className="mt-2 h-3 w-7/12" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
