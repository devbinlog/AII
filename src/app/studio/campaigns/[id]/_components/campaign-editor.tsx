"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Panel, SaveIndicator, Select, StatusBadge, TextArea } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";
import { useUnsavedChanges } from "@/components/studio/use-unsaved-changes";
import { stableStringify } from "@/lib/studio/readiness";
import type { Campaign } from "@/types";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignEditor({
  campaign,
  experiences,
  canPublish,
}: {
  campaign: Campaign;
  experiences: { id: string; title: string; published: boolean }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(campaign.title);
  const [description, setDescription] = useState(campaign.description);
  const [experienceId, setExperienceId] = useState(campaign.experienceId);
  const [primaryColor, setPrimaryColor] = useState(campaign.branding.primaryColor);
  const [backgroundColor, setBackgroundColor] = useState(campaign.branding.backgroundColor);
  const [tagline, setTagline] = useState(campaign.branding.tagline ?? "");
  const [policy, setPolicy] = useState(campaign.participationPolicy);
  const [startsAt, setStartsAt] = useState(toLocalInput(campaign.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(campaign.endsAt));
  const [busy, setBusy] = useState<"save" | "publish" | "end" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  const editable = campaign.status !== "ended" && campaign.status !== "archived";
  const selectedExperience = experiences.find((e) => e.id === experienceId);
  const isPublic = campaign.status !== "draft";

  const current = stableStringify({ title, description, experienceId, primaryColor, backgroundColor, tagline, policy, startsAt, endsAt });
  const [savedSnapshot, setSavedSnapshot] = useState(current);
  const [saveFailed, setSaveFailed] = useState(false);
  const dirty = editable && current !== savedSnapshot;
  useUnsavedChanges(dirty);

  const [confirmingLive, setConfirmingLive] = useState(false);
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (confirmingLive) confirmHeading.current?.focus();
  }, [confirmingLive]);

  async function save(): Promise<boolean> {
    const snapshot = current;
    setBusy("save");
    setResult(null);
    const res = await studioFetch(`/api/studio/campaigns/${campaign.id}`, "PATCH", {
      title,
      description,
      experienceId,
      branding: { primaryColor, backgroundColor, tagline: tagline.trim() || null },
      participationPolicy: policy,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    });
    setBusy(null);
    if (!res.ok) {
      setSaveFailed(true);
      setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
      return false;
    }
    setSaveFailed(false);
    setSavedSnapshot(snapshot);
    setResult({ ok: true, message: "Saved" });
    router.refresh();
    return true;
  }

  /** Going live is public: save pending edits, then ask for a final confirmation. */
  async function reviewGoLive() {
    if (dirty && !(await save())) return;
    setConfirmingLive(true);
  }

  async function setStatus(action: "publish" | "end") {
    if (action === "end" && !window.confirm("End this campaign? Fans will no longer be able to create artworks.")) return;
    setConfirmingLive(false);
    setBusy(action);
    const res = await studioFetch(`/api/studio/campaigns/${campaign.id}/status`, "POST", { action });
    setBusy(null);
    setResult(res.ok ? { ok: true, message: action === "publish" ? "Campaign is live." : "Campaign ended." } : { ok: false, message: res.message });
    router.refresh();
  }

  const toggle = (key: "requireLogin" | "allowAnonymousCreate" | "moderationEnabled" | "autoPublishArtworks", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={policy[key]} onChange={(e) => setPolicy((p) => ({ ...p, [key]: e.target.checked }))} />
      {label}
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/studio/campaigns" className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">← Campaigns</Link>
        <h1 className="flex-1 min-w-0 truncate text-2xl font-semibold">{title}</h1>
        <StatusBadge status={campaign.status} />
        {editable && <SaveIndicator dirty={dirty} failed={saveFailed} />}
        {isPublic && (
          <Link href={`/campaigns/${campaign.slug}`} className="text-sm underline underline-offset-4">Open public page</Link>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <fieldset disabled={!editable || busy !== null} className="flex flex-col gap-6 min-w-0">
          <Panel title="Campaign">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
              <Input label="Address" value={`/campaigns/${campaign.slug}`} readOnly hint="Set when the campaign was created" />
              <div className="sm:col-span-2">
                <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
              </div>
              <Select
                label="Experience"
                value={experienceId}
                onChange={(e) => setExperienceId(e.target.value)}
                options={experiences.map((x) => ({ value: x.id, label: `${x.title}${x.published ? "" : " (not published)"}` }))}
              />
              <Input label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} />
              <Input label="Starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              <Input label="Ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </Panel>

          <Panel title="Branding">
            <div className="flex flex-wrap gap-6">
              {[
                { id: "cmp-primary", label: "Primary", value: primaryColor, set: setPrimaryColor },
                { id: "cmp-bg", label: "Background", value: backgroundColor, set: setBackgroundColor },
              ].map((c) => (
                <label key={c.id} htmlFor={c.id} className="flex items-center gap-2 text-sm">
                  <input id={c.id} type="color" value={c.value} onChange={(e) => c.set(e.target.value)} className="h-9 w-12 border border-[var(--color-border)] bg-transparent" />
                  {c.label} <span className="font-mono text-xs text-[var(--color-fg-muted)]">{c.value}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 h-24 border border-[var(--color-border)] flex flex-col justify-end p-4" style={{ backgroundColor }} aria-hidden="true">
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: primaryColor }}>{tagline || "Campaign"}</span>
              <span className="text-xl font-bold text-white truncate">{title}</span>
            </div>
          </Panel>

          <Panel title="Participation">
            <div className="grid gap-3 sm:grid-cols-2">
              {toggle("requireLogin", "Require sign-in to view")}
              {toggle("allowAnonymousCreate", "Allow creating without sign-in")}
              {toggle("moderationEnabled", "Moderate artworks")}
              {toggle("autoPublishArtworks", "Auto-publish artworks")}
              <Input
                label="Max artworks per fan"
                hint="0 = unlimited"
                type="number"
                min={0}
                max={100}
                value={policy.maxArtworksPerUser}
                onChange={(e) => setPolicy((p) => ({ ...p, maxArtworksPerUser: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
              />
              <Select
                label="Default artwork visibility"
                value={policy.defaultArtworkPermission}
                onChange={(e) => setPolicy((p) => ({ ...p, defaultArtworkPermission: e.target.value as Campaign["participationPolicy"]["defaultArtworkPermission"] }))}
                options={[
                  { value: "public", label: "Public" },
                  { value: "unlisted", label: "Unlisted" },
                  { value: "private", label: "Private" },
                ]}
              />
            </div>
          </Panel>
        </fieldset>

        <div className="flex flex-col gap-3">
          <FormMessage result={result} />
          {editable && (
            <Button type="button" onClick={() => void save()} loading={busy === "save"} disabled={busy !== null}>
              Save
            </Button>
          )}
          {canPublish && (campaign.status === "draft" || campaign.status === "scheduled") && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void reviewGoLive()}
                loading={busy === "save" && confirmingLive}
                disabled={busy !== null || !selectedExperience?.published || (confirmingLive && !dirty)}
              >
                Save &amp; go live
              </Button>
              {!selectedExperience?.published && (
                <p className="text-xs text-[var(--color-fg-muted)]">
                  Publish the experience before going live.{" "}
                  <Link href={`/studio/experiences/${experienceId}`} className="underline underline-offset-2">Open experience</Link>
                </p>
              )}
              {confirmingLive && !dirty && selectedExperience?.published && (
                <section aria-labelledby="go-live-title" className="border border-[var(--color-fg)] bg-[var(--color-bg-secondary)] p-4 flex flex-col gap-3">
                  <h2 id="go-live-title" ref={confirmHeading} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                    Go live now?
                  </h2>
                  <ul className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                    <li>Public at /campaigns/{campaign.slug}</li>
                    <li>Fans play the published version of “{selectedExperience.title}”.</li>
                    <li>
                      {policy.requireLogin ? "Sign-in required to view" : "Anyone can view"} ·{" "}
                      {policy.moderationEnabled ? "artworks are moderated" : "artworks are not moderated"}
                    </li>
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void setStatus("publish")} loading={busy === "publish"} disabled={busy !== null}>
                      Go live now
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingLive(false)} disabled={busy !== null}>
                      Cancel
                    </Button>
                  </div>
                </section>
              )}
            </>
          )}
          {canPublish && campaign.status === "active" && (
            <Button type="button" variant="destructive" onClick={() => void setStatus("end")} loading={busy === "end"} disabled={busy !== null}>
              End campaign
            </Button>
          )}
          {!canPublish && <p className="text-xs text-[var(--color-fg-muted)]">An artist admin takes campaigns live.</p>}
          {!editable && <p className="text-xs text-[var(--color-fg-muted)]">This campaign has {campaign.status} and is read-only.</p>}
          {campaign.status === "draft" && <p className="text-xs text-[var(--color-fg-muted)]">Drafts are not visible to fans.</p>}
        </div>
      </div>
    </div>
  );
}
