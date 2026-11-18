"use client";

// Thin client for /api/studio/* — returns a discriminated result instead of throwing.

/** Fired on window after any successful Studio mutation, so shell widgets can refresh. */
export const STUDIO_CHANGED_EVENT = "aii:studio-changed";

export type StudioResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; details?: unknown };

export async function studioFetch<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<StudioResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "include",
      ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string; code?: string; details?: unknown } } & T;
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        status: res.status,
        message: json.error?.message ?? json.error?.code ?? `Request failed (${res.status})`,
        details: json.error?.details,
      };
    }
    if (method !== "GET" && typeof window !== "undefined") window.dispatchEvent(new Event(STUDIO_CHANGED_EVENT));
    return { ok: true, data: json };
  } catch {
    return { ok: false, status: 0, message: "Network error — is the dev server running?" };
  }
}

/** Human-readable list from a validation error's details, if present. */
export function describeDetails(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details
    .map((d) => {
      if (typeof d === "string") return d;
      if (d && typeof d === "object" && "message" in d) {
        const path = "path" in d && d.path ? `${String(d.path)}: ` : "";
        return `${path}${String((d as { message: unknown }).message)}`;
      }
      return null;
    })
    .filter((x): x is string => x !== null)
    .slice(0, 5);
}
