"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Panel, Select, TextArea } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";
import { ArtistLogo } from "@/components/brand/artist-logo";
import {
  BRAND_FONTS,
  BRAND_FONT_KEYS,
  LOGO_CASES,
  LOGO_LAYOUTS,
  LOGO_MARKS,
  LOGO_TRACKING,
  LOGO_WEIGHTS,
  MONOGRAM_MAX,
  WORDMARK_MAX,
  brandFontStack,
  brandName,
  initials,
  resolveLogo,
  type BrandFontKey,
  type BrandLogo,
} from "@/lib/brand/brand";
import type { Artist } from "@/types";

const SOCIAL_KEYS = ["instagram", "twitter", "youtube", "spotify", "appleMusic", "website"] as const;
const COLOR_KEYS = ["primaryColor", "secondaryColor", "accentColor", "backgroundColor"] as const;
const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = {
  primaryColor: "Primary",
  secondaryColor: "Secondary",
  accentColor: "Accent",
  backgroundColor: "Background",
};
const MARK_LABEL: Record<BrandLogo["mark"], string> = { none: "No mark", circle: "Circle", square: "Square", diamond: "Diamond", ring: "Ring", slash: "Slash" };
const LAYOUT_LABEL: Record<BrandLogo["layout"], string> = { inline: "Inline", stacked: "Stacked", "mark-only": "Mark only" };
const CASE_LABEL: Record<BrandLogo["case"], string> = { "as-typed": "Aa", upper: "AA", lower: "aa" };

