// Artist brand kit: brand name (wordmark), typeface, generated logo.
// Pure data so the Studio editor, the API validator and public pages share one definition.
//
// Typefaces are system font stacks (no font downloads): each device renders the
// closest installed face, so the editor says "closest match" rather than promising a file.

import type { ArtistBranding } from "@/types";

export const BRAND_FONTS = {
  geist: { label: "Geist Sans", note: "Platform default", stack: "var(--font-sans)" },
  condensed: { label: "Condensed Grotesk", note: "Tall and tight", stack: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue Condensed", "Liberation Sans Narrow", sans-serif' },
  display: { label: "Poster Display", note: "Heavy, gig-poster", stack: 'Impact, Haettenschweiler, "Arial Black", "Franklin Gothic Heavy", sans-serif' },
  serif: { label: "Editorial Serif", note: "Classic, literary", stack: 'Georgia, "Times New Roman", "Liberation Serif", serif' },
  didone: { label: "High-contrast Didone", note: "Fashion, luxe", stack: '"Bodoni 72", Didot, "Bodoni MT", "Playfair Display", Georgia, serif' },
  mono: { label: "Monospace", note: "Technical, lo-fi", stack: "var(--font-mono)" },
  rounded: { label: "Rounded Sans", note: "Soft, friendly", stack: 'ui-rounded, "Arial Rounded MT Bold", "Nunito", "Segoe UI", sans-serif' },
  script: { label: "Script", note: "Handwritten", stack: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' },
} as const;
export type BrandFontKey = keyof typeof BRAND_FONTS;
export const BRAND_FONT_KEYS = Object.keys(BRAND_FONTS) as BrandFontKey[];

export const LOGO_MARKS = ["none", "circle", "square", "diamond", "ring", "slash"] as const;
export type LogoMark = (typeof LOGO_MARKS)[number];
export const LOGO_LAYOUTS = ["inline", "stacked", "mark-only"] as const;
export const LOGO_CASES = ["as-typed", "upper", "lower"] as const;
export const LOGO_TRACKING = ["tight", "normal", "wide"] as const;
export const LOGO_WEIGHTS = ["regular", "bold", "black"] as const;

export interface BrandLogo {
  mark: LogoMark;
  /** 0–3 characters drawn inside the mark; empty = initials of the brand name */
  monogram: string;
  layout: (typeof LOGO_LAYOUTS)[number];
  case: (typeof LOGO_CASES)[number];
  tracking: (typeof LOGO_TRACKING)[number];
  weight: (typeof LOGO_WEIGHTS)[number];
}

export const DEFAULT_LOGO: BrandLogo = { mark: "none", monogram: "", layout: "inline", case: "as-typed", tracking: "tight", weight: "black" };

export const WORDMARK_MAX = 40;
export const MONOGRAM_MAX = 3;

/** Font stack for a stored key; unknown or null → platform default. */
export function brandFontStack(key: string | null | undefined): string {
  return key && key in BRAND_FONTS ? BRAND_FONTS[key as BrandFontKey].stack : BRAND_FONTS.geist.stack;
}

/** The brand name shown in the logo and on public pages (falls back to the artist name). */
export function brandName(branding: Pick<ArtistBranding, "wordmark">, artistName: string): string {
  return branding.wordmark?.trim() || artistName;
}

/** Up to two initials, from the first letters of the words in the brand name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const pick = words.length > 1 ? words.slice(0, 2).map((w) => [...w][0]) : [...(words[0] ?? "")].slice(0, 1);
  return pick.join("").toUpperCase();
}

export function resolveLogo(branding: Pick<ArtistBranding, "logo">): BrandLogo {
  return { ...DEFAULT_LOGO, ...(branding.logo ?? {}) };
}

export const TRACKING_EM: Record<BrandLogo["tracking"], string> = { tight: "-0.04em", normal: "0em", wide: "0.18em" };
export const WEIGHT_NUM: Record<BrandLogo["weight"], number> = { regular: 400, bold: 700, black: 900 };
