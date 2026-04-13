import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-4 pb-8 pt-6 sm:px-8 sm:pb-10 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="h-10 w-36" />
          <div className="mt-16 max-w-3xl sm:mt-24">
            <Skeleton className="h-4 w-24 bg-red-500/30" />
            <Skeleton className="mt-3 h-12 w-11/12 max-w-xl" />
            <Skeleton className="mt-3 h-12 w-8/12 max-w-lg" />
            <Skeleton className="mt-5 h-4 w-full max-w-lg" />
            <Skeleton className="mt-2 h-4 w-10/12 max-w-md" />
            <Skeleton className="mt-5 h-7 w-28" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index}>
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
