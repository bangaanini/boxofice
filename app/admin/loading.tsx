import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 bg-neutral-950">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-8 lg:px-10">
          <Skeleton className="h-4 w-28 bg-red-500/30" />
          <Skeleton className="mt-3 h-10 w-48" />
          <Skeleton className="mt-3 h-4 w-56" />
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
            <Skeleton className="h-11 w-full sm:w-28" />
            <Skeleton className="col-span-2 h-11 w-full sm:w-24" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 lg:px-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>

        <div className="mt-8 rounded-md border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <Skeleton className="h-4 w-28 bg-red-500/30" />
          <Skeleton className="mt-2 h-7 w-52" />
          <Skeleton className="mt-3 h-4 w-full max-w-lg" />
          <Skeleton className="mt-2 h-4 w-10/12 max-w-md" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
