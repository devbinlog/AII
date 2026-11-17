// Small presentational building blocks shared by Studio pages.
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function StudioPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="caption-label mb-2 text-[var(--color-accent)]">{eyebrow}</p>}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--color-fg)] break-words">{title}</h1>
        {description && <p className="mt-2 text-sm text-[var(--color-fg-muted)] max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("border border-[var(--color-border)] bg-[var(--color-bg-secondary)]", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]",
  preview: "border-amber-500/50 text-amber-400",
  scheduled: "border-amber-500/50 text-amber-400",
  published: "border-emerald-500/50 text-emerald-400",
  released: "border-emerald-500/50 text-emerald-400",
  active: "border-emerald-500/50 text-emerald-400",
  ended: "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]",
  archived: "border-[var(--color-border-strong)] text-[var(--color-fg-subtle)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 border text-[11px] font-mono uppercase tracking-wider whitespace-nowrap",
        STATUS_STYLES[status] ?? STATUS_STYLES.draft
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
      {children && <div className="mt-2 text-sm text-[var(--color-fg-muted)]">{children}</div>}
    </div>
  );
}

export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.03] transition-colors"
    >
      {children}
    </Link>
  );
}

const fieldBase =
  "w-full bg-transparent border border-[var(--color-border)] px-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-fg)] focus:ring-1 focus:ring-[var(--color-fg)] disabled:opacity-40";

export function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-sm font-medium text-[var(--color-fg)]">{children}</span>
      {hint && <span className="text-xs text-[var(--color-fg-muted)]">{hint}</span>}
    </label>
  );
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }>(
  ({ label, id, className, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
        <textarea ref={ref} id={fieldId} className={cn(fieldBase, "py-2 min-h-24", className)} {...props} />
      </div>
    );
  }
);
TextArea.displayName = "TextArea";

export function Select({
  label,
  id,
  options,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <select id={fieldId} className={cn(fieldBase, "h-10 bg-[var(--color-bg)]", className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormMessage({ result }: { result: { ok: boolean; message: string; details?: string[] } | null }) {
  if (!result) return null;
  return (
    <div
      role={result.ok ? "status" : "alert"}
      className={cn(
        "px-3 py-2 text-sm border",
        result.ok ? "border-emerald-500/40 text-emerald-400" : "border-[var(--color-accent)] text-[var(--color-accent)]"
      )}
    >
      {result.message}
      {result.details && result.details.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {result.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2 text-xs font-mono border border-[rgba(232,25,44,0.3)] text-[rgba(232,25,44,0.8)] bg-[rgba(232,25,44,0.04)]">
      {children}
    </p>
  );
}
