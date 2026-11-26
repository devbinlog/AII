"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Panel, SaveIndicator, Select, TextArea } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";
import { useUnsavedChanges } from "@/components/studio/use-unsaved-changes";
import { stableStringify } from "@/lib/studio/readiness";
import type { Release } from "@/types";

interface TrackDraft {
  key: string;
  title: string;
  minutes: string;
  seconds: string;
}

function toDraft(release: Release): TrackDraft[] {
  return release.tracks.map((t) => ({
    key: t.id,
    title: t.title,
    minutes: String(Math.floor(t.durationMs / 60000)),
    seconds: String(Math.floor((t.durationMs % 60000) / 1000)).padStart(2, "0"),
  }));
}

export function ReleaseEditor({ release, canPublish }: { release: Release; canPublish: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(release.title);
  const [description, setDescription] = useState(release.description);
  const [type, setType] = useState(release.type);
  const [releaseDate, setReleaseDate] = useState(release.releaseDate);
  const [label, setLabel] = useState(release.label ?? "");
  const [tracks, setTracks] = useState<TrackDraft[]>(() => toDraft(release));
  const [busy, setBusy] = useState<"save" | "publish" | "delete" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  const updateTrack = (key: string, patch: Partial<TrackDraft>) => setTracks((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  // Track keys are client-only; compare what is actually saved.
  const current = stableStringify({ title, description, type, releaseDate, label, tracks: tracks.map(({ title: t, minutes, seconds }) => [t, minutes, seconds]) });
  const [savedSnapshot, setSavedSnapshot] = useState(current);
  const [saveFailed, setSaveFailed] = useState(false);
  const dirty = current !== savedSnapshot;
  useUnsavedChanges(dirty);
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  async function save(): Promise<boolean> {
    const snapshot = current;
    setBusy("save");
    setResult(null);
    const res = await studioFetch(`/api/studio/releases/${release.id}`, "PATCH", {
      title,
      description,
      type,
      releaseDate,
      label: label.trim() || null,
      tracks: tracks.map((t) => ({
        title: t.title,
        durationMs: (Number(t.minutes) || 0) * 60000 + (Number(t.seconds) || 0) * 1000,
      })),
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

  async function reviewPublish() {
    if (dirty && !(await save())) return;
    setConfirmingPublish(true);
  }

  async function publish() {
    setConfirmingPublish(false);
    setBusy("publish");
    const res = await studioFetch(`/api/studio/releases/${release.id}/publish`, "POST");
    setBusy(null);
    setResult(res.ok ? { ok: true, message: "Published — the release is now public." } : { ok: false, message: res.message });
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this draft release?")) return;
    setBusy("delete");
    const res = await studioFetch(`/api/studio/releases/${release.id}`, "DELETE");
    setBusy(null);
    if (res.ok) {
      setSavedSnapshot(current); // nothing left to protect
      router.push("/studio/releases");
    } else {
      setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <Panel title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
            </div>
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as Release["type"])}
              options={[
                { value: "single", label: "Single" },
                { value: "ep", label: "EP" },
                { value: "album", label: "Album" },
                { value: "compilation", label: "Compilation" },
              ]}
            />
            <Input label="Release date" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
            <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
            <div className="sm:col-span-2">
              <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </div>
          </div>
        </Panel>

        <Panel
          title="Tracklist"
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTracks((ts) => [...ts, { key: `new_${Date.now()}`, title: `Track ${ts.length + 1}`, minutes: "3", seconds: "00" }])}
            >
              Add track
            </Button>
          }
        >
          {tracks.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">No tracks yet. A release needs at least one track to publish.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {tracks.map((t, i) => (
                <li key={t.key} className="flex flex-wrap items-end gap-2">
                  <span className="w-6 pb-2.5 text-xs font-mono text-[var(--color-fg-muted)]">{i + 1}</span>
                  <div className="flex-1 min-w-40">
                    <Input id={`track-title-${t.key}`} label="Track title" value={t.title} onChange={(e) => updateTrack(t.key, { title: e.target.value })} />
                  </div>
                  <div className="w-16">
                    <Input id={`track-min-${t.key}`} label="Min" inputMode="numeric" value={t.minutes} onChange={(e) => updateTrack(t.key, { minutes: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  <div className="w-16">
                    <Input id={`track-sec-${t.key}`} label="Sec" inputMode="numeric" value={t.seconds} onChange={(e) => updateTrack(t.key, { seconds: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove track ${i + 1}`} onClick={() => setTracks((ts) => ts.filter((x) => x.key !== t.key))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-xs text-[var(--color-fg-muted)]">Audio files are not uploaded in the demo environment.</p>
        </Panel>
      </div>

      <div className="flex flex-col gap-3">
        <SaveIndicator dirty={dirty} failed={saveFailed} />
        <FormMessage result={result} />
        <Button type="button" onClick={() => void save()} loading={busy === "save"} disabled={busy !== null}>
          Save
        </Button>
        {release.status === "draft" && (
          canPublish ? (
            <>
              <Button type="button" variant="outline" onClick={() => void reviewPublish()} loading={busy === "save" && confirmingPublish} disabled={busy !== null || (confirmingPublish && !dirty)}>
                Save &amp; publish
              </Button>
              {confirmingPublish && !dirty && (
                <section aria-labelledby="release-publish-title" className="border border-[var(--color-fg)] bg-[var(--color-bg-secondary)] p-4 flex flex-col gap-3">
                  <h2 id="release-publish-title" className="text-sm font-semibold">Publish “{title}”?</h2>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    {tracks.length} track{tracks.length === 1 ? "" : "s"} · {releaseDate}. The release page becomes public and a published release can no longer be deleted.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void publish()} disabled={busy !== null || tracks.length === 0} autoFocus>
                      Publish release
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingPublish(false)}>
                      Cancel
                    </Button>
                  </div>
                  {tracks.length === 0 && <p role="alert" className="text-xs text-[var(--color-accent-fg)]">Add at least one track before publishing.</p>}
                </section>
              )}
            </>
          ) : (
            <p className="text-xs text-[var(--color-fg-muted)]">An artist admin publishes releases.</p>
          )
        )}
        {release.status === "draft" && (
          <Button type="button" variant="destructive" onClick={() => void remove()} loading={busy === "delete"} disabled={busy !== null}>
            Delete draft
          </Button>
        )}
      </div>
    </div>
  );
}
