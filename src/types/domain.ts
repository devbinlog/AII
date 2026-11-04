/**
 * AII — Core Domain Types
 * Single source of truth for all entity shapes.
 * Production adapters and mock adapters must satisfy these interfaces.
 */

// ============================================================
// Primitives & Identifiers
// ============================================================

export type ID = string; // ULID or UUID

export type Timestamp = string; // ISO-8601

export type Locale = "ko" | "en";

export type ImageURL = string;

export type AudioURL = string;

export type HexColor = string; // e.g. "#e8192c"

export type Semver = string; // e.g. "1.0.0"

// ============================================================
// User & Auth
// ============================================================

export type UserRole =
  | "fan"
  | "artist_editor"
  | "artist_admin"
  | "platform_admin"
  | "platform_owner";

export interface User {
  id: ID;
  email: string;
  displayName: string;
  avatarUrl: ImageURL | null;
  role: UserRole;
  artistId: ID | null; // If artist_editor or artist_admin
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Session {
  userId: ID;
  role: UserRole;
  artistId: ID | null;
  expiresAt: Timestamp;
  isMock: boolean; // Must be false in production
}

// ============================================================
// Artist
// ============================================================

export type ArtistStatus = "active" | "inactive" | "pending_review";

export interface ArtistBranding {
  primaryColor: HexColor;
  secondaryColor: HexColor;
  accentColor: HexColor;
  backgroundColor: HexColor;
  logoUrl: ImageURL | null;
  coverImageUrl: ImageURL | null;
  fontFamily: string | null;
  motionPreset: "subtle" | "moderate" | "expressive";
}

export interface ArtistSocialLinks {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  spotify?: string;
  appleMusic?: string;
  website?: string;
}

export interface Artist {
  id: ID;
  slug: string; // URL-safe unique identifier, e.g. "freefallers"
  name: string;
  bio: string;
  genre: string[];
  branding: ArtistBranding;
  socialLinks: ArtistSocialLinks;
  status: ArtistStatus;
  isVerified: boolean;
  followerCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Release
// ============================================================

export type ReleaseType = "single" | "ep" | "album" | "compilation";

export type ReleaseStatus = "draft" | "scheduled" | "released" | "archived";

export interface Track {
  id: ID;
  releaseId: ID;
  position: number;
  title: string;
  durationMs: number;
  audioUrl: AudioURL | null;
  previewUrl: AudioURL | null; // 30-second clip
  isrc: string | null;
}

export interface Release {
  id: ID;
  artistId: ID;
  type: ReleaseType;
  title: string;
  description: string;
  coverImageUrl: ImageURL | null;
  tracks: Track[];
  releaseDate: string; // YYYY-MM-DD
  status: ReleaseStatus;
  label: string | null;
  upc: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Scene — Creative Engine Core
// ============================================================

export type SceneObjectType =
  | "text"
  | "image"
  | "shape"
  | "particle"
  | "waveform"
  | "group"
  | "object3d";

export type ShapeVariant =
  | "rectangle"
  | "circle"
  | "ellipse"
  | "triangle"
  | "line"
  | "polygon";

export interface SceneTransform {
  x: number; // scene coordinate units
  y: number;
  z: number; // layer depth
  width: number;
  height: number;
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;
  opacity: number; // 0-1
}

export interface SceneObjectStyle {
  fill: HexColor | null;
  stroke: HexColor | null;
  strokeWidth: number;
  fontSize: number | null;
  fontFamily: string | null;
  fontWeight: number | null;
  textAlign: "left" | "center" | "right" | null;
  borderRadius: number;
  blendMode: string;
}

export interface ParticleConfig {
  count: number;        // max 500
  size: number;
  speed: number;
  spread: number;
  color: HexColor;
  shape: "circle" | "square" | "star";
  lifetime: number;     // ms
  gravity: number;
}

export interface WaveformConfig {
  barCount: number;     // max 128
  barWidth: number;
  barGap: number;
  color: HexColor;
  style: "bars" | "wave" | "circular";
  mirror: boolean;
  smoothing: number;    // 0-1
}

export type SceneObjectData =
  | { type: "text"; content: string }
  | { type: "image"; assetId: ID; alt: string }
  | { type: "shape"; variant: ShapeVariant }
  | { type: "particle"; config: ParticleConfig }
  | { type: "waveform"; config: WaveformConfig }
  | { type: "group"; childIds: ID[] }
  | { type: "object3d"; assetId: ID; modelFormat: "glb" | "gltf" };

export interface SceneObject {
  id: ID;
  name: string;
  transform: SceneTransform;
  style: SceneObjectStyle;
  data: SceneObjectData;
  visible: boolean;
  locked: boolean;
  parentId: ID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Interaction Engine — DSL
// ============================================================

export type InteractionInput =
  | "audio_frequency"
  | "audio_bass"
  | "audio_mid"
  | "audio_treble"
  | "audio_volume"
  | "pointer_move_x"
  | "pointer_move_y"
  | "pointer_click"
  | "pointer_drag_x"
  | "pointer_drag_y"
  | "scroll_y"
  | "timeline_trigger";

export type InteractionOutput =
  | "position_x"
  | "position_y"
  | "scale_x"
  | "scale_y"
  | "rotation"
  | "opacity"
  | "color_hue"
  | "color_brightness"
  | "visibility"
  | "particle_count"
  | "particle_speed"
  | "scene_transition";

export interface InteractionMapping {
  id: ID;
  objectId: ID;
  input: InteractionInput;
  output: InteractionOutput;
  // Linear mapping: output = clamp(inputMin→outputMin, inputMax→outputMax)
  inputMin: number;
  inputMax: number;
  outputMin: number;
  outputMax: number;
  easing: "linear" | "ease_in" | "ease_out" | "ease_in_out";
  smoothing: number; // 0-1, lerp factor
}

// ============================================================
// Scene Schema (versioned, immutable when published)
// ============================================================

export const SCENE_SCHEMA_VERSION = "1.0.0" as const;

export interface SceneSchema {
  version: Semver;
  sceneId: ID;
  objects: SceneObject[];
  interactions: InteractionMapping[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: HexColor;
  audioTrackId: ID | null;
  duration: number | null; // ms, null = infinite
}

export interface Scene {
  id: ID;
  artistId: ID;
  experienceId: ID | null;
  name: string;
  description: string;
  thumbnailUrl: ImageURL | null;
  schema: SceneSchema;
  status: "draft" | "published";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Experience
// ============================================================

export type ExperienceStatus =
  | "draft"
  | "preview"
  | "published"
  | "archived";

export interface ExperienceScene {
  sceneId: ID;
  order: number;
  transitionType: "cut" | "fade" | "slide" | "custom";
  transitionDuration: number; // ms
}

export interface ExperienceVersion {
  id: ID;
  experienceId: ID;
  version: Semver;
  schemaVersions: Record<ID, Semver>; // sceneId → scene schema version
  snapshot: {
    scenes: ExperienceScene[];
    sceneSchemas: Record<ID, SceneSchema>; // sceneId → frozen schema
  };
  rendererVersion: Semver;
  publishedAt: Timestamp;
  publishedBy: ID;
}

export type EditableParameterType = "color" | "number" | "text" | "select";

export interface EditableParameter {
  id: ID;
  sceneId: ID;
  objectId: ID;
  property: string; // e.g. "style.fill", "transform.opacity", "data.content"
  label: string;
  type: EditableParameterType;
  defaultValue: unknown;
  min?: number;
  max?: number;
  options?: string[]; // for type "select"
}

export interface Experience {
  id: ID;
  artistId: ID;
  releaseId: ID | null;
  title: string;
  description: string;
  coverImageUrl: ImageURL | null;
  scenes: ExperienceScene[];
  editableParameters: EditableParameter[]; // Fan-editable fields
  status: ExperienceStatus;
  currentVersionId: ID | null;
  totalPlayCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Campaign
// ============================================================

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "ended"
  | "archived";

export type ArtworkPermission =
  | "public"   // visible to everyone
  | "unlisted" // accessible via link only
  | "private"; // visible only to creator

export interface CampaignParticipationPolicy {
  requireLogin: boolean;
  allowAnonymousCreate: boolean;   // Can create without login, save requires login
  maxArtworksPerUser: number;      // 0 = unlimited
  moderationEnabled: boolean;
  autoPublishArtworks: boolean;
  defaultArtworkPermission: ArtworkPermission;
}

export interface CampaignBranding {
  primaryColor: HexColor;
  backgroundColor: HexColor;
  backgroundImageUrl: ImageURL | null;
  logoUrl: ImageURL | null;
  tagline: string | null;
}

export interface Campaign {
  id: ID;
  slug: string; // URL-safe unique identifier, e.g. "moonwave-fan-artwork"
  artistId: ID;
  experienceId: ID;
  title: string;
  description: string;
  branding: CampaignBranding;
  participationPolicy: CampaignParticipationPolicy;
  status: CampaignStatus;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  artworkCount: number;
  participantCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Fan Artifact (Artwork)
// ============================================================

export type ArtworkStatus =
  | "draft"
  | "saved"
  | "published"
  | "flagged"
  | "removed";

export interface ArtworkCustomization {
  // Serialized state of fan's modifications within allowed parameters.
  // Tied to a specific ExperienceVersion — never freeform JS.
  // editableParameters in Experience defines the allowed keys.
  versionId: ID;
  editableParameters: Record<ID, unknown>; // paramId → value (from Experience.editableParameters)
  sceneStates: Record<ID, Record<string, unknown>>; // sceneId → derived overrides (computed)
  captureFrameMs: number; // Which frame to export as image
  deterministicSeed: number; // For reproducible export
}

export type ModerationStatus = "pending" | "approved" | "flagged" | "removed";

export interface FanArtwork {
  id: ID;
  campaignId: ID;
  experienceVersionId: ID;
  creatorId: ID | null; // null = anonymous (pending login association)
  sessionToken: string | null; // For anonymous recovery
  title: string;
  imageUrl: ImageURL | null; // Exported PNG URL
  customization: ArtworkCustomization;
  permission: ArtworkPermission;
  status: ArtworkStatus;
  moderationStatus: ModerationStatus;
  likeCount: number;
  shareCount: number;
  likedBy: ID[]; // user IDs (in-memory only, not persisted in prod)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Media Asset
// ============================================================

export type AssetType =
  | "image"
  | "audio"
  | "video"
  | "font"
  | "model3d"
  | "other";

export interface MediaAsset {
  id: ID;
  artistId: ID;
  type: AssetType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  thumbnailUrl: ImageURL | null;
  altText: string | null;
  tags: string[];
  usedIn: { sceneId?: ID; releaseId?: ID }[];
  uploadedBy: ID;
  createdAt: Timestamp;
}

// ============================================================
// Analytics
// ============================================================

export interface CampaignAnalyticsSummary {
  campaignId: ID;
  period: { from: Timestamp; to: Timestamp };
  totalParticipants: number;
  uniqueVisitors: number;
  artworksCreated: number;
  artworksPublished: number;
  shareCount: number;
  avgTimeOnExperienceMs: number;
  topReferrers: Array<{ source: string; count: number }>;
  deviceBreakdown: Record<string, number>;
  participationByDay: Array<{ date: string; count: number }>;
}

// ============================================================
// Audit Log
// ============================================================

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.role_changed"
  | "artist.created"
  | "artist.updated"
  | "release.published"
  | "campaign.started"
  | "campaign.ended"
  | "experience.published"
  | "artwork.flagged"
  | "artwork.removed"
  | "owner.operation"
  | "security.event";

export interface AuditLogEntry {
  id: ID;
  actorId: ID | null;
  action: AuditAction;
  resourceType: string;
  resourceId: ID | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Timestamp;
}
