/**
 * Artist Theme — what an artist's branding may change, derived from the existing
 * Artist.branding record (no new stored fields).
 *
 * Artist-scoped (themeable): profile hero, campaign hero/landing, experience and
 * fan-creator canvases, artwork treatment, Live Stage accent.
 * AII-scoped (never themed): navbar, footer, Studio chrome, forms, buttons,
 * status/feedback colors, DEMO notices, focus rings, typography scale.
 */
import type { Artist } from "@/types";

export type TypePreset = "editorial-sans" | "display-condensed" | "mono-tech";
export type MotionIntensity = 0 | 1 | 2;

export interface ArtistTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  typePreset: TypePreset;
  /** 0 subtle · 1 moderate · 2 expressive — multiplies decorative motion only */
  motion: MotionIntensity;
  /** CSS custom properties to scope on artist-owned surfaces */
  cssVars: Record<`--artist-${string}`, string>;
}

const MOTION: Record<Artist["branding"]["motionPreset"], MotionIntensity> = { subtle: 0, moderate: 1, expressive: 2 };

function typePresetFor(fontFamily: string | null): TypePreset {
  if (!fontFamily) return "editorial-sans";
  const f = fontFamily.toLowerCase();
  if (f.includes("mono")) return "mono-tech";
  if (f.includes("condensed") || f.includes("narrow")) return "display-condensed";
  return "editorial-sans";
}

const HEX = /^#[0-9a-f]{6}$/i;
const safe = (value: string, fallback: string) => (HEX.test(value) ? value : fallback);

export function getArtistTheme(artist: Pick<Artist, "branding">): ArtistTheme {
  const b = artist.branding;
  const theme = {
    primary: safe(b.primaryColor, "#e44942"),
    secondary: safe(b.secondaryColor, "#101114"),
    accent: safe(b.accentColor, "#f2efe8"),
    background: safe(b.backgroundColor, "#101114"),
    typePreset: typePresetFor(b.fontFamily),
    motion: MOTION[b.motionPreset] ?? 1,
  };
  return {
    ...theme,
    cssVars: {
      "--artist-primary": theme.primary,
      "--artist-secondary": theme.secondary,
      "--artist-accent": theme.accent,
      "--artist-background": theme.background,
    },
  };
}
