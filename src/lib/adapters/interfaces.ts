import type { StageLayout } from "@/lib/stage/types";
/**
 * AII — Repository Interfaces
 * All data access must go through these contracts.
 * Mock adapters and production adapters must implement these.
 */

import type {
  Artist,
  ArtistListQuery,
  AuditLogEntry,
  Campaign,
  CampaignAnalyticsSummary,
  CreateArtistRequest,
  CreateCampaignRequest,
  CreateExperienceRequest,
  CreateReleaseRequest,
  CreateSceneRequest,
  Experience,
  ExperienceVersion,
  FanArtwork,
  MediaAsset,
  PaginationQuery,
  Release,
  Scene,
  Session,
  UpdateArtistRequest,
  UpdateCampaignRequest,
  UpdateReleaseRequest,
  UploadAssetRequest,
  UploadAssetResponse,
  User,
} from "@/types";

// ============================================================
// Auth Repository
// ============================================================

export interface AuthRepository {
  signIn(email: string, password: string): Promise<{ user: User; session: Session; sessionToken: string }>;
  signOut(sessionToken: string): Promise<void>;
  getSession(sessionToken: string): Promise<Session | null>;
  getUser(userId: string): Promise<User | null>;
  createUser(data: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<User>;
  updateUser(userId: string, data: Partial<Pick<User, "displayName" | "avatarUrl">>): Promise<User>;
  changeRole(userId: string, role: User["role"], actorId: string): Promise<void>;
}

// ============================================================
// Artist Repository
// ============================================================

export interface ArtistRepository {
  findById(id: string): Promise<Artist | null>;
  findBySlug(slug: string): Promise<Artist | null>;
  list(query: ArtistListQuery): Promise<{ artists: Artist[]; total: number }>;
  create(data: CreateArtistRequest, createdBy: string): Promise<Artist>;
  update(id: string, data: UpdateArtistRequest): Promise<Artist>;
  delete(id: string): Promise<void>;
  checkSlugAvailable(slug: string): Promise<boolean>;
}

// ============================================================
// Release Repository
// ============================================================

export interface ReleaseRepository {
  findById(id: string): Promise<Release | null>;
  listByArtist(artistId: string, query: PaginationQuery): Promise<{ releases: Release[]; total: number }>;
  create(data: CreateReleaseRequest): Promise<Release>;
  update(id: string, data: UpdateReleaseRequest): Promise<Release>;
  delete(id: string): Promise<void>;
  publish(id: string): Promise<Release>;
}

// ============================================================
// Scene Repository
// ============================================================

export interface SceneRepository {
  findById(id: string): Promise<Scene | null>;
  listByArtist(artistId: string, query: PaginationQuery): Promise<{ scenes: Scene[]; total: number }>;
  create(data: CreateSceneRequest, createdBy: string): Promise<Scene>;
  save(id: string, schema: Scene["schema"]): Promise<Scene>;
  updateMeta(id: string, data: Partial<Pick<Scene, "name" | "description">>): Promise<Scene>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<Scene>;
  listVersionHistory(id: string): Promise<Array<{ version: string; savedAt: string; thumbnail: string | null }>>;
}

// ============================================================
// Experience Repository
// ============================================================

export interface ExperienceRepository {
  findById(id: string): Promise<Experience | null>;
  findVersionById(versionId: string): Promise<ExperienceVersion | null>;
  /** Published versions of an experience, newest first. */
  listVersions(experienceId: string): Promise<ExperienceVersion[]>;
  listByArtist(artistId: string, query: PaginationQuery): Promise<{ experiences: Experience[]; total: number }>;
  create(data: CreateExperienceRequest): Promise<Experience>;
  update(id: string, data: Partial<Pick<Experience, "title" | "description" | "coverImageUrl" | "releaseId" | "scenes" | "editableParameters" | "status" | "currentVersionId">>): Promise<Experience>;
  publish(id: string, publishedBy: string): Promise<ExperienceVersion>;
  delete(id: string): Promise<void>;
  incrementPlayCount(id: string): Promise<void>;
}

// ============================================================
// Campaign Repository
// ============================================================

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  findBySlug(slug: string): Promise<Campaign | null>;
  listByArtist(artistId: string, query: PaginationQuery): Promise<{ campaigns: Campaign[]; total: number }>;
  listPublic(query: PaginationQuery & { status?: Campaign["status"] }): Promise<{ campaigns: Campaign[]; total: number }>;
  create(data: CreateCampaignRequest): Promise<Campaign>;
  update(id: string, data: UpdateCampaignRequest): Promise<Campaign>;
  publish(id: string): Promise<Campaign>;
  end(id: string): Promise<Campaign>;
}

