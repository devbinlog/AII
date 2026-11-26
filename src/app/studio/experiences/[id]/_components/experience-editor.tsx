"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Panel, SaveIndicator, Select, StatusBadge, TextArea } from "@/components/studio/ui";
import { describeDetails, studioFetch, type StudioResult } from "@/components/studio/client-api";
import { useUnsavedChanges } from "@/components/studio/use-unsaved-changes";
import { stableStringify, type ExperienceReadiness } from "@/lib/studio/readiness";
import { newObjectId } from "@/lib/studio/scene-objects";
import { formatRelativeTime } from "@/lib/utils/format";
import type { EditableParameter, Experience, ExperienceScene } from "@/types";

interface SceneOption {
  id: string;
  name: string;
  objects: { id: string; name: string; type: string }[];
}

const PROPERTY_OPTIONS: { value: EditableParameter["property"]; label: string; type: EditableParameter["type"]; textOnly?: boolean }[] = [
  { value: "style.fill", label: "Fill color", type: "color" },
  { value: "style.stroke", label: "Stroke color", type: "color" },
  { value: "transform.opacity", label: "Opacity", type: "number" },
  { value: "transform.rotation", label: "Rotation", type: "number" },
  { value: "data.content", label: "Text content", type: "text", textOnly: true },
];

function defaultFor(type: EditableParameter["type"], property: string): { defaultValue: string | number; min?: number; max?: number } {
  if (type === "color") return { defaultValue: "#e8192c" };
  if (type === "text") return { defaultValue: "Your text" };
  if (property === "transform.rotation") return { defaultValue: 0, min: -180, max: 180 };
  return { defaultValue: 1, min: 0, max: 1 };
}

