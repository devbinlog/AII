import type { CSSProperties } from "react";
import type { ArtistBranding } from "@/types";
import { TRACKING_EM, WEIGHT_NUM, brandFontStack, brandName, initials, resolveLogo, type BrandLogo } from "@/lib/brand/brand";

/** The mark: a shape in the brand's primary color with the monogram knocked out in the background color. */
function Mark({ logo, text, primary, background, size }: { logo: BrandLogo; text: string; primary: string; background: string; size: number }) {
  const outline = logo.mark === "ring";
  const ink = outline ? primary : background;
  const shape = (() => {
    switch (logo.mark) {
      case "circle":
        return <circle cx="50" cy="50" r="48" fill={primary} />;
      case "ring":
        return <circle cx="50" cy="50" r="44" fill="none" stroke={primary} strokeWidth="8" />;
      case "square":
        return <rect x="2" y="2" width="96" height="96" fill={primary} />;
      case "diamond":
        return <rect x="17" y="17" width="66" height="66" fill={primary} transform="rotate(45 50 50)" />;
      case "slash":
        return <polygon points="22,2 98,2 78,98 2,98" fill={primary} />;
      default:
        return null;
    }
  })();
  const n = [...text].length;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="shrink-0 overflow-visible">
      {shape}
      {text && (
        <text
          x="50"
          y="50"
          dy="0.36em"
          textAnchor="middle"
          fill={ink}
          fontSize={n >= 3 ? 30 : n === 2 ? 38 : logo.mark === "diamond" ? 40 : 50}
          fontWeight={WEIGHT_NUM[logo.weight]}
          style={{ fontFamily: "inherit" }}
        >
          {text}
        </text>
      )}
    </svg>
  );
}

const SIZES = { sm: { mark: 28, text: "1rem" }, md: { mark: 44, text: "1.6rem" }, lg: { mark: 72, text: "2.75rem" } } as const;

/**
 * Artist logo lockup generated from the brand kit: optional mark + brand name in the
 * brand typeface. Artist-owned colors only — never the platform palette.
 * `color` overrides the wordmark color (e.g. light text on a photo).
 */
export function ArtistLogo({
  branding,
  artistName,
  size = "md",
  color,
  className = "",
}: {
  branding: Pick<ArtistBranding, "primaryColor" | "backgroundColor" | "fontFamily" | "wordmark" | "logo">;
  artistName: string;
  size?: keyof typeof SIZES;
  color?: string;
  className?: string;
}) {
  const logo = resolveLogo(branding);
  const name = brandName(branding, artistName);
  const shown = logo.case === "upper" ? name.toUpperCase() : logo.case === "lower" ? name.toLowerCase() : name;
  const s = SIZES[size];
  const hasMark = logo.mark !== "none";
  const monogram = logo.monogram.trim() || initials(name);
  const textStyle: CSSProperties = {
    fontSize: s.text,
    fontWeight: WEIGHT_NUM[logo.weight],
    letterSpacing: TRACKING_EM[logo.tracking],
    lineHeight: 1,
    color: color ?? branding.primaryColor,
  };
  return (
    <span
      role="img"
      aria-label={`${name} logo`}
      className={`inline-flex min-w-0 ${logo.layout === "stacked" ? "flex-col items-start gap-2" : "items-center gap-3"} ${className}`}
      style={{ fontFamily: brandFontStack(branding.fontFamily) }}
    >
      {hasMark && <Mark logo={logo} text={monogram} primary={branding.primaryColor} background={branding.backgroundColor} size={s.mark} />}
      {(logo.layout !== "mark-only" || !hasMark) && (
        <span className="min-w-0 break-words" style={textStyle}>
          {shown}
        </span>
      )}
    </span>
  );
}
