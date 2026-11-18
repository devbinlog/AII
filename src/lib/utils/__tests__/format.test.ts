import { describe, it, expect } from "vitest";
import { formatDate, formatNumber, formatRelativeTime, formatTime } from "../format";

describe("display formatting (explicit en-US / UTC)", () => {
  it("formats calendar dates without shifting the day", () => {
    expect(formatDate("2026-11-18")).toBe("Nov 18, 2026");
    expect(formatDate("2026-01-01", { year: "numeric", month: "long" })).toBe("January 2026");
    expect(formatDate("2026-11-18", { month: "short", day: "numeric" })).toBe("Nov 18");
  });

  it("formats ISO timestamps in the fixed display zone", () => {
    expect(formatDate("2026-11-17T23:30:00+09:00")).toBe("Nov 17, 2026");
    expect(formatDate("2026-11-18T23:59:00Z")).toBe("Nov 18, 2026");
    expect(formatTime("2026-11-18T02:31:00Z")).toBe("02:31 UTC");
  });

  it("does not leak Korean or OS-locale output", () => {
    for (const s of [formatDate("2026-11-18"), formatRelativeTime("2026-11-18T00:00:00Z", Date.parse("2026-11-18T03:00:00Z"))]) {
      expect(s).not.toMatch(/[\uAC00-\uD7A3]/);
    }
  });

  it("formats numbers with en-US grouping", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats relative time in English", () => {
    const now = Date.parse("2026-11-18T12:00:00Z");
    const ago = (ms: number) => formatRelativeTime(new Date(now - ms).toISOString(), now);
    expect(ago(10_000)).toBe("just now");
    expect(ago(5 * 60_000)).toBe("5 minutes ago");
    expect(ago(3 * 3_600_000)).toBe("3 hours ago");
    expect(ago(86_400_000)).toBe("yesterday");
    expect(ago(14 * 86_400_000)).toBe("2 weeks ago");
    expect(ago(400 * 86_400_000)).toBe("last year");
  });

  it("keeps stored values untouched (pure display)", () => {
    const iso = "2026-11-18T02:31:00.000Z";
    formatDate(iso);
    expect(iso).toBe("2026-11-18T02:31:00.000Z");
  });
});
