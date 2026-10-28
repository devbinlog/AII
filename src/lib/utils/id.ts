/**
 * AII — ID generation utilities
 */

/** Generate a simple random ID (client-side safe) */
export function generateId(prefix = "id"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${timestamp}${random}`;
}

/** Generate a session token for anonymous users */
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for non-browser environments
  return generateId("session");
}

/** Validate that a string looks like a valid AII ID */
export function isValidId(id: string): boolean {
  return /^[a-z_]{2,8}_[a-z0-9]{6,}$/.test(id);
}
