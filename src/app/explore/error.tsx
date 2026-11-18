"use client"; // Error boundaries must be Client Components

// Next 16 error convention: { error: unknown, retry } (see node_modules/next/dist/docs/.../error.md).
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/loading";

export default function ExploreError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex-1 max-w-[var(--container-2xl)] mx-auto w-full px-4 sm:px-6 py-16">
      <ErrorState title="Explore could not load" description="The catalogue did not respond. Please try again in a moment." retry={retry} />
    </main>
  );
}