export function ExperienceEditor({
  experience,
  scenes,
  releases,
  campaigns,
  versions,
  canPublish,
}: {
  experience: Experience;
  scenes: SceneOption[];
  releases: { id: string; title: string }[];
  campaigns: { id: string; title: string; slug: string; status: string }[];
  versions: { id: string; version: string; publishedAt: string; sceneCount: number }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(experience.title);
  const [description, setDescription] = useState(experience.description);
  const [releaseId, setReleaseId] = useState(experience.releaseId ?? "");
  const [sequence, setSequence] = useState<ExperienceScene[]>([...experience.scenes].sort((a, b) => a.order - b.order));
  const [params, setParams] = useState<EditableParameter[]>(experience.editableParameters);
  const [busy, setBusy] = useState<"save" | "publish" | "review" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  // What the server has stored; dirty = the form differs from it.
  const current = stableStringify({ title, description, releaseId, sequence, params });
  const [savedSnapshot, setSavedSnapshot] = useState(current);
  const [saveFailed, setSaveFailed] = useState(false);
  const dirty = current !== savedSnapshot;
  useUnsavedChanges(dirty);

  // Server-side publish readiness of the stored draft.
  const [readiness, setReadiness] = useState<ExperienceReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  const applyReadiness = useCallback((res: StudioResult<{ readiness: ExperienceReadiness }>): ExperienceReadiness | null => {
    if (!res.ok) {
      setReadinessError(res.message);
      return null;
    }
    setReadinessError(null);
    setReadiness(res.data.readiness);
    return res.data.readiness;
  }, []);

  const loadReadiness = useCallback(
    async () => applyReadiness(await studioFetch<{ readiness: ExperienceReadiness }>(`/api/studio/experiences/${experience.id}/publish`)),
    [applyReadiness, experience.id]
  );

  useEffect(() => {
    let alive = true;
    void studioFetch<{ readiness: ExperienceReadiness }>(`/api/studio/experiences/${experience.id}/publish`).then((res) => {
      if (alive) applyReadiness(res);
    });
    return () => {
      alive = false;
    };
  }, [applyReadiness, experience.id]);

  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
  }, [reviewing]);

  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const available = scenes.filter((s) => !sequence.some((e) => e.sceneId === s.id));
  const liveVersion = versions.find((v) => v.id === experience.currentVersionId);

  const move = (idx: number, dir: -1 | 1) =>
    setSequence((seq) => {
      const next = [...seq];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return seq;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next.map((s, i) => ({ ...s, order: i }));
    });

  async function save(): Promise<boolean> {
    const snapshot = current;
    setBusy("save");
    setResult(null);
    const res = await studioFetch(`/api/studio/experiences/${experience.id}`, "PATCH", {
      title,
      description,
      releaseId: releaseId || null,
      scenes: sequence.map((s, i) => ({ ...s, order: i, transitionType: s.transitionType === "custom" ? "fade" : s.transitionType })),
      editableParameters: params,
    });
    setBusy(null);
    if (!res.ok) {
      setSaveFailed(true);
      setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
      return false;
    }
    setSaveFailed(false);
    setSavedSnapshot(snapshot);
    setResult({ ok: true, message: "Draft saved. Fans still see the published version until you publish." });
    void loadReadiness();
    router.refresh();
    return true;
  }

  /** Step 1: save pending edits, then show the server's readiness for review. */
  async function review() {
    if (dirty && !(await save())) return;
    setBusy("review");
    const r = await loadReadiness();
    setBusy(null);
    if (r) setReviewing(true);
  }

  /** Step 2: freeze the stored draft into a new immutable version. */
  async function publish() {
    setBusy("publish");
    const res = await studioFetch<{ version: { version: string } }>(`/api/studio/experiences/${experience.id}/publish`, "POST");
    setBusy(null);
    setReviewing(false);
    if (res.ok) setResult({ ok: true, message: `Published v${res.data.version.version}. Campaigns using this experience now show it.` });
    else setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
    void loadReadiness();
    router.refresh();
  }

  const liveCampaigns = readiness?.campaigns.filter((c) => c.status === "active") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/studio/experiences" className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">← Experiences</Link>
        <h1 className="flex-1 min-w-0 truncate text-2xl font-semibold">{title || "Untitled experience"}</h1>
        <StatusBadge status={experience.currentVersionId ? "published" : "draft"} />
        {liveVersion && <span className="text-xs font-mono text-[var(--color-fg-muted)]">live v{liveVersion.version}</span>}
        {liveVersion && readiness?.hasUnpublishedChanges && (
          <span className="text-xs font-mono text-amber-400">Draft differs from live</span>
        )}
        <SaveIndicator dirty={dirty} failed={saveFailed} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6 min-w-0">
          <Panel title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
              <Select label="Linked release" value={releaseId} onChange={(e) => setReleaseId(e.target.value)} options={[{ value: "", label: "None" }, ...releases.map((r) => ({ value: r.id, label: r.title }))]} />
              <div className="sm:col-span-2">
                <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
              </div>
            </div>
          </Panel>

          <Panel title={`Scene sequence (${sequence.length})`}>
            {sequence.length === 0 && <p className="mb-3 text-sm text-[var(--color-fg-muted)]">Add scenes in the order fans will see them.</p>}
            <ol className="flex flex-col gap-2">
              {sequence.map((entry, i) => {
                const scene = sceneById.get(entry.sceneId);
                return (
                  <li key={entry.sceneId} className="flex flex-wrap items-center gap-2 border border-[var(--color-border)] px-3 py-2">
                    <span className="w-6 text-xs font-mono text-[var(--color-fg-muted)]">{i + 1}</span>
                    <Link href={`/studio/scenes/${entry.sceneId}`} className="flex-1 min-w-32 truncate text-sm underline-offset-4 hover:underline">
                      {scene?.name ?? entry.sceneId}
                    </Link>
                    <label className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
                      Transition
                      <select
                        value={entry.transitionType === "custom" ? "fade" : entry.transitionType}
                        onChange={(e) => setSequence((seq) => seq.map((s) => (s.sceneId === entry.sceneId ? { ...s, transitionType: e.target.value as ExperienceScene["transitionType"] } : s)))}
                        className="h-8 bg-[var(--color-bg)] border border-[var(--color-border)] px-1 text-[var(--color-fg)]"
                      >
                        <option value="cut">cut</option>
                        <option value="fade">fade</option>
                        <option value="slide">slide</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
                      ms
                      <input
                        type="number"
                        min={0}
                        max={5000}
                        step={100}
                        value={entry.transitionDuration}
                        onChange={(e) => setSequence((seq) => seq.map((s) => (s.sceneId === entry.sceneId ? { ...s, transitionDuration: Math.max(0, Math.min(5000, Number(e.target.value) || 0)) } : s)))}
                        className="h-8 w-20 bg-transparent border border-[var(--color-border)] px-1 font-mono text-[var(--color-fg)]"
                      />
                    </label>
                    <div className="flex">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${scene?.name ?? "scene"} earlier`} className="h-8 w-8 disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === sequence.length - 1} aria-label={`Move ${scene?.name ?? "scene"} later`} className="h-8 w-8 disabled:opacity-30">↓</button>
                      <button
                        type="button"
                        onClick={() => {
                          setSequence((seq) => seq.filter((s) => s.sceneId !== entry.sceneId).map((s, j) => ({ ...s, order: j })));
                          setParams((ps) => ps.filter((p) => p.sceneId !== entry.sceneId));
                        }}
                        aria-label={`Remove ${scene?.name ?? "scene"} from sequence`}
                        className="h-8 px-2 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-accent-fg)]"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            {available.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-48">
                  <Select
                    label="Add scene"
                    id="add-scene"
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) setSequence((seq) => [...seq, { sceneId: id, order: seq.length, transitionType: "fade", transitionDuration: 600 }]);
                    }}
                    options={[{ value: "", label: "Choose a scene…" }, ...available.map((s) => ({ value: s.id, label: s.name }))]}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
                All scenes are in the sequence. <Link href="/studio/scenes" className="underline">Create another scene</Link>.
              </p>
            )}
          </Panel>

          <Panel
            title={`Fan parameters (${params.length}/30)`}
            actions={
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sequence.length === 0 || params.length >= 30}
                onClick={() => {
                  const scene = sceneById.get(sequence[0]!.sceneId);
                  const obj = scene?.objects[0];
                  if (!scene || !obj) {
                    setResult({ ok: false, message: "The first scene has no objects to expose." });
                    return;
                  }
                  setParams((ps) => [...ps, { id: newObjectId("ep"), sceneId: scene.id, objectId: obj.id, property: "style.fill", label: `${obj.name} color`, type: "color", ...defaultFor("color", "style.fill") }]);
                }}
              >
                Add parameter
              </Button>
            }
          >
            <p className="mb-3 text-xs text-[var(--color-fg-muted)]">Choose what fans can customize in the Fan Creator. Everything else stays locked.</p>
            <ul className="flex flex-col gap-3">
              {params.map((p) => {
                const scene = sceneById.get(p.sceneId);
                const objects = scene?.objects ?? [];
                const obj = objects.find((o) => o.id === p.objectId);
                const update = (patch: Partial<EditableParameter>) => setParams((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
                const props = PROPERTY_OPTIONS.filter((o) => !o.textOnly || obj?.type === "text");
                return (
                  <li key={p.id} className="border border-[var(--color-border)] p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 items-end">
                    <Input id={`${p.id}-label`} label="Label" value={p.label} maxLength={60} onChange={(e) => update({ label: e.target.value })} />
                    <Select
                      id={`${p.id}-scene`}
                      label="Scene"
                      value={p.sceneId}
                      onChange={(e) => {
                        const s = sceneById.get(e.target.value);
                        update({ sceneId: e.target.value, objectId: s?.objects[0]?.id ?? "" });
                      }}
                      options={sequence.map((e) => ({ value: e.sceneId, label: sceneById.get(e.sceneId)?.name ?? e.sceneId }))}
                    />
                    <Select id={`${p.id}-object`} label="Object" value={p.objectId} onChange={(e) => update({ objectId: e.target.value })} options={objects.map((o) => ({ value: o.id, label: `${o.name} (${o.type})` }))} />
                    <Select
                      id={`${p.id}-prop`}
                      label="Property"
                      value={p.property}
                      onChange={(e) => {
                        const opt = PROPERTY_OPTIONS.find((o) => o.value === e.target.value)!;
                        const { min: _min, max: _max, ...rest } = p;
                        update({ ...rest, property: opt.value, type: opt.type, ...defaultFor(opt.type, opt.value) });
                      }}
                      options={props.map((o) => ({ value: o.value, label: o.label }))}
                    />
                    <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-end gap-2">
                      {p.type === "color" ? (
                        <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                          Default
                          <input type="color" value={String(p.defaultValue)} onChange={(e) => update({ defaultValue: e.target.value })} className="h-9 w-12 border border-[var(--color-border)] bg-transparent" />
                        </label>
                      ) : p.type === "number" ? (
                        <>
                          {(["min", "max"] as const).map((k) => (
                            <label key={k} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                              {k}
                              <input type="number" step="any" value={p[k] ?? ""} onChange={(e) => update({ [k]: Number(e.target.value) })} className="h-9 w-20 bg-transparent border border-[var(--color-border)] px-2 font-mono text-[var(--color-fg)]" />
                            </label>
                          ))}
                          <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                            Default
                            <input type="number" step="any" value={Number(p.defaultValue)} onChange={(e) => update({ defaultValue: Number(e.target.value) })} className="h-9 w-24 bg-transparent border border-[var(--color-border)] px-2 font-mono text-[var(--color-fg)]" />
                          </label>
                        </>
                      ) : (
                        <div className="flex-1 min-w-40">
                          <Input id={`${p.id}-default`} label="Default text" value={String(p.defaultValue)} maxLength={500} onChange={(e) => update({ defaultValue: e.target.value })} />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setParams((ps) => ps.filter((x) => x.id !== p.id))} className="h-9 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-accent-fg)]">
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <FormMessage result={result} />
            <Button type="button" onClick={() => void save()} loading={busy === "save"} disabled={busy !== null}>
              Save draft
            </Button>
            <Link
              href={`/studio/experiences/${experience.id}/preview`}
              className="h-10 inline-flex items-center justify-center px-4 text-sm border border-[var(--color-border)] hover:border-[var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg)]"
            >
              Preview saved draft
            </Link>
            {dirty && <p className="text-xs text-[var(--color-fg-muted)]">Save to include your latest edits in the preview.</p>}
            {canPublish ? (
              <Button type="button" variant="outline" onClick={() => void review()} loading={busy === "review"} disabled={busy !== null || (reviewing && !dirty)}>
                Save &amp; publish new version
              </Button>
            ) : (
              <p className="text-xs text-[var(--color-fg-muted)]">An artist admin publishes experiences.</p>
            )}
          </div>

          {/* Further edits invalidate the review: it describes the stored draft only. */}
          {reviewing && readiness && !dirty && (
            <section aria-labelledby="publish-review-title" className="border border-[var(--color-fg)] bg-[var(--color-bg-secondary)] p-4 flex flex-col gap-3">
              <h2 id="publish-review-title" ref={reviewHeading} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                Publish v{readiness.nextVersion}?
              </h2>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                <li>
                  {readiness.sceneCount} scene{readiness.sceneCount === 1 ? "" : "s"} · {readiness.parameterCount} fan parameter{readiness.parameterCount === 1 ? "" : "s"}
                </li>
                <li>
                  {readiness.liveVersion
                    ? `Replaces live v${readiness.liveVersion.version}. Earlier versions stay frozen.`
                    : "First version — fans can play it once a campaign is live."}
                </li>
                {readiness.liveVersion && !readiness.hasUnpublishedChanges && <li>Nothing changed since v{readiness.liveVersion.version}.</li>}
                <li>
                  {liveCampaigns.length > 0
                    ? `Updates ${liveCampaigns.length} live campaign${liveCampaigns.length === 1 ? "" : "s"}: ${liveCampaigns.map((c) => c.title).join(", ")}`
                    : "No live campaign uses this experience yet."}
                </li>
                {readiness.release && <li>Linked release: {readiness.release.title} ({readiness.release.status})</li>}
              </ul>
              {readiness.issues.length > 0 && (
                <div role="alert" className="border border-[var(--color-accent)] px-3 py-2 text-xs text-[var(--color-accent-fg)]">
                  <p className="font-semibold">Fix before publishing:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {readiness.issues.map((issue, i) => (
                      <li key={`${issue.code}-${i}`}>
                        {issue.sceneId && sceneById.has(issue.sceneId) ? (
                          <Link href={`/studio/scenes/${issue.sceneId}`} className="underline underline-offset-2">{issue.message}</Link>
                        ) : (
                          issue.message
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void publish()} loading={busy === "publish"} disabled={busy !== null || !readiness.ready}>
                  Publish v{readiness.nextVersion}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setReviewing(false)} disabled={busy !== null}>
                  Cancel
                </Button>
              </div>
            </section>
          )}

          <Panel title="Publish checklist">
            {readinessError ? (
              <p className="text-sm text-[var(--color-fg-muted)]">
                Checklist unavailable: {readinessError}{" "}
                <button type="button" className="underline underline-offset-2" onClick={() => void loadReadiness()}>Retry</button>
              </p>
            ) : !readiness ? (
              <p className="text-sm text-[var(--color-fg-muted)]" aria-busy="true">Checking…</p>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <p className={readiness.ready ? "text-emerald-400" : "text-[var(--color-accent-fg)]"}>
                  {readiness.ready ? "Ready to publish" : `${readiness.issues.length} issue${readiness.issues.length === 1 ? "" : "s"} block publishing`}
                </p>
                {!readiness.ready && (
                  <ul className="list-disc pl-4 text-xs text-[var(--color-fg-muted)]">
                    {readiness.issues.slice(0, 4).map((issue, i) => <li key={`${issue.code}-${i}`}>{issue.message}</li>)}
                  </ul>
                )}
                <p className="text-xs text-[var(--color-fg-muted)]">
                  {readiness.liveVersion
                    ? readiness.hasUnpublishedChanges
                      ? `Saved draft differs from live v${readiness.liveVersion.version}.`
                      : `Saved draft matches live v${readiness.liveVersion.version}.`
                    : "Not published yet."}
                  {dirty ? " Unsaved edits are checked after you save." : ""}
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Versions">
            {versions.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">Not published yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono">v{v.version}</span>
                    <span className="text-xs text-[var(--color-fg-muted)]">
                      {v.sceneCount} scenes · {formatRelativeTime(v.publishedAt)}
                      {v.id === experience.currentVersionId ? " · live" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-[var(--color-fg-muted)]">Published versions never change. Editing scenes affects only the next version.</p>
          </Panel>

          <Panel title="Campaigns">
            {campaigns.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">
                Not used by a campaign. <Link href={`/studio/campaigns?experience=${experience.id}`} className="underline">Create one</Link> to share it with fans.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/studio/campaigns/${c.id}`} className="truncate hover:underline underline-offset-4">{c.title}</Link>
                    <span className="flex items-center gap-2">
                      {c.status === "active" && experience.currentVersionId && (
                        <Link href={`/campaigns/${c.slug}/experience`} className="text-xs underline underline-offset-4">Fan view</Link>
                      )}
                      <StatusBadge status={c.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
