// WS-08 production readiness (pure — no I/O).
//
// Answers two server-side questions the Studio UI used to guess at:
//  1. Can this experience be published right now, and does its draft differ
//     from the version fans currently play?
//  2. Where is the artist in the Identity → Release → Scene → Experience →
//     Campaign flow, and what is the next useful step?
//
// The 3D Stage is an independent, artist-level publication (StageLayout +
// StagePublication); it is reported alongside the flow but never gates it.

import { validateExperienceForPublish, type PublishIssue } from "./publish";
import type { Artist, Campaign, Experience, ExperienceVersion, Release, Scene } from "@/types";

/** Key-order-independent JSON, so equal data always compares equal. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * True when publishing now would give fans something different from the live
 * version: the scene sequence, transitions, fan parameters, or any scene's
 * current schema changed. Always true when nothing is published yet.
 */
export function experienceDraftDiffers(
  experience: Experience,
  live: ExperienceVersion | null,
  scenesById: Map<string, Scene | null>
): boolean {
  if (!live) return true;
  const draftScenes = [...experience.scenes].sort((a, b) => a.order - b.order);
  const liveScenes = [...live.snapshot.scenes].sort((a, b) => a.order - b.order);
  if (stableStringify(draftScenes) !== stableStringify(liveScenes)) return true;
  if (stableStringify(experience.editableParameters) !== stableStringify(live.snapshot.editableParameters ?? [])) return true;
  for (const entry of draftScenes) {
    const scene = scenesById.get(entry.sceneId) ?? null;
    const frozen = live.snapshot.sceneSchemas[entry.sceneId];
    if (!scene || !frozen) return true;
    if (stableStringify(scene.schema) !== stableStringify(frozen)) return true;
  }
  return false;
}

export interface ExperienceReadiness {
  experienceId: string;
  /** No blocking issues: the server would accept a publish now. */
  ready: boolean;
  issues: PublishIssue[];
  /** Publishing now would change what fans see. */
  hasUnpublishedChanges: boolean;
  liveVersion: { id: string; version: string; publishedAt: string } | null;
  /** The label the next publish will get. */
  nextVersion: string;
  sceneCount: number;
  parameterCount: number;
  /** Campaigns that serve this experience; publishing updates all live ones. */
  campaigns: { id: string; title: string; slug: string; status: Campaign["status"] }[];
  release: { id: string; title: string; status: Release["status"] } | null;
}

export function buildExperienceReadiness(input: {
  experience: Experience;
  scenesById: Map<string, Scene | null>;
  versions: ExperienceVersion[];
  campaigns: Campaign[];
  release: Release | null;
}): ExperienceReadiness {
  const { experience, scenesById, versions, campaigns, release } = input;
  const issues = validateExperienceForPublish(experience, scenesById);
  const live = versions.find((v) => v.id === experience.currentVersionId) ?? null;
  return {
    experienceId: experience.id,
    ready: issues.length === 0,
    issues,
    hasUnpublishedChanges: experienceDraftDiffers(experience, live, scenesById),
    liveVersion: live ? { id: live.id, version: live.version, publishedAt: live.publishedAt } : null,
    nextVersion: `${versions.length + 1}.0.0`,
    sceneCount: experience.scenes.length,
    parameterCount: experience.editableParameters.length,
    campaigns: campaigns
      .filter((c) => c.experienceId === experience.id && c.artistId === experience.artistId)
      .map((c) => ({ id: c.id, title: c.title, slug: c.slug, status: c.status })),
    release:
      release && release.artistId === experience.artistId && release.id === experience.releaseId
        ? { id: release.id, title: release.title, status: release.status }
        : null,
  };
}

// ------------------------------------------------------------
// Artist production flow
// ------------------------------------------------------------

export type FlowStepKey = "identity" | "release" | "scene" | "experience" | "campaign";
export type FlowStepState = "done" | "in_progress" | "todo";

export interface FlowStep {
  key: FlowStepKey;
  label: string;
  state: FlowStepState;
  summary: string;
  href: string;
}

export interface StudioFlow {
  steps: FlowStep[];
  /** First step that is not done, with a concrete action; null when everything is live. */
  next: { key: FlowStepKey; label: string; href: string } | null;
  stage: { state: "live" | "draft" | "not_set"; version: number | null; href: string };
}

