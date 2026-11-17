// Pure helpers for editing a SceneSchema in Artist Studio.

import type { InteractionMapping, SceneObject, SceneSchema } from "@/types";

export type NewObjectKind = "text" | "rectangle" | "circle" | "waveform" | "particle" | "image";

export const OBJECT_KIND_LABELS: Record<NewObjectKind, string> = {
  text: "Text",
  rectangle: "Rectangle",
  circle: "Circle",
  waveform: "Waveform",
  particle: "Particles",
  image: "Image",
};

let counter = 0;
export function newObjectId(prefix = "obj"): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

const baseStyle: SceneObject["style"] = {
  fill: "#f5f5f0",
  stroke: null,
  strokeWidth: 0,
  fontSize: null,
  fontFamily: null,
  fontWeight: null,
  textAlign: null,
  borderRadius: 0,
  blendMode: "normal",
};

export function createSceneObject(
  kind: NewObjectKind,
  schema: Pick<SceneSchema, "canvasWidth" | "canvasHeight" | "objects">,
  options: { id?: string; assetId?: string; accent?: string; now?: string } = {}
): SceneObject {
  const now = options.now ?? new Date().toISOString();
  const accent = options.accent ?? "#e8192c";
  const cx = Math.round(schema.canvasWidth / 2);
  const cy = Math.round(schema.canvasHeight / 2);
  const z = schema.objects.reduce((max, o) => Math.max(max, o.transform.z), -1) + 1;
  const base = {
    id: options.id ?? newObjectId(),
    visible: true,
    locked: false,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
  const transform = (width: number, height: number, x = cx, y = cy) => ({ x, y, z, width, height, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });

  switch (kind) {
    case "text":
      return {
        ...base,
        name: "Text",
        transform: transform(800, 120, Math.round(schema.canvasWidth * 0.1), Math.round(schema.canvasHeight * 0.1)),
        style: { ...baseStyle, fontSize: 72, fontWeight: 800, textAlign: "left" },
        data: { type: "text", content: "Your title" },
      };
    case "rectangle":
      return { ...base, name: "Rectangle", transform: transform(400, 240), style: { ...baseStyle, fill: accent }, data: { type: "shape", variant: "rectangle" } };
    case "circle":
      return { ...base, name: "Circle", transform: transform(300, 300), style: { ...baseStyle, fill: accent }, data: { type: "shape", variant: "circle" } };
    case "waveform":
      return {
        ...base,
        name: "Waveform",
        transform: transform(Math.round(schema.canvasWidth * 0.6), 200),
        style: { ...baseStyle, fill: accent },
        data: { type: "waveform", config: { barCount: 64, barWidth: 4, barGap: 2, color: accent, style: "bars", mirror: true, smoothing: 0.8 } },
      };
    case "particle":
      return {
        ...base,
        name: "Particles",
        transform: transform(schema.canvasWidth, schema.canvasHeight),
        style: { ...baseStyle, fill: accent },
        data: { type: "particle", config: { count: 120, size: 4, speed: 1, spread: 1, color: accent, shape: "circle", lifetime: 3000, gravity: 0 } },
      };
    case "image":
      return {
        ...base,
        name: "Image",
        transform: transform(480, 480),
        style: baseStyle,
        data: { type: "image", assetId: options.assetId ?? "", alt: "" },
      };
  }
}

/** Removes an object and everything that references it (interactions, group membership, children's parent link). */
export function removeSceneObject(schema: SceneSchema, objectId: string): SceneSchema {
  return {
    ...schema,
    objects: schema.objects
      .filter((o) => o.id !== objectId)
      .map((o) => {
        let next = o;
        if (o.parentId === objectId) next = { ...next, parentId: null };
        if (o.data.type === "group" && o.data.childIds.includes(objectId)) {
          next = { ...next, data: { type: "group", childIds: o.data.childIds.filter((c) => c !== objectId) } };
        }
        return next;
      }),
    interactions: schema.interactions.filter((m) => m.objectId !== objectId),
  };
}

export function duplicateSceneObject(schema: SceneSchema, objectId: string, newId = newObjectId()): SceneSchema {
  const source = schema.objects.find((o) => o.id === objectId);
  if (!source) return schema;
  const copy: SceneObject = {
    ...structuredClone(source),
    id: newId,
    name: `${source.name} copy`,
    transform: { ...source.transform, x: source.transform.x + 40, y: source.transform.y + 40, z: source.transform.z + 1 },
  };
  const copiedInteractions: InteractionMapping[] = schema.interactions
    .filter((m) => m.objectId === objectId)
    .map((m) => ({ ...m, id: newObjectId("int"), objectId: newId }));
  return { ...schema, objects: [...schema.objects, copy], interactions: [...schema.interactions, ...copiedInteractions] };
}

/** Move an object one step in paint order (z). */
export function reorderSceneObject(schema: SceneSchema, objectId: string, direction: "up" | "down"): SceneSchema {
  const sorted = [...schema.objects].sort((a, b) => a.transform.z - b.transform.z);
  const idx = sorted.findIndex((o) => o.id === objectId);
  const swap = direction === "up" ? idx + 1 : idx - 1;
  if (idx === -1 || swap < 0 || swap >= sorted.length) return schema;
  [sorted[idx], sorted[swap]] = [sorted[swap]!, sorted[idx]!];
  const zById = new Map(sorted.map((o, i) => [o.id, i]));
  return { ...schema, objects: schema.objects.map((o) => ({ ...o, transform: { ...o.transform, z: zById.get(o.id) ?? o.transform.z } })) };
}

export function createInteraction(objectId: string): InteractionMapping {
  return {
    id: newObjectId("int"),
    objectId,
    input: "audio_bass",
    output: "scale_y",
    inputMin: 0,
    inputMax: 1,
    outputMin: 1,
    outputMax: 1.5,
    easing: "ease_out",
    smoothing: 0.6,
  };
}
