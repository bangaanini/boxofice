export default function SourceWatchLoading() {
  return (
    <main className="min-h-screen bg-black pb-24 text-white">
      <div className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-8 sm:py-5 lg:px-10">
        <div className="h-12 px-3 py-3 sm:mb-5 sm:px-0" />
        <div className="grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="relative flex aspect-video w-full overflow-hidden bg-neutral-950 ring-1 ring-white/10 sm:rounded-md">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(220,38,38,0.2),transparent_30%)]" />
              <div className="relative z-10 flex w-full flex-col items-center justify-center text-center">
                <div className="size-10 animate-spin rounded-full border-2 border-red-500/25 border-t-red-500" />
                <p className="mt-4 text-sm font-semibold text-neutral-200">
                  Membuka pemutar
                </p>
              </div>
            </div>
            <div className="space-y-3 px-4 sm:px-0">
              <div className="h-4 w-24 animate-pulse rounded-full bg-neutral-900" />
              <div className="h-8 w-2/3 animate-pulse rounded-full bg-neutral-900" />
              <div className="h-4 w-full max-w-2xl animate-pulse rounded-full bg-neutral-900" />
            </div>
          </div>
          <div className="hidden aspect-[2/3] animate-pulse rounded-md bg-neutral-950 lg:block" />
        </div>
      </div>
    </main>
  );
}
