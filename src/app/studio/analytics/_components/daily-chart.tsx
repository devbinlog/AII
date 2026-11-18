"use client";

import { formatDate, formatNumber } from "@/lib/utils/format";
import { useState } from "react";

/**
 * Single-series column chart (participants per day).
 * One hue (brand accent), no legend, recessive axis, per-bar hover/focus tooltip, table view.
 */
export function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const peak = data.reduce((best, d, i) => (d.count > (data[best]?.count ?? -1) ? i : best), 0);
  const total = data.reduce((s, d) => s + d.count, 0);
  const label = (d: { date: string }) => formatDate(d.date, { month: "short", day: "numeric" });

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-[var(--color-fg-muted)]">Participants per day · last {data.length} days</span>
        <span className="text-sm tabular-nums text-[var(--color-fg)]">{formatNumber(total)} total</span>
      </figcaption>
      <div className="relative">
        <div className="flex h-44 items-end gap-[2px] border-b border-[var(--color-border-strong)]" role="list" aria-label="Participants per day">
          {data.map((d, i) => (
            <div key={d.date} role="listitem" className="relative flex h-full flex-1 items-end justify-center">
              <button
                type="button"
                aria-label={`${label(d)}: ${d.count} participants`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="absolute inset-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-fg)]"
              />
              <div
                aria-hidden="true"
                className="w-full max-w-[24px] rounded-t-[4px] transition-opacity"
                style={{
                  height: `${(d.count / max) * 100}%`,
                  backgroundColor: "var(--color-accent)",
                  opacity: active === null || active === i ? 1 : 0.45,
                }}
              />
            </div>
          ))}
        </div>
        {active !== null && data[active] && (
          <div
            role="tooltip"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-xs shadow-lg"
            style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
          >
            <span className="text-[var(--color-fg-muted)]">{label(data[active])}</span>{" "}
            <span className="font-semibold tabular-nums text-[var(--color-fg)]">{data[active].count}</span>
          </div>
        )}
        {data[peak] && (
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            Peak {label(data[peak])} · {data[peak].count}
          </p>
        )}
      </div>
      <div className="flex justify-between text-[11px] font-mono text-[var(--color-fg-muted)]">
        <span>{data[0] ? label(data[0]) : ""}</span>
        <span>{data[data.length - 1] ? label(data[data.length - 1]!) : ""}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-[var(--color-fg-muted)]">Show as table</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--color-fg-muted)]">
              <th className="py-1 font-normal">Date</th>
              <th className="py-1 font-normal text-right">Participants</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-[var(--color-border)]">
                <td className="py-1">{d.date}</td>
                <td className="py-1 text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
