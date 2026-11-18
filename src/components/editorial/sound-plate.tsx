// AII platform artwork: "a sound, made visible" — a halftone spectrogram plate.
// Platform identity, NOT artist content: captioned as such and drawn only in the
// AII Core palette (Paper dots on Ink, one Signal playhead). Deterministic math,
// so server and client render identical markup.

const COLS = 36;
const ROWS = 22;
const CELL = 10;

/** Melody contour: the frequency (0–1 of the plate height) carrying the tune at column c. */
const melody = (c: number) => 0.3 + 0.16 * Math.sin(c * 0.26 + 0.4) + 0.07 * Math.sin(c * 0.83);

/** Spectral energy at (time column, frequency row), 0–1. Row 0 is the lowest band. */
function energy(c: number, r: number): number {
  const f = (r + 0.5) / ROWS;
  const beat = c % 4 === 0 ? 1 : c % 2 === 0 ? 0.62 : 0.38; // kick on 1, snare on 3
  const bass = Math.exp(-f * 11) * beat;
  const m = melody(c);
  const tone = (centre: number, width: number, gain: number) => gain * Math.exp(-(((f - centre) / width) ** 2));
  const voice = tone(m, 0.035, 1) + tone(m * 2, 0.04, 0.55) + tone(m * 3, 0.045, 0.28);
  const air = c % 2 === 1 ? tone(0.9, 0.06, 0.35) : 0; // off-beat hats
  const phrase = 0.55 + 0.45 * Math.sin((Math.PI * (c + 2)) / (COLS + 4));
  return Math.min(1, (bass + voice + air) * phrase);
}

const DOTS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  const e = energy(c, r);
  // Below the noise floor every cell still prints a faint dot: the plate's paper texture.
  return { cx: c * CELL + CELL / 2, cy: (ROWS - 1 - r) * CELL + CELL / 2, r: Math.max(0.7, Math.round(e * (CELL / 2 - 0.5) * 100) / 100), floor: e < 0.12 };
});

export function SoundPlate({ className = "" }: { className?: string }) {
  const w = COLS * CELL;
  const h = ROWS * CELL;
  return (
    <figure className={`relative ${className}`} aria-labelledby="sound-plate-caption">
      <div className="relative border border-[color:rgb(167_165_160/0.28)] p-4 sm:p-6">
        {/* Specimen header */}
        <div className="mb-4 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--aii-stone)]">
          <span>Fig. 01</span>
          <span>Time →</span>
        </div>
        <div className="relative">
          <svg viewBox={`0 0 ${w} ${h}`} className="block w-full h-auto" role="img" aria-label="Halftone spectrogram: each dot is the energy of one frequency band at one moment">
            {DOTS.map((d, i) => (
              <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="var(--aii-paper)" fillOpacity={d.floor ? 0.22 : 1} />
            ))}
          </svg>
          {/* Playhead — the one Signal element on the plate */}
          <div className="aii-playhead pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 w-px bg-[var(--aii-signal)]" />
          </div>
        </div>
        <div className="mt-3 flex justify-between font-mono text-[11px] tabular-nums text-[var(--aii-stone)]">
          <span>0:00</span>
          <span>Frequency ↑ · 20 Hz – 20 kHz</span>
          <span>0:12</span>
        </div>
      </div>
      <figcaption id="sound-plate-caption" className="mt-3 flex items-baseline justify-between gap-4 text-xs text-[var(--aii-stone)]">
        <span>A sound, made visible.</span>
        <span className="font-mono uppercase tracking-wider text-[11px]">AII platform artwork</span>
      </figcaption>
    </figure>
  );
}
