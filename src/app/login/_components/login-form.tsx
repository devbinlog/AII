"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/client";
import { safeRedirect } from "@/lib/auth/redirect";

const DEMO_ACCOUNTS = [
  { email: "studio@freefallers.com", role: "Artist Studio (admin)" },
  { email: "editor@freefallers.com", role: "Artist Studio (editor)" },
  { email: "fan1@example.com", role: "Fan" },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const forStudio = redirectTo.startsWith("/studio");

  // Uncontrolled inputs: whatever is typed into the server-rendered form — even
  // during hydration — is kept; values are read from the form on submit.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Set when the no-JS form post (a submit before hydration) bounced back with an error.
  const bounced = ({ invalid: "Email or password is incorrect.", missing: "Enter your email and password." } as Record<string, string>)[searchParams.get("error") ?? ""];
  const [error, setError] = useState<string | null>(bounced ?? null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

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
    // method/action: a submit before hydration is a real POST that signs in (never a
    // GET with credentials in the URL). Once hydrated, onSubmit takes over via fetch.
    <form onSubmit={handleSubmit} method="post" action="/api/auth/signin" className="space-y-5">
      <input type="hidden" name="redirect" value={redirectTo} />
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
        name="email"
        ref={emailRef}
        defaultValue={forStudio ? "studio@freefallers.com" : ""}
        placeholder="fan1@example.com"
        autoComplete="email"
        required
        disabled={isPending}
      />

      <Input
        label="Password"
        type="password"
        name="password"
        ref={passwordRef}
        placeholder="Any password"
        autoComplete="current-password"
        required
        disabled={isPending}
      />

      <div
        className="px-3 py-2 text-xs font-mono border"
        style={{
          borderColor: "rgba(228,73,66,0.3)",
          color: "rgba(228,73,66,0.7)",
          backgroundColor: "rgba(228,73,66,0.04)",
        }}
      >
        <p className="mb-1.5">Demo accounts — any password works:</p>
        <ul className="flex flex-col gap-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => {
                  if (emailRef.current) emailRef.current.value = a.email;
                  if (passwordRef.current && !passwordRef.current.value) passwordRef.current.value = "demo";
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
