// Versioned (de)serialization with validation.

import { z } from "zod";
import type { StageLayout } from "./types";

const finite = z.number().finite();
const vec3 = z.tuple([finite, finite, finite]);

export const StageItemZod = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["performer", "guitar", "bass", "keyboard", "mic", "amplifier", "drums"]),
  label: z.string().trim().min(1).max(40),
  position: vec3,
  rotationY: finite,
  locked: z.boolean(),
});

export const StageLayoutZod = z.object({
  version: z.literal(1),
  artistId: z.string().min(1).max(128),
  items: z.array(StageItemZod).min(1).max(40),
  updatedAt: z.string(),
  backlineVersion: z.union([z.literal(1), z.literal(2)]).optional(),
});

export function parseStageLayout(data: unknown): { ok: true; layout: StageLayout } | { ok: false; error: string } {
  const r = StageLayoutZod.safeParse(data);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  // Keep the key absent (not undefined) on unversioned layouts so round-trips are lossless.
  const { backlineVersion, ...rest } = r.data;
  return { ok: true, layout: backlineVersion ? { ...rest, backlineVersion } : rest };
}

export function serializeStageLayout(layout: StageLayout): string {
  return JSON.stringify(layout);
}
