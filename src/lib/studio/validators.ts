// Zod validators for Artist Studio API input. Unknown keys are stripped,
// so clients cannot set server-owned fields (ids, artistId, status, counters).

import { z } from "zod";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a #RRGGBB color");
const url = z.string().trim().max(500).refine((v) => v === "" || /^https:\/\//.test(v), "Must be an https:// URL");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Must be an ISO date-time");
const title = z.string().trim().min(1).max(120);
const description = z.string().trim().max(2000);

export const UpdateArtistSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    bio: z.string().trim().max(2000),
    genre: z.array(z.string().trim().min(1).max(30)).max(8),
    branding: z
      .object({
        primaryColor: hex,
        secondaryColor: hex,
        accentColor: hex,
        backgroundColor: hex,
        motionPreset: z.enum(["subtle", "moderate", "expressive"]),
      })
      .partial(),
    socialLinks: z
      .object({
        instagram: url,
        twitter: url,
        youtube: url,
        spotify: url,
        appleMusic: url,
        website: url,
      })
      .partial(),
  })
  .partial();

export const CreateReleaseSchema = z.object({
  type: z.enum(["single", "ep", "album", "compilation"]),
  title,
  description: description.default(""),
  releaseDate: isoDate,
});

export const UpdateReleaseSchema = z
  .object({
    title,
    description,
    releaseDate: isoDate,
    type: z.enum(["single", "ep", "album", "compilation"]),
    label: z.string().trim().max(120).nullable(),
    tracks: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(120),
          durationMs: z.number().int().min(0).max(60 * 60 * 1000),
        })
      )
      .max(50),
  })
  .partial();

// Mock upload: metadata only, plus an optional small inline image preview.
// No file is stored anywhere outside process memory.
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
export const MEDIA_PREVIEW_MAX_CHARS = 700_000; // ~512 KB image as data URL
export const MEDIA_MIME_TYPES = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  audio: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac"],
  video: ["video/mp4", "video/webm"],
  font: ["font/woff2", "font/woff", "font/ttf", "font/otf"],
  model3d: ["model/gltf-binary", "model/gltf+json"],
} as const;
const allMimes = Object.values(MEDIA_MIME_TYPES).flat() as string[];

export const CreateMediaSchema = z
  .object({
    type: z.enum(["image", "audio", "video", "font", "model3d"]),
    filename: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((v) => !/[\\/]|\.\./.test(v), "Filename must not contain path separators"),
    mimeType: z.string().refine((v) => allMimes.includes(v), "Unsupported file type"),
    sizeBytes: z.number().int().positive().max(MEDIA_MAX_BYTES),
    altText: z.string().trim().max(300).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    previewDataUrl: z
      .string()
      .max(MEDIA_PREVIEW_MAX_CHARS)
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/, "Preview must be a base64 image data URL")
      .optional(),
  })
  .refine((v) => (MEDIA_MIME_TYPES[v.type] as readonly string[]).includes(v.mimeType), {
    message: "mimeType does not match type",
    path: ["mimeType"],
  })
  .refine((v) => v.previewDataUrl === undefined || v.type === "image", {
    message: "Only images can include a preview",
    path: ["previewDataUrl"],
  });

export const CreateSceneSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: description.optional(),
  canvasWidth: z.number().int().min(320).max(3840).default(1920),
  canvasHeight: z.number().int().min(240).max(2160).default(1080),
});

export const UpdateSceneMetaSchema = z
  .object({ name: z.string().trim().min(1).max(120), description })
  .partial();

const editableParameter = z.object({
  id: z.string().min(1).max(64),
  sceneId: z.string().min(1).max(128),
  objectId: z.string().min(1).max(128),
  property: z.enum(["style.fill", "style.stroke", "transform.opacity", "transform.rotation", "data.content"]),
  label: z.string().trim().min(1).max(60),
  type: z.enum(["color", "number", "text", "select"]),
  defaultValue: z.union([z.string().max(500), z.number(), z.boolean()]),
  min: z.number().optional(),
  max: z.number().optional(),
  options: z.array(z.string().max(60)).max(20).optional(),
});

export const CreateExperienceSchema = z.object({
  title,
  description: description.default(""),
  releaseId: z.string().min(1).max(128).optional(),
});

export const UpdateExperienceSchema = z
  .object({
    title,
    description,
    releaseId: z.string().min(1).max(128).nullable(),
    scenes: z
      .array(
        z.object({
          sceneId: z.string().min(1).max(128),
          order: z.number().int().min(0),
          transitionType: z.enum(["cut", "fade", "slide"]),
          transitionDuration: z.number().int().min(0).max(5000),
        })
      )
      .max(20),
    editableParameters: z.array(editableParameter).max(30),
  })
  .partial();

const policy = z.object({
  requireLogin: z.boolean(),
  allowAnonymousCreate: z.boolean(),
  maxArtworksPerUser: z.number().int().min(0).max(100),
  moderationEnabled: z.boolean(),
  autoPublishArtworks: z.boolean(),
  defaultArtworkPermission: z.enum(["public", "unlisted", "private"]),
});

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

export const CreateCampaignSchema = z.object({
  title,
  slug: slugSchema,
  description: description.default(""),
  experienceId: z.string().min(1).max(128),
  participationPolicy: policy.default({
    requireLogin: false,
    allowAnonymousCreate: true,
    maxArtworksPerUser: 0,
    moderationEnabled: true,
    autoPublishArtworks: false,
    defaultArtworkPermission: "public",
  }),
  startsAt: isoDateTime.nullable().optional(),
  endsAt: isoDateTime.nullable().optional(),
});

export const UpdateCampaignSchema = z
  .object({
    title,
    description,
    experienceId: z.string().min(1).max(128),
    branding: z
      .object({ primaryColor: hex, backgroundColor: hex, tagline: z.string().trim().max(120).nullable() })
      .partial(),
    participationPolicy: policy.partial(),
    startsAt: isoDateTime.nullable(),
    endsAt: isoDateTime.nullable(),
  })
  .partial();

export function formatZodError(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

export type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/** Drops keys whose value is undefined (zod partial output → exactOptionalPropertyTypes). */
export function defined<T extends object>(value: T): Defined<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Defined<T>;
}
