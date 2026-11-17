import { describe, it, expect } from "vitest";
import { validateSceneSchema } from "@/lib/engine/schema";
import { findBrokenReferences } from "../publish";
import {
  createInteraction,
  createSceneObject,
  duplicateSceneObject,
  removeSceneObject,
  reorderSceneObject,
  type NewObjectKind,
} from "../scene-objects";
import type { SceneSchema } from "@/types";

const empty: SceneSchema = {
  version: "1.0.0",
  sceneId: "scn_t",
  objects: [],
  interactions: [],
  canvasWidth: 1920,
  canvasHeight: 1080,
  backgroundColor: "#0a0a0a",
  audioTrackId: null,
  duration: null,
};

describe("scene object helpers", () => {
  it("every new object kind produces a schema that passes the WS-04 DSL", () => {
    const kinds: NewObjectKind[] = ["text", "rectangle", "circle", "waveform", "particle", "image"];
    let schema = empty;
    for (const kind of kinds) {
      schema = { ...schema, objects: [...schema.objects, createSceneObject(kind, schema, { assetId: "ast_1" })] };
    }
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(true);
    // stacked on top of each other
    expect(schema.objects.map((o) => o.transform.z)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("removing an object also removes its interactions (no dangling references)", () => {
    const a = createSceneObject("text", empty, { id: "a" });
    const b = createSceneObject("circle", { ...empty, objects: [a] }, { id: "b" });
    const schema: SceneSchema = { ...empty, objects: [a, b], interactions: [createInteraction("a"), createInteraction("b")] };
    const next = removeSceneObject(schema, "a");
    expect(next.objects.map((o) => o.id)).toEqual(["b"]);
    expect(next.interactions.every((m) => m.objectId === "b")).toBe(true);
    expect(findBrokenReferences(next)).toEqual([]);
  });

  it("duplicating copies interactions to the new object", () => {
    const a = createSceneObject("waveform", empty, { id: "a" });
    const schema: SceneSchema = { ...empty, objects: [a], interactions: [createInteraction("a")] };
    const next = duplicateSceneObject(schema, "a", "a2");
    expect(next.objects).toHaveLength(2);
    expect(next.interactions.filter((m) => m.objectId === "a2")).toHaveLength(1);
    expect(findBrokenReferences(next)).toEqual([]);
  });

  it("reorder swaps paint order and stays in bounds", () => {
    const a = createSceneObject("text", empty, { id: "a" });
    const b = createSceneObject("circle", { ...empty, objects: [a] }, { id: "b" });
    const schema: SceneSchema = { ...empty, objects: [a, b] };
    const up = reorderSceneObject(schema, "a", "up");
    expect(up.objects.find((o) => o.id === "a")!.transform.z).toBeGreaterThan(up.objects.find((o) => o.id === "b")!.transform.z);
    expect(reorderSceneObject(schema, "b", "up")).toBe(schema);
  });
});
