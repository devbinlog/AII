/**
 * AII — Mock Repository Adapters
 * In-memory implementations of all repository interfaces.
 * MUST NOT be activated in production builds.
 * Supports the full user flow without any real services.
 *
 * ## Persistence Constraints
 *
 * - **Server restart**: All mutations (creates, updates, deletes) are lost on restart.
 *   The store is created from fixtures once per process and kept on `globalThis`,
 *   so every bundle (route handlers, server components) shares the same state.
 *
 * - **Concurrent requests**: The store is a single in-process object. Concurrent
 *   requests in the same Node.js instance share state (no locking). This is fine
 *   for local dev but would be a data hazard in multi-threaded environments.
 *
 * - **Multi-instance (e.g. Vercel serverless)**: Each function instance gets its own
 *   in-memory store. Mutations in one instance are invisible to others. Do NOT use
 *   MOCK_ONLY mode in production serverless deployments.
 *
 * - **Hot-reload (Next.js dev)**: Module-level state persists across HMR boundaries
 *   (the module is not re-evaluated unless the file itself changes). If fixtures
 *   change, restart the dev server to reset state.
 *
 * - **Test isolation**: Call `resetRepository()` from `@/lib/repository` between
 *   tests to get a fresh store. Never rely on test-order-dependent mock state.
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
  SceneSchema,
  Session,
  UploadAssetRequest,
  UploadAssetResponse,
  User,
} from "@/types";
import type {
  AnalyticsRepository,
  ArtistRepository,
  ArtworkRepository,
  AuditRepository,
  AuthRepository,
  CampaignRepository,
  ExperienceRepository,
  MediaRepository,
  ReleaseRepository,
  RepositoryRegistry,
  SceneRepository,
  StageLayoutRepository,
} from "../adapters/interfaces";
import { STAGE_SCHEMA_VERSION, type StageLayout, type StageLayoutVersion, type StagePublication } from "@/lib/stage/types";
import {
  MOCK_ARTISTS,
  MOCK_ARTWORKS,
  MOCK_ASSETS,
  MOCK_CAMPAIGNS,
  MOCK_EXPERIENCE_VERSIONS,
  MOCK_EXPERIENCES,
  MOCK_RELEASES,
  MOCK_SCENES,
  MOCK_USERS,
} from "./fixtures";

// ============================================================
// Helpers
// ============================================================

function newId(prefix = "mock"): string {
  return `${prefix}_${(++store.idCounter).toString().padStart(6, "0")}`;
}

function now(): string {
  return new Date().toISOString();
}

function paginate<T>(items: T[], query: PaginationQuery): { items: T[]; total: number } {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
  };
}

// ============================================================
// In-memory stores (clone so mutations don't corrupt fixtures)
// ============================================================

function freezeFixtureVersion(version: ExperienceVersion): ExperienceVersion {
  const sceneSchemas: Record<string, SceneSchema> = { ...version.snapshot.sceneSchemas };
  for (const es of version.snapshot.scenes) {
    if (sceneSchemas[es.sceneId]) continue;
    const scene = MOCK_SCENES.find((s) => s.id === es.sceneId);
    if (scene) sceneSchemas[es.sceneId] = scene.schema;
  }
  const experience = MOCK_EXPERIENCES.find((e) => e.id === version.experienceId);
  return structuredClone({
    ...version,
    snapshot: { ...version.snapshot, sceneSchemas, editableParameters: version.snapshot.editableParameters ?? experience?.editableParameters ?? [] },
  });
}

function createStore() {
  return {
    idCounter: 1000,
    users: structuredClone(MOCK_USERS) as User[],
    artists: structuredClone(MOCK_ARTISTS) as Artist[],
    releases: structuredClone(MOCK_RELEASES) as Release[],
    scenes: structuredClone(MOCK_SCENES) as Scene[],
    experiences: structuredClone(MOCK_EXPERIENCES) as Experience[],
    // Fixture versions leave sceneSchemas empty; freeze them from the fixture
    // scenes once, so later scene edits never change a published version.
    experienceVersions: MOCK_EXPERIENCE_VERSIONS.map((v) => freezeFixtureVersion(v)),
    campaigns: structuredClone(MOCK_CAMPAIGNS) as Campaign[],
    artworks: structuredClone(MOCK_ARTWORKS) as FanArtwork[],
    assets: structuredClone(MOCK_ASSETS) as MediaAsset[],
    sessions: new Map<string, Session>(),
    auditLogs: [] as AuditLogEntry[],
    likes: new Set<string>(), // `${userId}:${artworkId}`
    stageLayouts: new Map<string, StageLayout>(), // artistId → saved 3D stage draft
    stageVersions: [] as StageLayoutVersion[], // immutable published snapshots
    stagePublications: new Map<string, StagePublication>(), // artistId → publication state
  };
}

type MockStore = ReturnType<typeof createStore>;

// Next.js may evaluate this module separately for route handlers and for
// server-component pages (different bundles / layers). A module-level store
// would then give each bundle its own sessions Map, so a session created via
// /api/auth/signin is not visible to /me/artworks. Keep one store per process.
const globalForMock = globalThis as typeof globalThis & { __aiiMockStore?: MockStore };
// Keep existing data across hot reloads, but add stores introduced since the process started.
const store: MockStore = (globalForMock.__aiiMockStore = { ...createStore(), ...globalForMock.__aiiMockStore });

// ============================================================
// Mock Auth Repository
// ============================================================

const mockAuth: AuthRepository = {
  async signIn(email, _password) {
    const user = store.users.find((u) => u.email === email);
    if (!user) throw new Error("INVALID_CREDENTIALS");
    const session: Session = {
      userId: user.id,
      role: user.role,
      artistId: user.artistId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isMock: true,
    };
    const token = `mock_session_${user.id}_${Date.now()}`;
    store.sessions.set(token, session);
    return { user, session, sessionToken: token };
  },

  async signOut(sessionToken) {
    store.sessions.delete(sessionToken);
  },

  async getSession(sessionToken) {
    return store.sessions.get(sessionToken) ?? null;
  },

  async getUser(userId) {
    return store.users.find((u) => u.id === userId) ?? null;
  },

  async createUser(data) {
    if (store.users.find((u) => u.email === data.email)) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
    const user: User = {
      id: newId("usr"),
      email: data.email,
      displayName: data.displayName,
      avatarUrl: null,
      role: "fan",
      artistId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    store.users.push(user);
    return user;
  },

  async updateUser(userId, data) {
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("USER_NOT_FOUND");
    const updated = { ...store.users[idx]!, ...data, updatedAt: now() };
    store.users[idx] = updated;
    return updated;
  },

  async changeRole(userId, role, _actorId) {
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("USER_NOT_FOUND");
    store.users[idx] = { ...store.users[idx]!, role, updatedAt: now() };
  },
};

// ============================================================
// Mock Artist Repository
// ============================================================

const mockArtist: ArtistRepository = {
  async findById(id) {
    return store.artists.find((a) => a.id === id) ?? null;
  },

  async findBySlug(slug) {
    return store.artists.find((a) => a.slug === slug) ?? null;
  },

  async list(query: ArtistListQuery) {
    let items = [...store.artists];
    if (query.status) items = items.filter((a) => a.status === query.status);
    if (query.genre) items = items.filter((a) => a.genre.includes(query.genre!));
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (a) => a.name.toLowerCase().includes(q) || a.bio.toLowerCase().includes(q)
      );
    }
    const { items: artists, total } = paginate(items, query);
    return { artists, total };
  },

  async create(data: CreateArtistRequest, _createdBy: string) {
    const artist: Artist = {
      id: newId("art"),
      slug: data.slug,
      name: data.name,
      bio: data.bio,
      genre: data.genre,
      branding: {
        primaryColor: "#e8192c",
        secondaryColor: "#0a0a0a",
        accentColor: "#f5f5f0",
        backgroundColor: "#0a0a0a",
        logoUrl: null,
        coverImageUrl: null,
        fontFamily: null,
        motionPreset: "moderate",
      },
      socialLinks: {},
      status: "pending_review",
      isVerified: false,
      followerCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    store.artists.push(artist);
    return artist;
  },

  async update(id, data) {
    const idx = store.artists.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("ARTIST_NOT_FOUND");
    const updated = {
      ...store.artists[idx]!,
      ...data,
      branding: data.branding
        ? { ...store.artists[idx]!.branding, ...data.branding }
        : store.artists[idx]!.branding,
      socialLinks: data.socialLinks
        ? { ...store.artists[idx]!.socialLinks, ...data.socialLinks }
        : store.artists[idx]!.socialLinks,
      updatedAt: now(),
    };
    store.artists[idx] = updated;
    return updated;
  },

  async delete(id) {
    const idx = store.artists.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("ARTIST_NOT_FOUND");
    store.artists.splice(idx, 1);
  },

  async checkSlugAvailable(slug) {
    return !store.artists.find((a) => a.slug === slug);
  },
};

// ============================================================
// Mock Release Repository
// ============================================================

const mockRelease: ReleaseRepository = {
  async findById(id) {
    return store.releases.find((r) => r.id === id) ?? null;
  },

  async listByArtist(artistId, query) {
    const items = store.releases.filter((r) => r.artistId === artistId);
    const { items: releases, total } = paginate(items, query);
    return { releases, total };
  },

  async create(data: CreateReleaseRequest) {
    const release: Release = {
      id: newId("rel"),
      artistId: data.artistId,
      type: data.type,
      title: data.title,
      description: data.description,
      coverImageUrl: null,
      tracks: [],
      releaseDate: data.releaseDate,
      status: "draft",
      label: null,
      upc: null,
      createdAt: now(),
      updatedAt: now(),
    };
    store.releases.push(release);
    return release;
  },

  async update(id, data) {
    const idx = store.releases.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("RELEASE_NOT_FOUND");
    const updated = { ...store.releases[idx]!, ...data, updatedAt: now() };
    store.releases[idx] = updated;
    return updated;
  },

  async delete(id) {
    const idx = store.releases.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("RELEASE_NOT_FOUND");
    store.releases.splice(idx, 1);
  },

  async publish(id) {
    return mockRelease.update(id, { status: "released" });
  },
};

// ============================================================
// Mock Scene Repository
// ============================================================

const mockScene: SceneRepository = {
  async findById(id) {
    return store.scenes.find((s) => s.id === id) ?? null;
  },

  async listByArtist(artistId, query) {
    const items = store.scenes.filter((s) => s.artistId === artistId);
    const { items: scenes, total } = paginate(items, query);
    return { scenes, total };
  },

  async create(data: CreateSceneRequest, _createdBy: string) {
    const id = newId("scn");
    const scene: Scene = {
      id,
      artistId: data.artistId,
      experienceId: null,
      name: data.name,
      description: data.description ?? "",
      thumbnailUrl: null,
      schema: {
        version: "1.0.0",
        sceneId: id,
        objects: [],
        interactions: [],
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        backgroundColor: "#0a0a0a",
        audioTrackId: null,
        duration: null,
      },
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
    };
    store.scenes.push(scene);
    return scene;
  },

  async save(id, schema) {
    const idx = store.scenes.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("SCENE_NOT_FOUND");
    const updated = { ...store.scenes[idx]!, schema: structuredClone(schema), updatedAt: now() };
    store.scenes[idx] = updated;
    return updated;
  },

  async updateMeta(id, data) {
    const idx = store.scenes.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("SCENE_NOT_FOUND");
    const updated = { ...store.scenes[idx]!, ...data, updatedAt: now() };
    store.scenes[idx] = updated;
    return updated;
  },

  async delete(id) {
    const idx = store.scenes.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("SCENE_NOT_FOUND");
    store.scenes.splice(idx, 1);
  },

  async duplicate(id) {
    const scene = store.scenes.find((s) => s.id === id);
    if (!scene) throw new Error("SCENE_NOT_FOUND");
    const newSceneId = newId("scn");
    const duplicated: Scene = {
      ...scene,
      id: newSceneId,
      name: `${scene.name} (Copy)`,
      schema: { ...scene.schema, sceneId: newSceneId },
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
    };
    store.scenes.push(duplicated);
    return duplicated;
  },

  async listVersionHistory(_id) {
    // Mock: always return single version
    return [{ version: "1.0.0", savedAt: now(), thumbnail: null }];
  },
};

// ============================================================
// Mock Experience Repository
// ============================================================

const mockExperience: ExperienceRepository = {
  async findById(id) {
    return store.experiences.find((e) => e.id === id) ?? null;
  },

  async findVersionById(versionId) {
    const version = store.experienceVersions.find((v) => v.id === versionId) ?? null;
    // Published versions are immutable snapshots; hand out a copy.
    return version ? structuredClone(version) : null;
  },

  async listVersions(experienceId) {
    return structuredClone(
      store.experienceVersions
        .filter((v) => v.experienceId === experienceId)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    );
  },

  async listByArtist(artistId, query) {
    const items = store.experiences.filter((e) => e.artistId === artistId);
    const { items: experiences, total } = paginate(items, query);
    return { experiences, total };
  },

  async create(data: CreateExperienceRequest) {
    const experience: Experience = {
      id: newId("exp"),
      artistId: data.artistId,
      releaseId: data.releaseId ?? null,
      title: data.title,
      description: data.description,
      coverImageUrl: null,
      scenes: [],
      editableParameters: [],
      status: "draft",
      currentVersionId: null,
      totalPlayCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    store.experiences.push(experience);
    return experience;
  },

  async update(id, data) {
    const idx = store.experiences.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("EXPERIENCE_NOT_FOUND");
    const updated = { ...store.experiences[idx]!, ...data, updatedAt: now() };
    store.experiences[idx] = updated;
    return updated;
  },

  async publish(id, publishedBy) {
    const exp = store.experiences.find((e) => e.id === id);
    if (!exp) throw new Error("EXPERIENCE_NOT_FOUND");
    const versionId = newId("expv");
    const sceneSchemas: Record<string, SceneSchema> = {};
    const schemaVersions: Record<string, string> = {};
    for (const es of exp.scenes) {
      const scene = store.scenes.find((s) => s.id === es.sceneId);
      if (scene) {
        sceneSchemas[es.sceneId] = scene.schema;
        schemaVersions[es.sceneId] = scene.schema.version;
      }
    }
    const published = store.experienceVersions.filter((v) => v.experienceId === id).length;
    // Deep copy: the snapshot must not share objects with the editable scenes.
    const version: ExperienceVersion = structuredClone({
      id: versionId,
      experienceId: id,
      version: `${published + 1}.0.0`,
      schemaVersions,
      snapshot: { scenes: exp.scenes, sceneSchemas, editableParameters: exp.editableParameters },
      rendererVersion: "1.0.0",
      publishedAt: now(),
      publishedBy,
    });
    store.experienceVersions.push(version);
    await mockExperience.update(id, { status: "published", currentVersionId: versionId });
    return structuredClone(version);
  },

  async delete(id) {
    const idx = store.experiences.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("EXPERIENCE_NOT_FOUND");
    store.experiences.splice(idx, 1);
  },

  async incrementPlayCount(id) {
    const idx = store.experiences.findIndex((e) => e.id === id);
    if (idx !== -1 && store.experiences[idx]) {
      store.experiences[idx] = {
        ...store.experiences[idx]!,
        totalPlayCount: store.experiences[idx]!.totalPlayCount + 1,
      };
    }
  },
};

// ============================================================
// Mock Campaign Repository
// ============================================================

const mockCampaign: CampaignRepository = {
  async findById(id) {
    return store.campaigns.find((c) => c.id === id) ?? null;
  },

  async findBySlug(slug) {
    return store.campaigns.find((c) => c.slug === slug) ?? null;
  },

  async listByArtist(artistId, query) {
    const items = store.campaigns.filter((c) => c.artistId === artistId);
    const { items: campaigns, total } = paginate(items, query);
    return { campaigns, total };
  },

  async listPublic(query) {
    // Drafts are never public, even when no status filter is given.
    let items = store.campaigns.filter((c) => c.status !== "draft");
    if (query.status) items = items.filter((c) => c.status === query.status);
    const { items: campaigns, total } = paginate(items, query);
    return { campaigns, total };
  },

  async create(data: CreateCampaignRequest) {
    const campaign: Campaign = {
      id: newId("cmp"),
      slug: data.slug ?? data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      artistId: data.artistId,
      experienceId: data.experienceId,
      title: data.title,
      description: data.description,
      branding: {
        primaryColor: "#e8192c",
        backgroundColor: "#0a0a0a",
        backgroundImageUrl: null,
        logoUrl: null,
        tagline: null,
      },
      participationPolicy: data.participationPolicy,
      status: "draft",
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      artworkCount: 0,
      participantCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    store.campaigns.push(campaign);
    return campaign;
  },

  async update(id, data) {
    const idx = store.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("CAMPAIGN_NOT_FOUND");
    const prev = store.campaigns[idx]!;
    const updated: Campaign = {
      ...prev,
      ...data,
      branding: data.branding ? { ...prev.branding, ...data.branding } : prev.branding,
      participationPolicy: data.participationPolicy
        ? { ...prev.participationPolicy, ...data.participationPolicy }
        : prev.participationPolicy,
      updatedAt: now(),
    };
    store.campaigns[idx] = updated;
    return updated;
  },

  async publish(id) {
    return mockCampaign.update(id, { status: "active" });
  },

  async end(id) {
    return mockCampaign.update(id, { status: "ended" });
  },
};

// ============================================================
// Mock Artwork Repository
// ============================================================

const mockArtwork: ArtworkRepository = {
  async findById(id) {
    return store.artworks.find((a) => a.id === id) ?? null;
  },

  async listByCampaign(campaignId, query) {
    const items = store.artworks.filter(
      (a) => a.campaignId === campaignId && a.status === "published"
    );
    const { items: artworks, total } = paginate(items, query);
    return { artworks, total };
  },

  async listByUser(userId, query) {
    const items = store.artworks.filter((a) => a.creatorId === userId);
    const { items: artworks, total } = paginate(items, query);
    return { artworks, total };
  },

  async listBySession(sessionToken) {
    return store.artworks.filter((a) => a.sessionToken === sessionToken);
  },

  async create(data) {
    const artwork: FanArtwork = {
      id: newId("art_fw"),
      campaignId: data.campaignId,
      experienceVersionId: data.experienceVersionId,
      creatorId: data.creatorId ?? null,
      sessionToken: data.sessionToken ?? null,
      title: data.title,
      imageUrl: null,
      customization: data.customization,
      permission: "private",
      status: "draft",
      moderationStatus: "pending",
      likeCount: 0,
      shareCount: 0,
      likedBy: [],
      createdAt: now(),
      updatedAt: now(),
    };
    store.artworks.push(artwork);
    return artwork;
  },

  async update(id, data) {
    const idx = store.artworks.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("ARTWORK_NOT_FOUND");
    const updated = { ...store.artworks[idx]!, ...data, updatedAt: now() };
    store.artworks[idx] = updated;
    return updated;
  },

  async claimAnonymous(sessionToken, userId) {
    let count = 0;
    store.artworks.forEach((artwork, idx) => {
      if (artwork.sessionToken === sessionToken && artwork.creatorId === null) {
        store.artworks[idx] = {
          ...artwork,
          creatorId: userId,
          sessionToken: null,
          updatedAt: now(),
        };
        count++;
      }
    });
    return count;
  },

  async delete(id, requestorId) {
    const artwork = store.artworks.find((a) => a.id === id);
    if (!artwork) throw new Error("ARTWORK_NOT_FOUND");
    // Anonymous artworks (creatorId === null) have no logged-in owner until claimed.
    if (artwork.creatorId === null || artwork.creatorId !== requestorId) {
      throw new Error("FORBIDDEN");
    }
    const idx = store.artworks.findIndex((a) => a.id === id);
    if (idx !== -1) store.artworks.splice(idx, 1);
  },

  async flag(id, _reason, _reportedBy) {
    await mockArtwork.update(id, { status: "flagged" });
  },

  async remove(id, _removedBy) {
    await mockArtwork.update(id, { status: "removed" });
  },

  async like(id, userId) {
    const key = `${userId}:${id}`;
    if (!store.likes.has(key)) {
      store.likes.add(key);
      const idx = store.artworks.findIndex((a) => a.id === id);
      if (idx !== -1 && store.artworks[idx]) {
        const prev = store.artworks[idx]!;
        store.artworks[idx] = {
          ...prev,
          likeCount: prev.likeCount + 1,
          likedBy: [...prev.likedBy, userId],
        };
      }
    }
  },

  async unlike(id, userId) {
    const key = `${userId}:${id}`;
    if (store.likes.has(key)) {
      store.likes.delete(key);
      const idx = store.artworks.findIndex((a) => a.id === id);
      if (idx !== -1 && store.artworks[idx]) {
        const prev = store.artworks[idx]!;
        store.artworks[idx] = {
          ...prev,
          likeCount: Math.max(0, prev.likeCount - 1),
          likedBy: prev.likedBy.filter((uid) => uid !== userId),
        };
      }
    }
  },
};

// ============================================================
// Mock Media Repository
// ============================================================

const mockMedia: MediaRepository = {
  async findById(id) {
    return store.assets.find((a) => a.id === id) ?? null;
  },

  async listByArtist(artistId, query) {
    let items = store.assets.filter((a) => a.artistId === artistId);
    if (query.type) items = items.filter((a) => a.type === query.type);
    const { items: assets, total } = paginate(items, query);
    return { assets, total };
  },

  async prepareUpload(data: UploadAssetRequest): Promise<UploadAssetResponse> {
    const asset: MediaAsset = {
      id: newId("ast"),
      artistId: data.artistId,
      type: data.type,
      filename: data.filename,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      url: data.previewDataUrl ?? `/mock/uploads/${encodeURIComponent(data.filename)}`,
      thumbnailUrl: data.previewDataUrl ?? null,
      altText: data.altText ?? null,
      tags: data.tags ?? [],
      usedIn: [],
      uploadedBy: data.uploadedBy ?? "mock_user",
      createdAt: now(),
    };
    store.assets.push(asset);
    return {
      asset,
      uploadUrl: `/mock/upload-url/${asset.id}`,
    };
  },

  async confirmUpload(assetId) {
    const asset = store.assets.find((a) => a.id === assetId);
    if (!asset) throw new Error("ASSET_NOT_FOUND");
    return asset;
  },

  async delete(id) {
    const idx = store.assets.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("ASSET_NOT_FOUND");
    store.assets.splice(idx, 1);
  },
};

// ============================================================
// Mock Analytics Repository
// ============================================================

const mockAnalytics: AnalyticsRepository = {
  async getCampaignSummary(campaignId, from, to): Promise<CampaignAnalyticsSummary> {
    const campaign = store.campaigns.find((c) => c.id === campaignId);
    return {
      campaignId,
      period: { from, to },
      totalParticipants: campaign?.participantCount ?? 0,
      uniqueVisitors: Math.floor((campaign?.participantCount ?? 0) * 1.4),
      artworksCreated: campaign?.artworkCount ?? 0,
      artworksPublished: Math.floor((campaign?.artworkCount ?? 0) * 0.6),
      shareCount: Math.floor((campaign?.artworkCount ?? 0) * 0.1),
      avgTimeOnExperienceMs: 180000,
      topReferrers: [
        { source: "instagram", count: 320 },
        { source: "direct", count: 200 },
        { source: "twitter", count: 103 },
      ],
      deviceBreakdown: { mobile: 58, desktop: 35, tablet: 7 },
      participationByDay: Array.from({ length: 28 }, (_, i) => ({
        date: new Date(Date.now() - (27 - i) * 86400000).toISOString().split("T")[0]!,
        count: Math.floor(Math.random() * 40) + 5,
      })),
    };
  },

  async trackEvent(_event) {
    // No-op in mock
  },
};

// ============================================================
// Mock Audit Repository
// ============================================================

const mockAudit: AuditRepository = {
  async log(entry) {
    store.auditLogs.push({
      id: newId("aud"),
      actorId: entry.actorId,
      action: entry.action as AuditLogEntry["action"],
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      timestamp: now(),
    });
  },

  async list(query) {
    let entries = [...store.auditLogs];
    if (query.actorId) entries = entries.filter((e) => e.actorId === query.actorId);
    if (query.action) entries = entries.filter((e) => e.action === query.action);
    if (query.from) entries = entries.filter((e) => e.timestamp >= query.from!);
    if (query.to) entries = entries.filter((e) => e.timestamp <= query.to!);
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const { items, total } = paginate(entries, query);
    return { entries: items, total };
  },
};

// ============================================================
// Export: Mock Registry
// ============================================================

// ============================================================
// Mock Stage Layout Repository
// ============================================================

const mockStage: StageLayoutRepository = {
  async get(artistId) {
    const layout = store.stageLayouts.get(artistId);
    return layout ? structuredClone(layout) : null;
  },
  async save(layout) {
    const saved = { ...structuredClone(layout), updatedAt: now() };
    store.stageLayouts.set(layout.artistId, saved);
    return structuredClone(saved);
  },

  async publish(artistId, publishedBy) {
    const draft = store.stageLayouts.get(artistId);
    if (!draft) throw new Error("STAGE_DRAFT_NOT_FOUND");
    const count = store.stageVersions.filter((v) => v.artistId === artistId).length;
    const version: StageLayoutVersion = structuredClone({
      id: newId("stgv"),
      artistId,
      version: count + 1,
      schemaVersion: STAGE_SCHEMA_VERSION,
      items: draft.items,
      publishedAt: now(),
      publishedBy,
    });
    store.stageVersions.push(version);
    store.stagePublications.set(artistId, { artistId, visibility: "public", publishedVersionId: version.id, updatedAt: now() });
    return structuredClone(version);
  },

  async unpublish(artistId) {
    const publication: StagePublication = { artistId, visibility: "unpublished", publishedVersionId: null, updatedAt: now() };
    store.stagePublications.set(artistId, publication);
    return structuredClone(publication);
  },

  async getPublication(artistId) {
    const p = store.stagePublications.get(artistId);
    return p ? structuredClone(p) : null;
  },

  async getPublished(artistId) {
    const p = store.stagePublications.get(artistId);
    if (!p || p.visibility !== "public" || !p.publishedVersionId) return null;
    const v = store.stageVersions.find((x) => x.id === p.publishedVersionId && x.artistId === artistId);
    return v ? structuredClone(v) : null;
  },

  async listVersions(artistId) {
    return structuredClone(store.stageVersions.filter((v) => v.artistId === artistId).sort((a, b) => b.version - a.version));
  },
};

export const mockRegistry: RepositoryRegistry = {
  auth: mockAuth,
  artist: mockArtist,
  release: mockRelease,
  scene: mockScene,
  experience: mockExperience,
  campaign: mockCampaign,
  artwork: mockArtwork,
  media: mockMedia,
  analytics: mockAnalytics,
  audit: mockAudit,
  stage: mockStage,
};

// Re-export interfaces for convenience
export type { RepositoryRegistry } from "../adapters/interfaces";
