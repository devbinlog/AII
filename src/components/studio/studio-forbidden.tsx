import Link from "next/link";

export function StudioForbidden({ reason }: { reason?: string }) {
  return (
    <div className="max-w-lg py-16">
      <p className="caption-label mb-3 text-[var(--color-accent)]">403 · Artist Studio</p>
      <h1 className="text-2xl font-semibold mb-3">You don&apos;t have access to Artist Studio</h1>
      <p className="text-sm text-[var(--color-fg-muted)] mb-6">
        {reason ?? "Artist Studio is available to artist team members. Sign in with an artist account to continue."}
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline underline-offset-4">Back to home</Link>
        <Link href="/login?redirect=/studio" className="underline underline-offset-4">Switch account</Link>
      </div>
    </div>
  );
}
