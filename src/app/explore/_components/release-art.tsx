// Placeholder release cover drawn in the ARTIST's colour (artist layer, not platform).
// Falls back to neutral Stone when the artist has no colour.

export function ReleaseArt({ color, className = "" }: { color?: string | undefined; className?: string }) {
  const c = color ?? "#a7a5a0";
  return (
    <div className={`aspect-square relative overflow-hidden shrink-0 bg-[var(--color-media-black)] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="28" fill="none" stroke={c} strokeWidth="0.5" opacity="0.4" />
        <circle cx="32" cy="32" r="18" fill="none" stroke={c} strokeWidth="0.5" opacity="0.6" />
        <circle cx="32" cy="32" r="8" fill={c} opacity="0.3" />
        <line x1="0" y1="32" x2="64" y2="32" stroke={c} strokeWidth="0.3" opacity="0.25" />
      </svg>
    </div>
  );
}
