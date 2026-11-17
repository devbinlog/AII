/**
 * AII — API Request/Response Schemas
 * All API endpoints share these shapes.
 * Zod schemas for validation live in src/lib/validators/
 */

import type {
  Artist,
  Campaign,
  FanArtwork,
  MediaAsset,
  Release,
  Scene,
  User,
} from "./domain";

// ============================================================
// Common Wrappers
// ============================================================

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

// ============================================================
// Auth
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  sessionToken: string;
  expiresAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

// ============================================================
// Artist
// ============================================================

export interface CreateArtistRequest {
  slug: string;
  name: string;
  bio: string;
  genre: string[];
}

export interface UpdateArtistRequest {
  name?: string;
  bio?: string;
  genre?: string[];
  branding?: Partial<Artist["branding"]>;
  socialLinks?: Partial<Artist["socialLinks"]>;
}

export interface ArtistListQuery extends PaginationQuery {
  status?: Artist["status"];
  genre?: string;
  search?: string;
}

// ============================================================
// Release
// ============================================================

export interface CreateReleaseRequest {
  artistId: string;
  type: Release["type"];
  title: string;
  description: string;
  releaseDate: string;
}

export interface UpdateReleaseRequest {
  title?: string;
  description?: string;
  releaseDate?: string;
  status?: Release["status"];
}

// ============================================================
// Scene
// ============================================================

export interface CreateSceneRequest {
  artistId: string;
  name: string;
  description?: string;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SaveSceneRequest {
  schema: Scene["schema"];
}

// ============================================================
// Experience
// ============================================================

export interface CreateExperienceRequest {
  artistId: string;
  title: string;
  description: string;
  releaseId?: string;
}

export interface PublishExperienceRequest {
  experienceId: string;
}

// ============================================================
// Campaign
// ============================================================

export interface CreateCampaignRequest {
  artistId: string;
  experienceId: string;
  title: string;
  description: string;
  participationPolicy: Campaign["participationPolicy"];
  startsAt?: string;
  endsAt?: string;
}

export interface UpdateCampaignRequest {
  title?: string;
  description?: string;
  status?: Campaign["status"];
  branding?: Partial<Campaign["branding"]>;
  participationPolicy?: Partial<Campaign["participationPolicy"]>;
  startsAt?: string | null;
  endsAt?: string | null;
}

// ============================================================
// Fan Artwork
// ============================================================

export interface CreateArtworkRequest {
  campaignId: string;
  experienceVersionId: string;
  title: string;
  customization: FanArtwork["customization"];
  sessionToken?: string; // For anonymous users
}

export interface PublishArtworkRequest {
  artworkId: string;
  permission: FanArtwork["permission"];
}

// ============================================================
// Media
// ============================================================

export interface UploadAssetRequest {
  artistId: string;
  type: MediaAsset["type"];
  filename: string;
  mimeType: string;
  sizeBytes: number;
  altText?: string;
  tags?: string[];
}

export interface UploadAssetResponse {
  asset: MediaAsset;
  uploadUrl: string; // Pre-signed URL for direct upload
}

// ============================================================
// Analytics
// ============================================================

export interface AnalyticsQuery {
  from: string;
  to: string;
  granularity?: "hour" | "day" | "week";
}

// ============================================================
// Type guards
// ============================================================

export function isApiError(res: ApiResponse<unknown>): res is ApiError {
  return !res.ok;
}

export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccess<T> {
  return res.ok;
}
