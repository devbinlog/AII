"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/client";

const DEMO_ACCOUNTS = [
  { email: "studio@freefallers.com", role: "Artist Studio (admin)" },
  { email: "editor@freefallers.com", role: "Artist Studio (editor)" },
  { email: "fan1@example.com", role: "Fan" },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-site paths: "/x" but not "//host" or "/\host" (open-redirect guard).
  const requested = searchParams.get("redirect");
  const redirectTo = requested && /^\/(?![/\\])/.test(requested) ? requested : "/me/artworks";
  const forStudio = redirectTo.startsWith("/studio");

  const [email, setEmail] = useState(forStudio ? "studio@freefallers.com" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn(email, password);
      if (result.ok) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="px-4 py-3 border border-[var(--color-accent)] text-sm text-[var(--color-accent)]"
        >
          {error}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="fan1@example.com"
        autoComplete="email"
        required
        disabled={isPending}
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Any password"
        autoComplete="current-password"
        required
        disabled={isPending}
      />

      <div
        className="px-3 py-2 text-xs font-mono border"
        style={{
          borderColor: "rgba(232,25,44,0.3)",
          color: "rgba(232,25,44,0.7)",
          backgroundColor: "rgba(232,25,44,0.04)",
        }}
      >
        <p className="mb-1.5">Demo accounts — any password works:</p>
        <ul className="flex flex-col gap-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  if (!password) setPassword("demo");
                }}
                className="underline underline-offset-2 hover:opacity-80"
              >
                <strong>{a.email}</strong>
              </button>{" "}
              — {a.role}
            </li>
          ))}
        </ul>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isPending}
        className="w-full"
      >
        Sign In
      </Button>

      <p className="text-sm text-center text-[var(--color-fg-muted)]">
        Don&apos;t have an account?{" "}
        <span className="text-[var(--color-fg-subtle)] italic">
          Registration coming soon
        </span>
      </p>
    </form>
  );
}