// ============================================================
// Fan Artwork Repository
// ============================================================

export interface ArtworkRepository {
  findById(id: string): Promise<FanArtwork | null>;
  listByCampaign(campaignId: string, query: PaginationQuery): Promise<{ artworks: FanArtwork[]; total: number }>;
  listByUser(userId: string, query: PaginationQuery): Promise<{ artworks: FanArtwork[]; total: number }>;
  listBySession(sessionToken: string): Promise<FanArtwork[]>;
  create(data: {
    campaignId: string;
    experienceVersionId: string;
    title: string;
    customization: FanArtwork["customization"];
    creatorId?: string;
    sessionToken?: string;
  }): Promise<FanArtwork>;
  update(id: string, data: Partial<Pick<FanArtwork, "title" | "imageUrl" | "permission" | "status" | "customization">>): Promise<FanArtwork>;
  delete(id: string, requestorId: string): Promise<void>;
  claimAnonymous(sessionToken: string, userId: string): Promise<number>; // Returns claimed count
  flag(id: string, reason: string, reportedBy: string): Promise<void>;
  remove(id: string, removedBy: string): Promise<void>;
  like(id: string, userId: string): Promise<void>;
  unlike(id: string, userId: string): Promise<void>;
}

// ============================================================
// Media Repository
// ============================================================

export interface MediaRepository {
  findById(id: string): Promise<MediaAsset | null>;
  listByArtist(artistId: string, query: PaginationQuery & { type?: MediaAsset["type"] }): Promise<{ assets: MediaAsset[]; total: number }>;
  prepareUpload(data: UploadAssetRequest): Promise<UploadAssetResponse>;
  confirmUpload(assetId: string): Promise<MediaAsset>;
  delete(id: string): Promise<void>;
}

// ============================================================
// Analytics Repository
// ============================================================

export interface AnalyticsRepository {
  getCampaignSummary(campaignId: string, from: string, to: string): Promise<CampaignAnalyticsSummary>;
  trackEvent(event: {
    type: string;
    campaignId?: string;
    experienceId?: string;
    userId?: string;
    sessionToken?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

// ============================================================
// Audit Log Repository
// ============================================================

export interface AuditRepository {
  log(entry: {
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  list(query: PaginationQuery & { actorId?: string; action?: string; from?: string; to?: string }): Promise<{
    entries: AuditLogEntry[];
    total: number;
  }>;
}

// ============================================================
// Repository Registry
// ============================================================

// ============================================================
// Stage Layout Repository (3D Stage Configurator)
// ============================================================

export interface StageLayoutRepository {
  /** The artist's saved layout, or null if never saved. */
  get(artistId: string): Promise<StageLayout | null>;
  save(layout: StageLayout): Promise<StageLayout>;
}

export interface RepositoryRegistry {
  auth: AuthRepository;
  artist: ArtistRepository;
  release: ReleaseRepository;
  scene: SceneRepository;
  experience: ExperienceRepository;
  campaign: CampaignRepository;
  artwork: ArtworkRepository;
  media: MediaRepository;
  analytics: AnalyticsRepository;
  audit: AuditRepository;
  stage: StageLayoutRepository;
}
