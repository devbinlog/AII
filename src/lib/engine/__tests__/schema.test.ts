/**
 * Schema validation tests.
 * NOTE: These tests depend on schema.ts which exists in this worktree.
 */

import { describe, it, expect } from "vitest";
import { validateSceneSchema } from "@/lib/engine/schema";
import { SCENE_SCHEMA_VERSION } from "@/types/domain";
import type { SceneSchema } from "@/types/domain";

// ============================================================
// Helpers
// ============================================================

function makeMinimalSchema(): SceneSchema {
  return {
    version: SCENE_SCHEMA_VERSION,
    sceneId: "test-scene-001",
    objects: [],
    interactions: [],
    canvasWidth: 1920,
    canvasHeight: 1080,
    backgroundColor: "#0a0a0a",
    audioTrackId: null,
    duration: null,
  };
}

// ============================================================
// Tests
// ============================================================

describe("validateSceneSchema", () => {
  it("accepts a valid minimal schema (no objects, no interactions)", () => {
    const result = validateSceneSchema(makeMinimalSchema());
    expect(result.success).toBe(true);
  });

  it("accepts a valid schema with a text object", () => {
    const schema = makeMinimalSchema();
    schema.objects = [
      {
        id: "obj_txt_001",
        name: "Title",
        transform: {
          x: 0, y: 0, z: 0,
          width: 400, height: 100,
          rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        },
        style: {
          fill: "#ffffff",
          stroke: null,
          strokeWidth: 0,
          fontSize: 48,
          fontFamily: null,
          fontWeight: 700,
          textAlign: "left",
          borderRadius: 0,
          blendMode: "normal",
        },
        data: { type: "text", content: "Hello AII" },
        visible: true,
        locked: false,
        parentId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(true);
  });

  it("accepts a valid schema with a particle object", () => {
    const schema = makeMinimalSchema();
    schema.objects = [
      {
        id: "obj_pt_001",
        name: "Particles",
        transform: {
          x: 960, y: 540, z: 0,
          width: 100, height: 100,
          rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        },
        style: {
          fill: "#e8192c",
          stroke: null,
          strokeWidth: 0,
          fontSize: null,
          fontFamily: null,
          fontWeight: null,
          textAlign: null,
          borderRadius: 0,
          blendMode: "screen",
        },
        data: {
          type: "particle",
          config: {
            count: 100,
            size: 3,
            speed: 5,
            spread: 360,
            color: "#e8192c",
            shape: "circle",
            lifetime: 1000,
            gravity: 0.1,
          },
        },
        visible: true,
        locked: false,
        parentId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(true);
  });

  it("accepts a valid schema with a waveform object", () => {
    const schema = makeMinimalSchema();
    schema.objects = [
      {
        id: "obj_wf_001",
        name: "Waveform",
        transform: {
          x: 960, y: 540, z: 0,
          width: 1200, height: 200,
          rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        },
        style: {
          fill: "#e8192c",
          stroke: null,
          strokeWidth: 0,
          fontSize: null,
          fontFamily: null,
          fontWeight: null,
          textAlign: null,
          borderRadius: 0,
          blendMode: "normal",
        },
        data: {
          type: "waveform",
          config: {
            barCount: 64,
            barWidth: 4,
            barGap: 2,
            color: "#e8192c",
            style: "bars",
            mirror: true,
            smoothing: 0.8,
          },
        },
        visible: true,
        locked: false,
        parentId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(true);
  });

  it("rejects schema missing required fields (no version)", () => {
    const { version: _version, ...noVersion } = makeMinimalSchema();
    const result = validateSceneSchema(noVersion);
    expect(result.success).toBe(false);
  });

  it("rejects schema missing sceneId", () => {
    const { sceneId: _id, ...noId } = makeMinimalSchema();
    const result = validateSceneSchema(noId);
    expect(result.success).toBe(false);
  });

  it("rejects ParticleConfig with count > 500", () => {
    const schema = makeMinimalSchema();
    schema.objects = [
      {
        id: "obj_pt_001",
        name: "Too many",
        transform: {
          x: 0, y: 0, z: 0,
          width: 10, height: 10,
          rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        },
        style: {
          fill: null, stroke: null, strokeWidth: 0,
          fontSize: null, fontFamily: null, fontWeight: null,
          textAlign: null, borderRadius: 0, blendMode: "normal",
        },
        data: {
          type: "particle",
          config: {
            count: 501, // invalid
            size: 2, speed: 1, spread: 360,
            color: "#ffffff", shape: "circle",
            lifetime: 1000, gravity: 0,
          },
        },
        visible: true, locked: false, parentId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(false);
  });

  it("rejects WaveformConfig with barCount > 128", () => {
    const schema = makeMinimalSchema();
    schema.objects = [
      {
        id: "obj_wf_001",
        name: "Too many bars",
        transform: {
          x: 0, y: 0, z: 0,
          width: 100, height: 100,
          rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        },
        style: {
          fill: null, stroke: null, strokeWidth: 0,
          fontSize: null, fontFamily: null, fontWeight: null,
          textAlign: null, borderRadius: 0, blendMode: "normal",
        },
        data: {
          type: "waveform",
          config: {
            barCount: 129, // invalid
            barWidth: 4, barGap: 2,
            color: "#ffffff", style: "bars",
            mirror: false, smoothing: 0.5,
          },
        },
        visible: true, locked: false, parentId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(false);
  });

  it("rejects unknown blendMode", () => {
    const schema = makeMinimalSchema();
    schema.objects = [
      {
        id: "obj_001",
        name: "Bad blend",
        transform: {
          x: 0, y: 0, z: 0,
          width: 10, height: 10,
          rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        },
        style: {
          fill: null, stroke: null, strokeWidth: 0,
          fontSize: null, fontFamily: null, fontWeight: null,
          textAlign: null, borderRadius: 0,
          blendMode: "not-a-real-blend-mode", // invalid
        },
        data: { type: "text", content: "test" },
        visible: true, locked: false, parentId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(false);
  });

  it("rejects unknown object type", () => {
    const schema = makeMinimalSchema();
    schema.objects = [
      {
        id: "obj_001",
        name: "Unknown type",
        transform: {
          x: 0, y: 0, z: 0,
          width: 10, height: 10,
          rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        },
        style: {
          fill: null, stroke: null, strokeWidth: 0,
          fontSize: null, fontFamily: null, fontWeight: null,
          textAlign: null, borderRadius: 0, blendMode: "normal",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { type: "video" } as any,
        visible: true, locked: false, parentId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(false);
  });

  it("rejects unknown interaction input", () => {
    const schema = makeMinimalSchema();
    schema.interactions = [
      {
        id: "int_001",
        objectId: "obj_001",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input: "gyroscope" as any,
        output: "rotation",
        inputMin: 0, inputMax: 1,
        outputMin: 0, outputMax: 360,
        easing: "linear",
        smoothing: 0,
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(false);
  });

  it("rejects unknown interaction output", () => {
    const schema = makeMinimalSchema();
    schema.interactions = [
      {
        id: "int_001",
        objectId: "obj_001",
        input: "audio_bass",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output: "volume" as any,
        inputMin: 0, inputMax: 1,
        outputMin: 0, outputMax: 1,
        easing: "linear",
        smoothing: 0,
      },
    ];
    const result = validateSceneSchema(schema);
    expect(result.success).toBe(false);
  });

  it("round-trips: validated data matches input", () => {
    const input = makeMinimalSchema();
    const result = validateSceneSchema(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sceneId).toBe(input.sceneId);
      expect(result.data.version).toBe(input.version);
      expect(result.data.canvasWidth).toBe(input.canvasWidth);
    }
  });

  it("returns error details on failure", () => {
    const result = validateSceneSchema({ not: "a schema" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(result.details).toBeDefined();
    }
  });
});
