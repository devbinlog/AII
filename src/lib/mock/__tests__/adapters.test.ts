/**
 * Contract tests for Mock Adapters
 * Verifies that all mock adapters satisfy the Repository interfaces.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mockRegistry } from "../adapters";
import { resetRepository } from "../../repository";
import { MOCK_IDS } from "../fixtures";

beforeEach(() => {
  resetRepository();
});

// ============================================================
// Auth
// ============================================================

describe("MockAuthRepository", () => {
  it("signs in with valid credentials", async () => {
    const { user, session } = await mockRegistry.auth.signIn("fan1@example.com", "any");
    expect(user.id).toBe(MOCK_IDS.USER_FAN_1);
    expect(session.isMock).toBe(true);
  });

  it("throws on invalid credentials", async () => {
    await expect(
      mockRegistry.auth.signIn("unknown@example.com", "wrong")
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("returns session after sign in", async () => {
    const { session } = await mockRegistry.auth.signIn("fan1@example.com", "any");
    const token = `mock_session_${MOCK_IDS.USER_FAN_1}`;
    // Session token is generated dynamically, so we verify indirectly
    expect(session.userId).toBe(MOCK_IDS.USER_FAN_1);
    expect(session.role).toBe("fan");
  });

  it("creates a new user", async () => {
    const user = await mockRegistry.auth.createUser({
      email: "newuser@test.com",
      password: "secret",
      displayName: "New User",
    });
    expect(user.email).toBe("newuser@test.com");
    expect(user.role).toBe("fan");
  });

  it("throws on duplicate email", async () => {
    await expect(
      mockRegistry.auth.createUser({
        email: "fan1@example.com",
        password: "secret",
        displayName: "Duplicate",
      })
    ).rejects.toThrow("EMAIL_ALREADY_EXISTS");
  });
});

// ============================================================
// Artist
// ============================================================

describe("MockArtistRepository", () => {
  it("finds FREEPOLUS by id", async () => {
    const artist = await mockRegistry.artist.findById(MOCK_IDS.ARTIST_FREEPOLUS);
    expect(artist?.slug).toBe("freepolus");
    expect(artist?.name).toBe("FREEPOLUS");
  });

  it("finds FREEPOLUS by slug", async () => {
    const artist = await mockRegistry.artist.findBySlug("freepolus");
    expect(artist?.id).toBe(MOCK_IDS.ARTIST_FREEPOLUS);
  });

  it("returns null for unknown artist", async () => {
    expect(await mockRegistry.artist.findById("nonexistent")).toBeNull();
  });

  it("lists artists", async () => {
    const { artists, total } = await mockRegistry.artist.list({});
    expect(artists.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });

  it("creates a new artist", async () => {
    const artist = await mockRegistry.artist.create(
      { slug: "new-artist", name: "New Artist", bio: "A new artist", genre: ["pop"] },
      MOCK_IDS.USER_PLATFORM_ADMIN
    );
    expect(artist.slug).toBe("new-artist");
    expect(artist.status).toBe("pending_review");
  });

  it("slug availability check works", async () => {
    expect(await mockRegistry.artist.checkSlugAvailable("freepolus")).toBe(false);
    expect(await mockRegistry.artist.checkSlugAvailable("available-slug")).toBe(true);
  });
});

// ============================================================
// Release
// ============================================================

describe("MockReleaseRepository", () => {
  it("finds release by id", async () => {
    const release = await mockRegistry.release.findById(MOCK_IDS.RELEASE_MOONWAVE);
    expect(release?.title).toBe("Moonwave EP");
    expect(release?.type).toBe("ep");
  });

  it("lists releases by artist", async () => {
    const { releases, total } = await mockRegistry.release.listByArtist(
      MOCK_IDS.ARTIST_FREEPOLUS,
      {}
    );
    expect(releases.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });

  it("creates a new release", async () => {
    const release = await mockRegistry.release.create({
      artistId: MOCK_IDS.ARTIST_FREEPOLUS,
      type: "single",
      title: "New Single",
      description: "Test single",
      releaseDate: "2026-12-01",
    });
    expect(release.status).toBe("draft");
    expect(release.title).toBe("New Single");
  });
});

// ============================================================
// Campaign
// ============================================================

describe("MockCampaignRepository", () => {
  it("finds active campaign", async () => {
    const campaign = await mockRegistry.campaign.findById(MOCK_IDS.CAMPAIGN_MOONWAVE_FAN);
    expect(campaign?.status).toBe("active");
    expect(campaign?.artistId).toBe(MOCK_IDS.ARTIST_FREEPOLUS);
  });

  it("lists public campaigns", async () => {
    const { campaigns, total } = await mockRegistry.campaign.listPublic({
      status: "active",
    });
    expect(campaigns.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });
});

// ============================================================
// Artwork
// ============================================================

describe("MockArtworkRepository", () => {
  it("lists artworks by campaign", async () => {
    const { artworks, total } = await mockRegistry.artwork.listByCampaign(
      MOCK_IDS.CAMPAIGN_MOONWAVE_FAN,
      {}
    );
    expect(artworks.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });

  it("creates anonymous artwork", async () => {
    const artwork = await mockRegistry.artwork.create({
      campaignId: MOCK_IDS.CAMPAIGN_MOONWAVE_FAN,
      experienceVersionId: "expv_001",
      title: "Anonymous Artwork",
      customization: {
        versionId: "expv_001",
        sceneStates: {},
        captureFrameMs: 3000,
      },
      sessionToken: "test_session_token_123",
    });
    expect(artwork.creatorId).toBeNull();
    expect(artwork.sessionToken).toBe("test_session_token_123");
    expect(artwork.status).toBe("draft");
  });

  it("claims anonymous artworks after login", async () => {
    // Create anonymous artwork
    await mockRegistry.artwork.create({
      campaignId: MOCK_IDS.CAMPAIGN_MOONWAVE_FAN,
      experienceVersionId: "expv_001",
      title: "To Be Claimed",
      customization: { versionId: "expv_001", sceneStates: {}, captureFrameMs: 0 },
      sessionToken: "claim_me_session",
    });

    const claimedCount = await mockRegistry.artwork.claimAnonymous(
      "claim_me_session",
      MOCK_IDS.USER_FAN_1
    );
    expect(claimedCount).toBe(1);
  });

  it("supports liking and unliking", async () => {
    const artwork = await mockRegistry.artwork.findById(MOCK_IDS.ARTWORK_FAN_001);
    const initialLikes = artwork!.likeCount;

    await mockRegistry.artwork.like(MOCK_IDS.ARTWORK_FAN_001, "test_user");
    const after = await mockRegistry.artwork.findById(MOCK_IDS.ARTWORK_FAN_001);
    expect(after!.likeCount).toBe(initialLikes + 1);

    // Liking again should be idempotent
    await mockRegistry.artwork.like(MOCK_IDS.ARTWORK_FAN_001, "test_user");
    const afterAgain = await mockRegistry.artwork.findById(MOCK_IDS.ARTWORK_FAN_001);
    expect(afterAgain!.likeCount).toBe(initialLikes + 1);

    await mockRegistry.artwork.unlike(MOCK_IDS.ARTWORK_FAN_001, "test_user");
    const afterUnlike = await mockRegistry.artwork.findById(MOCK_IDS.ARTWORK_FAN_001);
    expect(afterUnlike!.likeCount).toBe(initialLikes);
  });
});

// ============================================================
// Analytics
// ============================================================

describe("MockAnalyticsRepository", () => {
  it("returns campaign analytics summary", async () => {
    const summary = await mockRegistry.analytics.getCampaignSummary(
      MOCK_IDS.CAMPAIGN_MOONWAVE_FAN,
      "2026-10-01T00:00:00Z",
      "2026-10-28T00:00:00Z"
    );
    expect(summary.campaignId).toBe(MOCK_IDS.CAMPAIGN_MOONWAVE_FAN);
    expect(summary.totalParticipants).toBeGreaterThan(0);
    expect(summary.participationByDay).toHaveLength(28);
  });
});
