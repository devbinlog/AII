// Explore skeleton: same layout as the loaded page so nothing jumps.
export default function ExploreLoading() {
  return (
    <main className="flex-1" aria-busy="true" aria-label="Loading Explore">
      <div className="border-b border-[var(--color-border)] bg-[var(--aii-ink)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-10 md:py-12">
          <div className="h-3 w-20 bg-[var(--aii-ink-2)]" />
          <div className="mt-4 h-16 w-72 max-w-full bg-[var(--aii-ink-2)]" />
          <div className="mt-4 h-3 w-48 bg-[var(--aii-ink-2)]" />
        </div>
      </div>
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 h-72 animate-pulse bg-[var(--color-bg-secondary)]" />
        <div className="lg:col-span-4 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-[var(--color-bg-secondary)]" />
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">Loading artists, releases and campaigns…</p>
    </main>
  );
}
