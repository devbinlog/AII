/**
 * AII — Mock Fixtures
 * Realistic seed data for development & testing.
 * All IDs are stable so tests can reference them directly.
 */

import type {
  Artist,
  Campaign,
  Experience,
  FanArtwork,
  MediaAsset,
  Release,
  Scene,
  SceneSchema,
  Track,
  User,
} from "@/types";
import { SCENE_SCHEMA_VERSION } from "@/types/domain";

// ============================================================
// Stable IDs
// ============================================================

export const MOCK_IDS = {
  // Users
  USER_FAN_1: "usr_fan_001",
  USER_FAN_2: "usr_fan_002",
  USER_ARTIST_FREEPOLUS: "usr_art_001",
  USER_PLATFORM_ADMIN: "usr_adm_001",
  USER_PLATFORM_OWNER: "usr_own_001",

  // Artists
  ARTIST_FREEPOLUS: "art_001",

  // Releases
  RELEASE_MOONWAVE: "rel_001",
  RELEASE_STATIC_DREAMS: "rel_002",

  // Tracks
  TRACK_MOONWAVE_01: "trk_001",
  TRACK_MOONWAVE_02: "trk_002",
  TRACK_STATIC_01: "trk_003",

  // Scenes
  SCENE_WAVEFORM_HERO: "scn_001",
  SCENE_PARTICLE_BURST: "scn_002",

  // Experiences
  EXPERIENCE_MOONWAVE_MAIN: "exp_001",

  // Campaigns
  CAMPAIGN_MOONWAVE_FAN: "cmp_001",

  // Artworks
  ARTWORK_FAN_001: "art_fw_001",
  ARTWORK_FAN_002: "art_fw_002",

  // Assets
  ASSET_COVER_MOONWAVE: "ast_001",
  ASSET_AUDIO_MOONWAVE_01: "ast_002",
  ASSET_FREEPOLUS_LOGO: "ast_003",
} as const;

// ============================================================
// Users
// ============================================================

export const MOCK_USERS: User[] = [
  {
    id: MOCK_IDS.USER_FAN_1,
    email: "fan1@example.com",
    displayName: "Alex Kim",
    avatarUrl: null,
    role: "fan",
    artistId: null,
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: MOCK_IDS.USER_FAN_2,
    email: "fan2@example.com",
    displayName: "Jordan Lee",
    avatarUrl: null,
    role: "fan",
    artistId: null,
    createdAt: "2026-02-01T09:30:00Z",
    updatedAt: "2026-02-01T09:30:00Z",
  },
  {
    id: MOCK_IDS.USER_ARTIST_FREEPOLUS,
    email: "studio@freepolus.com",
    displayName: "FREEPOLUS Studio",
    avatarUrl: null,
    role: "artist_admin",
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-01T00:00:00Z",
  },
  {
    id: MOCK_IDS.USER_PLATFORM_ADMIN,
    email: "admin@aii.music",
    displayName: "AII Admin",
    avatarUrl: null,
    role: "platform_admin",
    artistId: null,
    createdAt: "2025-11-01T00:00:00Z",
    updatedAt: "2025-11-01T00:00:00Z",
  },
  {
    id: MOCK_IDS.USER_PLATFORM_OWNER,
    email: "owner@aii.music",
    displayName: "AII Owner",
    avatarUrl: null,
    role: "platform_owner",
    artistId: null,
    createdAt: "2025-10-01T00:00:00Z",
    updatedAt: "2025-10-01T00:00:00Z",
  },
];

// ============================================================
// Artists
// ============================================================

