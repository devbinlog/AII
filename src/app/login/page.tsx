import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your AII account to manage your artworks.",
};

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center py-16 px-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-block mb-6 text-xs font-mono tracking-widest uppercase text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
          >
            AII
          </Link>
          <h1 className="heading-display text-4xl mb-2" style={{ color: "#f5f5f0" }}>
            Sign In
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Make Your Sound Visible.
          </p>
        </div>

        {/* Decorative line */}
        <div className="mb-8 h-px bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-border)] to-transparent" />

        {/* Form */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        {/* Back link */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <Link
            href="/"
            className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
