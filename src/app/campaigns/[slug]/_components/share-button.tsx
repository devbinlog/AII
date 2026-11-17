"use client";

import { useState } from "react";

interface ShareButtonProps {
  campaignSlug: string;
}

export function ShareButton({ campaignSlug }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url =
      typeof window !== "undefined"
        ? window.location.origin + `/campaigns/${campaignSlug}`
        : `/campaigns/${campaignSlug}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: prompt
      prompt("Copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border transition-all"
      style={{
        borderColor: "var(--color-neutral-700)",
        color: copied ? "#4ade80" : "var(--color-neutral-50)",
        backgroundColor: "transparent",
      }}
      aria-label={copied ? "Copied! Campaign link copied to clipboard" : "Share — copy campaign link to clipboard"}
      aria-live="polite"
    >
      {copied ? (
        <>
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              d="M10.5 9.5a2.5 2.5 0 010 3.5l-1 1a2.5 2.5 0 01-3.5-3.5l.5-.5M5.5 6.5a2.5 2.5 0 010-3.5l1-1a2.5 2.5 0 013.5 3.5l-.5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M9 7l-2 2" strokeLinecap="round" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}
