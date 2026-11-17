"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Panel, Select, TextArea } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";
import type { Artist } from "@/types";

const SOCIAL_KEYS = ["instagram", "twitter", "youtube", "spotify", "appleMusic", "website"] as const;
const COLOR_KEYS = ["primaryColor", "secondaryColor", "accentColor", "backgroundColor"] as const;

export function IdentityForm({ artist, canEdit }: { artist: Artist; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(artist.name);
  const [bio, setBio] = useState(artist.bio);
  const [genre, setGenre] = useState(artist.genre.join(", "));
  const [colors, setColors] = useState(() => Object.fromEntries(COLOR_KEYS.map((k) => [k, artist.branding[k]])) as Record<(typeof COLOR_KEYS)[number], string>);
  const [motion, setMotion] = useState(artist.branding.motionPreset);
  const [social, setSocial] = useState(() => Object.fromEntries(SOCIAL_KEYS.map((k) => [k, artist.socialLinks[k] ?? ""])) as Record<(typeof SOCIAL_KEYS)[number], string>);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    const res = await studioFetch("/api/studio/artist", "PATCH", {
      name,
      bio,
      genre: genre.split(",").map((g) => g.trim()).filter(Boolean),
      branding: { ...colors, motionPreset: motion },
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

  return (
    <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        {!canEdit && (
          <p className="text-sm text-[var(--color-fg-muted)]">Read-only: only artist admins can change the artist identity.</p>
        )}
        <fieldset disabled={!canEdit || saving} className="contents">
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
        </fieldset>
      </div>

      <div className="flex flex-col gap-6">
        <fieldset disabled={!canEdit || saving} className="contents">
          <Panel title="Brand">
            <div className="flex flex-col gap-4">
              {COLOR_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <input
                    id={`color-${k}`}
                    type="color"
                    value={colors[k]}
                    onChange={(e) => setColors((c) => ({ ...c, [k]: e.target.value }))}
                    className="h-10 w-12 shrink-0 cursor-pointer border border-[var(--color-border)] bg-transparent"
                  />
                  <label htmlFor={`color-${k}`} className="flex-1 text-sm">
                    {k.replace("Color", "")}
                    <span className="block font-mono text-xs text-[var(--color-fg-muted)]">{colors[k]}</span>
                  </label>
                </div>
              ))}
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
              <div
                aria-hidden="true"
                className="h-20 border border-[var(--color-border)] flex items-end p-3"
                style={{ background: `linear-gradient(135deg, ${colors.backgroundColor}, ${colors.secondaryColor})` }}
              >
                <span className="text-lg font-black" style={{ color: colors.primaryColor }}>{name || "Artist"}</span>
              </div>
            </div>
          </Panel>
        </fieldset>
        <FormMessage result={result} />
        {canEdit && (
          <Button type="submit" loading={saving}>
            Save identity
          </Button>
        )}
      </div>
    </form>
  );
}
