/** Same-site paths only: "/x", never "//host" or "/\host" (open-redirect guard). */
export function safeRedirect(requested: string | null | undefined, fallback = "/me/artworks"): string {
  return requested && /^\/(?![/\\])/.test(requested) ? requested : fallback;
}