export function buildStudioFlow(input: {
  artist: Artist;
  releases: Release[];
  scenes: Scene[];
  experiences: Experience[];
  campaigns: Campaign[];
  stage: { saved: boolean; publicVersion: number | null };
}): StudioFlow {
  const { artist, stage } = input;
  // Never count another artist's content, whatever the caller passed in.
  const own = <T extends { artistId: string }>(items: T[]) => items.filter((x) => x.artistId === artist.id);
  const releases = own(input.releases);
  const scenes = own(input.scenes);
  const experiences = own(input.experiences);
  const campaigns = own(input.campaigns);

  // The profile needs a bio. The brand kit is optional: without a logo the artist
  // name is still rendered as a wordmark in the brand colours.
  const hasBrandKit = artist.branding.logoUrl !== null || artist.branding.logo != null || Boolean(artist.branding.wordmark?.trim()) || artist.branding.fontFamily !== null;
  const identityDone = artist.bio.trim().length > 0;
  const released = releases.filter((r) => r.status === "released" || r.status === "scheduled");
  const draftRelease = releases.find((r) => r.status === "draft");
  const nonEmptyScenes = scenes.filter((s) => s.schema.objects.length > 0);
  const published = experiences.filter((e) => e.currentVersionId !== null);
  const draftExperience = experiences.find((e) => e.currentVersionId === null);
  const live = campaigns.filter((c) => c.status === "active");
  const draftCampaign = campaigns.find((c) => c.status === "draft" || c.status === "scheduled");

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const steps: FlowStep[] = [
    {
      key: "identity",
      label: "Identity",
      state: identityDone ? "done" : "in_progress",
      summary: identityDone ? (hasBrandKit ? "Profile and brand kit set" : "Profile set · brand kit optional") : "Write your artist bio",
      href: "/studio/identity",
    },
    {
      key: "release",
      label: "Release",
      state: released.length > 0 ? "done" : releases.length > 0 ? "in_progress" : "todo",
      summary:
        released.length > 0
          ? `${plural(released.length, "release")} out`
          : releases.length > 0
            ? `${plural(releases.length, "draft")} — publish one`
            : "Create your first release",
      href: released.length === 0 && draftRelease ? `/studio/releases/${draftRelease.id}` : "/studio/releases",
    },
    {
      key: "scene",
      label: "Scene",
      state: nonEmptyScenes.length > 0 ? "done" : scenes.length > 0 ? "in_progress" : "todo",
      summary:
        nonEmptyScenes.length > 0
          ? `${plural(nonEmptyScenes.length, "scene")} ready`
          : scenes.length > 0
            ? "Add objects to a scene"
            : "Build a visual scene",
      href: nonEmptyScenes.length === 0 && scenes[0] ? `/studio/scenes/${scenes[0].id}` : "/studio/scenes",
    },
    {
      key: "experience",
      label: "Experience",
      state: published.length > 0 ? "done" : experiences.length > 0 ? "in_progress" : "todo",
      summary:
        published.length > 0
          ? `${plural(published.length, "experience")} published`
          : experiences.length > 0
            ? "Preview and publish a version"
            : "Sequence scenes into an experience",
      href: published.length === 0 && draftExperience ? `/studio/experiences/${draftExperience.id}` : "/studio/experiences",
    },
    {
      key: "campaign",
      label: "Campaign",
      state: live.length > 0 ? "done" : campaigns.length > 0 ? "in_progress" : "todo",
      summary:
        live.length > 0
          ? `${plural(live.length, "campaign")} live`
          : campaigns.length > 0
            ? "Take a campaign live"
            : "Open a campaign to fans",
      href: live.length === 0 && draftCampaign ? `/studio/campaigns/${draftCampaign.id}` : "/studio/campaigns",
    },
  ];

  const pending = steps.find((s) => s.state !== "done") ?? null;
  return {
    steps,
    next: pending ? { key: pending.key, label: pending.summary, href: pending.href } : null,
    stage: {
      state: stage.publicVersion !== null ? "live" : stage.saved ? "draft" : "not_set",
      version: stage.publicVersion,
      href: "/studio/stage",
    },
  };
}
