/**
 * AII Creative Engine — Scene Schema Zod Validation
 * Security-focused validation with allowlisted enums and hard limits.
 */

import { z } from "zod";
import type { SceneSchema, SceneTransform, SceneObject, InteractionMapping } from "@/types/domain";
import { SCENE_SCHEMA_VERSION } from "@/types/domain";

// ============================================================
// Primitive helpers
// ============================================================

const HexColorZod = z.string().regex(/^#[0-9A-Fa-f]{3,8}$/, "Must be a valid hex color");

const IDZod = z.string().min(1).max(128);

const TimestampZod = z.string().min(1);

// ============================================================
// SceneTransform
// ============================================================

export const SceneTransformZod: z.ZodType<SceneTransform> = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  width: z.number().finite().min(0),
  height: z.number().finite().min(0),
  rotation: z.number().finite(),
  scaleX: z.number().finite(),
  scaleY: z.number().finite(),
  opacity: z.number().min(0).max(1),
});

// ============================================================
// SceneObjectStyle — blend modes restricted to valid Canvas2D ops
// ============================================================

const VALID_BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "source-over",
] as const;

const SceneObjectStyleZod = z.object({
  fill: z.union([HexColorZod, z.null()]),
  stroke: z.union([HexColorZod, z.null()]),
  strokeWidth: z.number().min(0).finite(),
  fontSize: z.union([z.number().positive().finite(), z.null()]),
  fontFamily: z.union([z.string().min(1).max(128), z.null()]),
  fontWeight: z.union([z.number().int().min(100).max(900), z.null()]),
  textAlign: z.union([z.enum(["left", "center", "right"]), z.null()]),
  borderRadius: z.number().min(0).finite(),
  blendMode: z.enum(VALID_BLEND_MODES),
});

// ============================================================
// ParticleConfig — max 500 particles
// ============================================================

const ParticleConfigZod = z.object({
  count: z.number().int().min(0).max(500),
  size: z.number().positive().finite(),
  speed: z.number().finite(),
  spread: z.number().finite(),
  color: HexColorZod,
  shape: z.enum(["circle", "square", "star"]),
  lifetime: z.number().positive().finite(),
  gravity: z.number().finite(),
});

// ============================================================
// WaveformConfig — max 128 bars
// ============================================================

const WaveformConfigZod = z.object({
  barCount: z.number().int().min(0).max(128),
  barWidth: z.number().positive().finite(),
  barGap: z.number().min(0).finite(),
  color: HexColorZod,
  style: z.enum(["bars", "wave", "circular"]),
  mirror: z.boolean(),
  smoothing: z.number().min(0).max(1),
});

// ============================================================
// SceneObjectData — discriminated union
// ============================================================

const SceneObjectDataZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string().max(10000) }),
  z.object({ type: z.literal("image"), assetId: IDZod, alt: z.string().max(512) }),
  z.object({
    type: z.literal("shape"),
    variant: z.enum(["rectangle", "circle", "ellipse", "triangle", "line", "polygon"]),
  }),
  z.object({ type: z.literal("particle"), config: ParticleConfigZod }),
  z.object({ type: z.literal("waveform"), config: WaveformConfigZod }),
  z.object({ type: z.literal("group"), childIds: z.array(IDZod).max(200) }),
  z.object({
    type: z.literal("object3d"),
    assetId: IDZod,
    modelFormat: z.enum(["glb", "gltf"]),
  }),
]);

// ============================================================
// SceneObject
// ============================================================

export const SceneObjectZod: z.ZodType<SceneObject> = z.object({
  id: IDZod,
  name: z.string().min(1).max(256),
  transform: SceneTransformZod,
  style: SceneObjectStyleZod,
  data: SceneObjectDataZod,
  visible: z.boolean(),
  locked: z.boolean(),
  parentId: z.union([IDZod, z.null()]),
  createdAt: TimestampZod,
  updatedAt: TimestampZod,
});

// ============================================================
// InteractionMapping
// ============================================================

export const InteractionMappingZod: z.ZodType<InteractionMapping> = z.object({
  id: IDZod,
  objectId: IDZod,
  input: z.enum([
    "audio_frequency",
    "audio_bass",
    "audio_mid",
    "audio_treble",
    "audio_volume",
    "pointer_move_x",
    "pointer_move_y",
    "pointer_click",
    "pointer_drag_x",
    "pointer_drag_y",
    "scroll_y",
    "timeline_trigger",
  ]),
  output: z.enum([
    "position_x",
    "position_y",
    "scale_x",
    "scale_y",
    "rotation",
    "opacity",
    "color_hue",
    "color_brightness",
    "visibility",
    "particle_count",
    "particle_speed",
    "scene_transition",
  ]),
  inputMin: z.number().finite(),
  inputMax: z.number().finite(),
  outputMin: z.number().finite(),
  outputMax: z.number().finite(),
  easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out"]),
  smoothing: z.number().min(0).max(1),
});

// ============================================================
// SceneSchema — top-level validated document
// ============================================================

export const SceneSchemaZod: z.ZodType<SceneSchema> = z.object({
  version: z.literal(SCENE_SCHEMA_VERSION),
  sceneId: IDZod,
  objects: z.array(SceneObjectZod).max(200),
  interactions: z.array(InteractionMappingZod).max(500),
  canvasWidth: z.number().positive().finite().int(),
  canvasHeight: z.number().positive().finite().int(),
  backgroundColor: HexColorZod,
  audioTrackId: z.union([IDZod, z.null()]),
  duration: z.union([z.number().positive().finite(), z.null()]),
});

// ============================================================
// Validation helper
// ============================================================

export function validateSceneSchema(
  data: unknown,
): { success: true; data: SceneSchema } | { success: false; error: string; details: unknown } {
  const result = SceneSchemaZod.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: "Scene schema validation failed",
    details: result.error.issues,
  };
}
