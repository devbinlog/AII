import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <svg
      className={cn("animate-spin text-[var(--color-fg-muted)]", sizeMap[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3" role="status">
      <Spinner size="lg" />
      <p className="text-sm text-[var(--color-fg-muted)]">{label}</p>
    </div>
  );
}

export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--color-border)] rounded-sm",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      <div className="text-[var(--color-fg-subtle)]">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9h.01M15 9h.01M9.5 14.5s1 1.5 2.5 1.5 2.5-1.5 2.5-1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-[var(--color-fg)]">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "오류가 발생했습니다",
  description,
  retry,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert">
      <div className="text-[var(--color-accent)]">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-[var(--color-fg)]">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{description}</p>
        )}
      </div>
      {retry && (
        <button
          onClick={retry}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