/** Accessible segmented control: a radio group styled as joined buttons. */
function Segmented<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: readonly { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap">
        {options.map((o) => (
          <label
            key={o.value}
            title={o.title}
            className={`-ml-px first:ml-0 flex min-h-9 min-w-9 cursor-pointer items-center justify-center border px-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent-fg)] ${
              value === o.value ? "relative z-10 border-[var(--color-fg)] bg-white/[0.08]" : "border-[var(--color-border-strong)] hover:border-[var(--color-fg-muted)]"
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MarkIcon({ mark }: { mark: BrandLogo["mark"] }) {
  const p = { fill: "currentColor" };
  return (
    <svg viewBox="0 0 100 100" className="h-4 w-4" aria-hidden="true">
      {mark === "circle" && <circle cx="50" cy="50" r="46" {...p} />}
      {mark === "ring" && <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="14" />}
      {mark === "square" && <rect x="6" y="6" width="88" height="88" {...p} />}
      {mark === "diamond" && <rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)" {...p} />}
      {mark === "slash" && <polygon points="26,6 96,6 74,94 4,94" {...p} />}
      {mark === "none" && <line x1="10" y1="90" x2="90" y2="10" stroke="currentColor" strokeWidth="8" />}
    </svg>
  );
}

export function IdentityForm({ artist, canEdit }: { artist: Artist; canEdit: boolean }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [name, setName] = useState(artist.name);
  const [bio, setBio] = useState(artist.bio);
  const [genre, setGenre] = useState(artist.genre.join(", "));
  const [colors, setColors] = useState(() => Object.fromEntries(COLOR_KEYS.map((k) => [k, artist.branding[k]])) as Record<(typeof COLOR_KEYS)[number], string>);
  const [motion, setMotion] = useState(artist.branding.motionPreset);
  const [wordmark, setWordmark] = useState(artist.branding.wordmark ?? "");
  const [font, setFont] = useState<BrandFontKey>(() => (artist.branding.fontFamily && artist.branding.fontFamily in BRAND_FONTS ? (artist.branding.fontFamily as BrandFontKey) : "geist"));
  const [logo, setLogo] = useState<BrandLogo>(() => resolveLogo(artist.branding));
  const [social, setSocial] = useState(() => Object.fromEntries(SOCIAL_KEYS.map((k) => [k, artist.socialLinks[k] ?? ""])) as Record<(typeof SOCIAL_KEYS)[number], string>);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  const setL = <K extends keyof BrandLogo>(k: K, v: BrandLogo[K]) => setLogo((l) => ({ ...l, [k]: v }));
  const branding = {
    ...colors,
    fontFamily: font === "geist" ? null : font,
    wordmark: wordmark.trim() || null,
    logo,
  };
  const shownName = brandName(branding, name || "Artist");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    const res = await studioFetch("/api/studio/artist", "PATCH", {
      name,
      bio,
      genre: genre.split(",").map((g) => g.trim()).filter(Boolean),
      branding: { ...branding, motionPreset: motion },
      socialLinks: social,
    });
    setSaving(false);
    if (res.ok) {
      setResult({ ok: true, message: "Saved. Your public profile is updated." });
      router.refresh();
    } else {
      setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
    }
  }

  const locked = !canEdit || saving || !hydrated;

  return (
    <form onSubmit={save} className="flex flex-col gap-6 min-w-0">
      {!canEdit && <p className="text-sm text-[var(--color-fg-muted)]">Read-only: only artist admins can change the artist identity.</p>}

      <fieldset disabled={locked} className="contents">
        <Panel title="Brand kit">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Controls */}
            <div className="flex flex-col gap-6 min-w-0">
              <Input
                label="Brand name"
                hint={`How your name is set in the logo. Leave empty to use “${name || "your artist name"}”.`}
                value={wordmark}
                placeholder={name}
                maxLength={WORDMARK_MAX}
                onChange={(e) => setWordmark(e.target.value)}
              />

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Typeface</legend>
                <p className="mb-2 text-xs text-[var(--color-fg-muted)]">System fonts: each device shows its closest installed match.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BRAND_FONT_KEYS.map((k) => (
                    <label
                      key={k}
                      className={`flex cursor-pointer flex-col gap-1 border p-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent-fg)] ${
                        font === k ? "border-[var(--color-fg)] bg-white/[0.06]" : "border-[var(--color-border-strong)] hover:border-[var(--color-fg-muted)]"
                      }`}
                    >
                      <input type="radio" name="brand-font" value={k} checked={font === k} onChange={() => setFont(k)} className="sr-only" />
                      <span className="truncate text-xl leading-tight" style={{ fontFamily: brandFontStack(k) }} aria-hidden="true">
                        {shownName.slice(0, 10) || "Aa"}
                      </span>
                      <span className="text-xs font-medium">{BRAND_FONTS[k].label}</span>
                      <span className="text-[10px] text-[var(--color-fg-muted)]">{BRAND_FONTS[k].note}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-4">
                <Segmented
                  legend="Logo mark"
                  name="logo-mark"
                  value={logo.mark}
                  onChange={(v) => setL("mark", v)}
                  options={LOGO_MARKS.map((m) => ({ value: m, title: MARK_LABEL[m], label: <><MarkIcon mark={m} /><span className="sr-only">{MARK_LABEL[m]}</span></> }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Monogram"
                    hint={`Up to ${MONOGRAM_MAX} characters inside the mark. Empty = “${initials(shownName)}”.`}
                    value={logo.monogram}
                    maxLength={MONOGRAM_MAX}
                    placeholder={initials(shownName)}
                    disabled={logo.mark === "none"}
                    onChange={(e) => setL("monogram", e.target.value)}
                  />
                  <Segmented legend="Layout" name="logo-layout" value={logo.layout} onChange={(v) => setL("layout", v)} options={LOGO_LAYOUTS.map((v) => ({ value: v, label: LAYOUT_LABEL[v] }))} />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-4">
                  <Segmented legend="Case" name="logo-case" value={logo.case} onChange={(v) => setL("case", v)} options={LOGO_CASES.map((v) => ({ value: v, label: CASE_LABEL[v], title: v }))} />
                  <Segmented legend="Spacing" name="logo-tracking" value={logo.tracking} onChange={(v) => setL("tracking", v)} options={LOGO_TRACKING.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} />
                  <Segmented legend="Weight" name="logo-weight" value={logo.weight} onChange={(v) => setL("weight", v)} options={LOGO_WEIGHTS.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} />
                </div>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Colors</legend>
                <div className="grid grid-cols-2 gap-3">
                  {COLOR_KEYS.map((k) => (
                    <div key={k} className="flex items-center gap-3 min-w-0">
                      <input
                        id={`color-${k}`}
                        type="color"
                        value={colors[k]}
                        onChange={(e) => setColors((c) => ({ ...c, [k]: e.target.value }))}
                        className="h-10 w-12 shrink-0 cursor-pointer border border-[var(--color-border)] bg-transparent"
                      />
                      <label htmlFor={`color-${k}`} className="min-w-0 text-sm">
                        {COLOR_LABEL[k]}
                        <span className="block font-mono text-xs text-[var(--color-fg-muted)]">{colors[k]}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>

              <Select
                label="Motion"
                value={motion}
                onChange={(e) => setMotion(e.target.value as Artist["branding"]["motionPreset"])}
                options={[
                  { value: "subtle", label: "Subtle" },
                  { value: "moderate", label: "Moderate" },
                  { value: "expressive", label: "Expressive" },
                ]}
              />
            </div>

            {/* Live preview */}
            <div className="flex flex-col gap-3 min-w-0 lg:sticky lg:top-20 lg:self-start" aria-label="Brand preview">
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">Preview</p>
              <div
                className="flex min-h-56 items-center justify-center overflow-hidden border border-[var(--color-border)] p-8"
                style={{ background: `linear-gradient(135deg, ${colors.backgroundColor}, ${colors.secondaryColor})` }}
                data-testid="brand-preview"
              >
                <ArtistLogo branding={branding} artistName={name || "Artist"} size="lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex min-h-24 items-center justify-center overflow-hidden border border-[var(--color-border)] p-4" style={{ backgroundColor: "#f2efe8" }}>
                  <ArtistLogo branding={branding} artistName={name || "Artist"} size="sm" color={colors.primaryColor} />
                </div>
                <div className="flex min-h-24 items-center justify-center overflow-hidden border border-[var(--color-border)] p-4" style={{ backgroundColor: colors.primaryColor }}>
                  <ArtistLogo branding={{ ...branding, primaryColor: colors.backgroundColor, backgroundColor: colors.primaryColor }} artistName={name || "Artist"} size="sm" />
                </div>
              </div>
              <div className="border border-[var(--color-border)] p-4" style={{ backgroundColor: colors.backgroundColor }}>
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: colors.accentColor }}>
                  Artist page
                </p>
                <p className="mt-1 text-3xl leading-none" style={{ fontFamily: brandFontStack(branding.fontFamily), color: "#f5f5f0", fontWeight: 900 }}>
                  {shownName}
                </p>
                <span className="mt-3 inline-block px-3 py-1 text-xs font-semibold" style={{ backgroundColor: colors.primaryColor, color: colors.backgroundColor }}>
                  Listen now
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Profile">
            <div className="flex flex-col gap-4">
              <Input label="Artist name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
              <TextArea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} rows={5} />
              <Input label="Genres" hint="Comma separated, up to 8" value={genre} onChange={(e) => setGenre(e.target.value)} />
            </div>
          </Panel>
          <Panel title="Links">
            <div className="grid gap-4 sm:grid-cols-2">
              {SOCIAL_KEYS.map((k) => (
                <Input
                  key={k}
                  id={`social-${k}`}
                  label={k === "appleMusic" ? "Apple Music" : k[0]!.toUpperCase() + k.slice(1)}
                  type="url"
                  placeholder="https://"
                  value={social[k]}
                  onChange={(e) => setSocial((s) => ({ ...s, [k]: e.target.value }))}
                />
              ))}
            </div>
          </Panel>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto min-w-0">
          <FormMessage result={result} />
        </div>
        {canEdit && (
          <Button type="submit" loading={saving} disabled={!hydrated}>
            Save identity
          </Button>
        )}
      </div>
    </form>
  );
}
