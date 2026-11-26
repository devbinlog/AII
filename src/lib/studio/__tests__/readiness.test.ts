import { describe, expect, it } from "vitest";
import { buildExperienceReadiness, buildStudioFlow, experienceDraftDiffers, stableStringify } from "../readiness";
import type { Artist, Campaign, Experience, ExperienceVersion, Release, Scene, SceneSchema } from "@/types";

const T = "2026-11-26T00:00:00Z";

function schema(sceneId: string, objects = 1): SceneSchema {
  return {
    version: "1.0.0",
    sceneId,
    canvasWidth: 1280,
    canvasHeight: 720,
    backgroundColor: "#000000",
    audioTrackId: null,
    duration: null,
    interactions: [],
    objects: Array.from({ length: objects }, (_, i) => ({
      id: `obj_${i}`,
      name: `Text ${i}`,
      transform: { x: 0, y: 0, z: 0, width: 100, height: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      style: { fill: "#ffffff", stroke: null, strokeWidth: 0, fontSize: 24, fontFamily: null, fontWeight: 400, textAlign: "left", borderRadius: 0, blendMode: "normal" },
      data: { type: "text", content: "Hi" },
      visible: true,
      locked: false,
      parentId: null,
      createdAt: T,
      updatedAt: T,
    })),
  } as SceneSchema;
}

function scene(id: string, artistId = "art_a", objects = 1): Scene {
  return { id, artistId, experienceId: null, name: id, description: "", thumbnailUrl: null, schema: schema(id, objects), status: "draft", createdAt: T, updatedAt: T };
}

function experience(patch: Partial<Experience> = {}): Experience {
  return {
    id: "exp_a",
    artistId: "art_a",
    releaseId: null,
    title: "Exp",
    description: "",
    coverImageUrl: null,
    scenes: [{ sceneId: "scn_1", order: 0, transitionType: "fade", transitionDuration: 600 }],
    editableParameters: [],
    status: "draft",
    currentVersionId: null,
    totalPlayCount: 0,
    createdAt: T,
    updatedAt: T,
    ...patch,
  };
}

function versionOf(exp: Experience, scenes: Scene[], id = "expv_1", n = 1): ExperienceVersion {
  return structuredClone({
    id,
    experienceId: exp.id,
    version: `${n}.0.0`,
    schemaVersions: {},
    snapshot: { scenes: exp.scenes, sceneSchemas: Object.fromEntries(scenes.map((s) => [s.id, s.schema])), editableParameters: exp.editableParameters },
    rendererVersion: "1.0.0",
    publishedAt: T,
    publishedBy: "usr",
  });
}

describe("stableStringify", () => {
  it("ignores key order and undefined values", () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: [1, { y: 1, x: 2 }] } })).toBe(stableStringify({ b: { d: [1, { x: 2, y: 1 }], c: 2 }, a: 1, z: undefined }));
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe("experienceDraftDiffers", () => {
  const s1 = scene("scn_1");
  const exp = experience({ currentVersionId: "expv_1" });
  const live = versionOf(exp, [s1]);
  const byId = (s: Scene) => new Map<string, Scene | null>([[s.id, s]]);

  it("unpublished experiences always differ", () => {
    expect(experienceDraftDiffers(exp, null, byId(s1))).toBe(true);
  });

  it("matches right after publishing", () => {
    expect(experienceDraftDiffers(exp, live, byId(s1))).toBe(false);
  });

  it("detects scene schema edits made after publishing", () => {
    const edited = structuredClone(s1);
    edited.schema.backgroundColor = "#112233";
    expect(experienceDraftDiffers(exp, live, byId(edited))).toBe(true);
  });

  it("detects sequence, transition and parameter changes", () => {
    expect(experienceDraftDiffers({ ...exp, scenes: [{ ...exp.scenes[0]!, transitionDuration: 900 }] }, live, byId(s1))).toBe(true);
    const param = { id: "ep_1", sceneId: "scn_1", objectId: "obj_0", property: "style.fill", label: "Color", type: "color" as const, defaultValue: "#fff" };
    expect(experienceDraftDiffers({ ...exp, editableParameters: [param] }, live, byId(s1))).toBe(true);
  });

  it("treats a missing scene as a change", () => {
    expect(experienceDraftDiffers(exp, live, new Map([["scn_1", null]]))).toBe(true);
  });
});