export const MOCK_ARTISTS: Artist[] = [
  {
    id: MOCK_IDS.ARTIST_FREEPOLUS,
    slug: "freepolus",
    name: "FREEPOLUS",
    bio: "FREEPOLUS는 서울을 기반으로 활동하는 독립 음악 아티스트입니다. 전자음악, 앰비언트, 실험적 사운드를 결합한 독특한 음악 세계를 구축하고 있습니다.",
    genre: ["electronic", "ambient", "experimental"],
    branding: {
      primaryColor: "#e8192c",
      secondaryColor: "#0a0a0a",
      accentColor: "#f5f5f0",
      backgroundColor: "#0a0a0a",
      logoUrl: null,
      coverImageUrl: null,
      fontFamily: null,
      motionPreset: "expressive",
    },
    socialLinks: {
      instagram: "https://instagram.com/freepolus",
      spotify: "https://open.spotify.com/artist/freepolus",
    },
    status: "active",
    isVerified: true,
    followerCount: 12430,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
];

// ============================================================
// Releases
// ============================================================

export const MOCK_TRACKS: Track[] = [
  {
    id: MOCK_IDS.TRACK_MOONWAVE_01,
    releaseId: MOCK_IDS.RELEASE_MOONWAVE,
    position: 1,
    title: "Moonwave I",
    durationMs: 245000,
    audioUrl: null,
    previewUrl: null,
    isrc: null,
  },
  {
    id: MOCK_IDS.TRACK_MOONWAVE_02,
    releaseId: MOCK_IDS.RELEASE_MOONWAVE,
    position: 2,
    title: "Moonwave II",
    durationMs: 312000,
    audioUrl: null,
    previewUrl: null,
    isrc: null,
  },
  {
    id: MOCK_IDS.TRACK_STATIC_01,
    releaseId: MOCK_IDS.RELEASE_STATIC_DREAMS,
    position: 1,
    title: "Static Dreams",
    durationMs: 198000,
    audioUrl: null,
    previewUrl: null,
    isrc: null,
  },
];

export const MOCK_RELEASES: Release[] = [
  {
    id: MOCK_IDS.RELEASE_MOONWAVE,
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    type: "ep",
    title: "Moonwave EP",
    description: "바다의 파장처럼 밀려오는 전자음악 EP. 달빛 아래의 고요함과 깊은 내면의 울림을 담았습니다.",
    coverImageUrl: null,
    tracks: MOCK_TRACKS.filter((t) => t.releaseId === MOCK_IDS.RELEASE_MOONWAVE),
    releaseDate: "2026-09-15",
    status: "released",
    label: null,
    upc: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-09-15T00:00:00Z",
  },
  {
    id: MOCK_IDS.RELEASE_STATIC_DREAMS,
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    type: "single",
    title: "Static Dreams",
    description: "정적 속에서 피어나는 꿈. 실험적인 소음 미학과 서정적 멜로디의 만남.",
    coverImageUrl: null,
    tracks: MOCK_TRACKS.filter((t) => t.releaseId === MOCK_IDS.RELEASE_STATIC_DREAMS),
    releaseDate: "2026-07-01",
    status: "released",
    label: null,
    upc: null,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

// ============================================================
// Scenes
// ============================================================

function makeEmptySchema(sceneId: string, canvasWidth = 1920, canvasHeight = 1080): SceneSchema {
  return {
    version: SCENE_SCHEMA_VERSION,
    sceneId,
    objects: [],
    interactions: [],
    canvasWidth,
    canvasHeight,
    backgroundColor: "#0a0a0a",
    audioTrackId: null,
    duration: null,
  };
}

export const MOCK_SCENES: Scene[] = [
  {
    id: MOCK_IDS.SCENE_WAVEFORM_HERO,
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    experienceId: MOCK_IDS.EXPERIENCE_MOONWAVE_MAIN,
    name: "Waveform Hero",
    description: "오디오 반응형 파형 시각화 메인 씬",
    thumbnailUrl: null,
    schema: {
      ...makeEmptySchema(MOCK_IDS.SCENE_WAVEFORM_HERO),
      audioTrackId: MOCK_IDS.TRACK_MOONWAVE_01,
      objects: [
        {
          id: "obj_wf_001",
          name: "Main Waveform",
          transform: {
            x: 960,
            y: 540,
            z: 0,
            width: 1200,
            height: 200,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
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
          createdAt: "2026-09-01T00:00:00Z",
          updatedAt: "2026-09-01T00:00:00Z",
        },
        {
          id: "obj_txt_001",
          name: "Artist Name",
          transform: {
            x: 200,
            y: 100,
            z: 1,
            width: 600,
            height: 120,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
          },
          style: {
            fill: "#f5f5f0",
            stroke: null,
            strokeWidth: 0,
            fontSize: 80,
            fontFamily: null,
            fontWeight: 900,
            textAlign: "left",
            borderRadius: 0,
            blendMode: "normal",
          },
          data: {
            type: "text",
            content: "FREEPOLUS",
          },
          visible: true,
          locked: false,
          parentId: null,
          createdAt: "2026-09-01T00:00:00Z",
          updatedAt: "2026-09-01T00:00:00Z",
        },
      ],
      interactions: [
        {
          id: "int_001",
          objectId: "obj_wf_001",
          input: "audio_bass",
          output: "scale_y",
          inputMin: 0,
          inputMax: 1,
          outputMin: 1,
          outputMax: 1.5,
          easing: "ease_out",
          smoothing: 0.6,
        },
      ],
    },
    status: "published",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  },
  {
    id: MOCK_IDS.SCENE_PARTICLE_BURST,
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    experienceId: MOCK_IDS.EXPERIENCE_MOONWAVE_MAIN,
    name: "Particle Burst",
    description: "클릭 시 파티클이 폭발하는 인터랙티브 씬",
    thumbnailUrl: null,
    schema: {
      ...makeEmptySchema(MOCK_IDS.SCENE_PARTICLE_BURST),
      audioTrackId: MOCK_IDS.TRACK_MOONWAVE_02,
      objects: [
        {
          id: "obj_pt_001",
          name: "Burst Particles",
          transform: {
            x: 960,
            y: 540,
            z: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
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
              count: 200,
              size: 3,
              speed: 5,
              spread: 360,
              color: "#e8192c",
              shape: "circle",
              lifetime: 1500,
              gravity: 0.1,
            },
          },
          visible: true,
          locked: false,
          parentId: null,
          createdAt: "2026-09-01T00:00:00Z",
          updatedAt: "2026-09-01T00:00:00Z",
        },
      ],
      interactions: [
        {
          id: "int_002",
          objectId: "obj_pt_001",
          input: "pointer_click",
          output: "particle_count",
          inputMin: 0,
          inputMax: 1,
          outputMin: 0,
          outputMax: 200,
          easing: "linear",
          smoothing: 0,
        },
      ],
    },
    status: "published",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  },
];

// ============================================================
// Experiences
// ============================================================

export const MOCK_EXPERIENCES: Experience[] = [
  {
    id: MOCK_IDS.EXPERIENCE_MOONWAVE_MAIN,
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    releaseId: MOCK_IDS.RELEASE_MOONWAVE,
    title: "Moonwave Experience",
    description: "Moonwave EP의 인터랙티브 음악 경험. 오디오 시각화와 팬 참여 아트워크를 통해 음악을 새롭게 체험하세요.",
    coverImageUrl: null,
    scenes: [
      {
        sceneId: MOCK_IDS.SCENE_WAVEFORM_HERO,
        order: 0,
        transitionType: "fade",
        transitionDuration: 800,
      },
      {
        sceneId: MOCK_IDS.SCENE_PARTICLE_BURST,
        order: 1,
        transitionType: "fade",
        transitionDuration: 600,
      },
    ],
    status: "published",
    currentVersionId: "expv_001",
    totalPlayCount: 2847,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
];

// ============================================================
// Campaigns
// ============================================================

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: MOCK_IDS.CAMPAIGN_MOONWAVE_FAN,
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    experienceId: MOCK_IDS.EXPERIENCE_MOONWAVE_MAIN,
    title: "Moonwave Fan Artwork",
    description: "Moonwave EP를 경험하고 당신만의 아트워크를 만들어보세요. 가장 인상적인 작품은 FREEPOLUS 공식 채널에 소개됩니다.",
    branding: {
      primaryColor: "#e8192c",
      backgroundColor: "#0a0a0a",
      backgroundImageUrl: null,
      logoUrl: null,
      tagline: "Your sound. Your vision.",
    },
    participationPolicy: {
      requireLogin: false,
      allowAnonymousCreate: true,
      maxArtworksPerUser: 5,
      moderationEnabled: true,
      autoPublishArtworks: false,
      defaultArtworkPermission: "public",
    },
    status: "active",
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-11-30T23:59:59Z",
    artworkCount: 843,
    participantCount: 623,
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-10-28T00:00:00Z",
  },
];

// ============================================================
// Fan Artworks
// ============================================================

export const MOCK_ARTWORKS: FanArtwork[] = [
  {
    id: MOCK_IDS.ARTWORK_FAN_001,
    campaignId: MOCK_IDS.CAMPAIGN_MOONWAVE_FAN,
    experienceVersionId: "expv_001",
    creatorId: MOCK_IDS.USER_FAN_1,
    sessionToken: null,
    title: "밤의 파장",
    imageUrl: null,
    customization: {
      versionId: "expv_001",
      sceneStates: {},
      captureFrameMs: 4500,
    },
    permission: "public",
    status: "published",
    likeCount: 34,
    shareCount: 8,
    createdAt: "2026-10-05T14:32:00Z",
    updatedAt: "2026-10-05T14:32:00Z",
  },
  {
    id: MOCK_IDS.ARTWORK_FAN_002,
    campaignId: MOCK_IDS.CAMPAIGN_MOONWAVE_FAN,
    experienceVersionId: "expv_001",
    creatorId: MOCK_IDS.USER_FAN_2,
    sessionToken: null,
    title: "Moon & Static",
    imageUrl: null,
    customization: {
      versionId: "expv_001",
      sceneStates: {},
      captureFrameMs: 7200,
    },
    permission: "public",
    status: "published",
    likeCount: 19,
    shareCount: 4,
    createdAt: "2026-10-07T09:15:00Z",
    updatedAt: "2026-10-07T09:15:00Z",
  },
];

// ============================================================
// Media Assets
// ============================================================

export const MOCK_ASSETS: MediaAsset[] = [
  {
    id: MOCK_IDS.ASSET_COVER_MOONWAVE,
    artistId: MOCK_IDS.ARTIST_FREEPOLUS,
    type: "image",
    filename: "moonwave-ep-cover.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024 * 512,
    url: "/mock/assets/moonwave-cover.jpg",
    thumbnailUrl: "/mock/assets/moonwave-cover-thumb.jpg",
    altText: "Moonwave EP Cover Art",
    tags: ["cover", "release"],
    usedIn: [{ releaseId: MOCK_IDS.RELEASE_MOONWAVE }],
    uploadedBy: MOCK_IDS.USER_ARTIST_FREEPOLUS,
    createdAt: "2026-08-20T00:00:00Z",
  },
];