describe("buildExperienceReadiness", () => {
  it("reports blocking issues, next version, and only this artist's campaigns and release", () => {
    const exp = experience({ releaseId: "rel_1", scenes: [] });
    const campaigns = [
      { id: "c1", title: "Mine", slug: "mine", status: "active", experienceId: "exp_a", artistId: "art_a" },
      { id: "c2", title: "Other exp", slug: "o", status: "active", experienceId: "exp_b", artistId: "art_a" },
      { id: "c3", title: "Foreign", slug: "f", status: "active", experienceId: "exp_a", artistId: "art_b" },
    ] as Campaign[];
    const foreignRelease = { id: "rel_1", artistId: "art_b", title: "X", status: "released" } as Release;
    const r = buildExperienceReadiness({ experience: exp, scenesById: new Map(), versions: [], campaigns, release: foreignRelease });
    expect(r.ready).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("NO_SCENES");
    expect(r.nextVersion).toBe("1.0.0");
    expect(r.campaigns.map((c) => c.id)).toEqual(["c1"]);
    expect(r.release).toBeNull();
  });

  it("is ready for a valid draft and numbers the next version after existing ones", () => {
    const s1 = scene("scn_1");
    const exp = experience({ currentVersionId: "expv_2" });
    const versions = [versionOf(exp, [s1], "expv_1", 1), versionOf(exp, [s1], "expv_2", 2)];
    const r = buildExperienceReadiness({ experience: exp, scenesById: new Map([["scn_1", s1]]), versions, campaigns: [], release: null });
    expect(r.ready).toBe(true);
    expect(r.liveVersion?.version).toBe("2.0.0");
    expect(r.nextVersion).toBe("3.0.0");
    expect(r.hasUnpublishedChanges).toBe(false);
  });

  it("blocks scenes owned by another artist", () => {
    const foreign = scene("scn_1", "art_b");
    const r = buildExperienceReadiness({ experience: experience(), scenesById: new Map([["scn_1", foreign]]), versions: [], campaigns: [], release: null });
    expect(r.issues.map((i) => i.code)).toContain("SCENE_FOREIGN");
  });
});

describe("buildStudioFlow", () => {
  const artist = {
    id: "art_a",
    bio: "A band",
    branding: { logoUrl: null, logo: null, wordmark: null, fontFamily: null },
  } as unknown as Artist;
  const empty = { releases: [], scenes: [], experiences: [], campaigns: [], stage: { saved: false, publicVersion: null } };

  it("points a new artist at the first missing step", () => {
    const flow = buildStudioFlow({ artist: { ...artist, bio: "" }, ...empty });
    expect(flow.steps.map((s) => s.state)).toEqual(["in_progress", "todo", "todo", "todo", "todo"]);
    expect(flow.next?.key).toBe("identity");
    expect(flow.stage.state).toBe("not_set");
  });

  it("a bio completes identity; the brand kit is optional but reported", () => {
    const plain = buildStudioFlow({ artist, ...empty }).steps[0]!;
    expect(plain.state).toBe("done");
    expect(plain.summary).toMatch(/brand kit optional/);
    const branded = buildStudioFlow({ artist: { ...artist, branding: { ...artist.branding, fontFamily: "grotesk" } } as Artist, ...empty }).steps[0]!;
    expect(branded.summary).toBe("Profile and brand kit set");
  });

  it("links straight to the draft that needs work and ignores other artists' content", () => {
    const flow = buildStudioFlow({
      artist,
      ...empty,
      releases: [{ id: "rel_d", artistId: "art_a", status: "draft" } as Release, { id: "rel_x", artistId: "art_b", status: "released" } as Release],
    });
    const release = flow.steps.find((s) => s.key === "release")!;
    expect(release.state).toBe("in_progress");
    expect(release.href).toBe("/studio/releases/rel_d");
    expect(flow.next?.key).toBe("release");
  });

  it("is complete when everything is live; stage is reported but never gates the flow", () => {
    const flow = buildStudioFlow({
      artist,
      releases: [{ id: "r", artistId: "art_a", status: "released" } as Release],
      scenes: [scene("scn_1")],
      experiences: [experience({ currentVersionId: "v" })],
      campaigns: [{ id: "c", artistId: "art_a", status: "active" } as Campaign],
      stage: { saved: false, publicVersion: null },
    });
    expect(flow.steps.every((s) => s.state === "done")).toBe(true);
    expect(flow.next).toBeNull();
    expect(flow.stage.state).toBe("not_set");
  });

  it("an empty scene is not ready", () => {
    const flow = buildStudioFlow({ artist, ...empty, scenes: [scene("scn_e", "art_a", 0)] });
    const step = flow.steps.find((s) => s.key === "scene")!;
    expect(step.state).toBe("in_progress");
    expect(step.href).toBe("/studio/scenes/scn_e");
  });
});
