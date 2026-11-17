# WS-05 Artist Studio — Readiness & Implementation Plan

Status: **Ready to start** (prepared 2026-11-17, base commit `addf3b2` + Windows verification fixes)
Mode: `MOCK_ONLY` — no real DB / API / storage. Production adapters stay out of scope.

## 1. Preconditions (verified)

| Item | State |
|---|---|
| Phase 0 / WS-02 / WS-04 / WS-03 on `main` | Present, builds, 117 unit+contract / 261 E2E (Edge, Chrome, mobile Edge) passing |
| Repository interfaces for Studio data | Present in `src/lib/adapters/interfaces.ts` (see §3) |
| Roles | `artist_editor`, `artist_admin`, `platform_admin`, `platform_owner` in `UserRole`; mock user `studio@freefallers.com` (`artist_admin`, Freefallers) |
| Studio entry point | Navbar links to `/studio` — **route does not exist yet (404)** |
| Artwork authorization helpers | `src/lib/auth/artwork-access.ts`, `src/lib/auth/request-session.ts` — reuse the pattern for Studio guards |

## 2. Routes

All under `src/app/studio/`, server-guarded (redirect to `/login?redirect=…` when no session; 403 page when role is not artist-level or the artist does not match `session.artistId`).

| Route | Feature |
|---|---|
| `/studio` | Artist Dashboard |
| `/studio/identity` | Identity Editor |
| `/studio/releases`, `/studio/releases/[id]` | Release Manager |
| `/studio/media` | Media Manager |
| `/studio/scenes`, `/studio/scenes/[id]` | Scene Editor |
| `/studio/scenes/[id]/interactions` | Interaction Builder |
| `/studio/experiences`, `/studio/experiences/[id]` | Experience Publisher |
| `/studio/campaigns`, `/studio/campaigns/[id]` | Campaign Builder |
| `/studio/analytics` | Analytics |
| `/studio/stage` | 3D Stage Configurator (separate module, §5) |

API routes go under `src/app/api/studio/**` and must check: valid session → artist role → `resource.artistId === session.artistId` (platform admins may bypass). Add contract tests in the style of `src/app/api/__tests__/artworks.contract.test.ts`.

## 3. Feature → existing repository mapping

| Feature | Existing methods | Gap to add |
|---|---|---|
| Dashboard | `release.listByArtist`, `experience.listByArtist`, `campaign.listByArtist`, `analytics.getCampaignSummary` | none |
| Identity Editor | `artist.findById`, `artist.update`, `artist.checkSlugAvailable` | Zod validator for `UpdateArtistRequest` |
| Release Manager | `release.listByArtist/create/update/delete/publish` | none |
| Media Manager | `media.listByArtist/prepareUpload/confirmUpload/delete` | mock upload = local object URL only; no storage |
| Scene Editor | `scene.findById/save/duplicate/listVersionHistory`, `validateSceneSchema` (`src/lib/engine/schema.ts`), `SceneRuntime` + `Canvas2DRenderer` | **Timeline**: today only scene `duration` + a stub `timeline_trigger` input (`inputs.timelineMs > 0`). Keyframes / cue points need a schema extension (bump `SCENE_SCHEMA_VERSION`) |
| Interaction Builder | `InteractionMapping` + `InteractionMappingZod`, `InteractionEngine` | UI only |
| Experience Publisher | `experience.create/update/publish` (creates frozen `ExperienceVersion`) | none |
| Campaign Builder | `campaign.create/update/publish/end`, `CampaignParticipationPolicy`, `CampaignBranding` | none |
| Analytics | `analytics.getCampaignSummary`, `analytics.trackEvent` | mock data is synthetic; label it `DEMO` like the gallery |

## 4. Suggested order

1. Studio shell + guard + Dashboard (unblocks the navbar 404).
2. Identity Editor, Release Manager (plain CRUD, low risk).
3. Campaign Builder, Experience Publisher.
4. Scene Editor (+ timeline schema extension), Interaction Builder.
5. Media Manager, Analytics.
6. Stage Configurator (independent; can run in parallel after step 1).

## 5. 3D Stage Configurator — separate module

Kept isolated so the 2D engine (`src/lib/engine`) and the rest of Studio do not depend on 3D code.

```
src/lib/stage/                 # framework-free core (unit-testable, no DOM)
  types.ts                     # StageLayout, StageItem, CameraState
  layout.ts                    # move/rotate/snap; rejects edits to locked items
  serialize.ts                 # versioned JSON <-> StageLayout (Zod)
  presets.ts                   # default band layout (Freefallers)
  __tests__/
src/components/stage/          # client-only rendering (dynamic import, ssr:false)
  stage-canvas.tsx             # renderer + camera controls
  performer-hologram.tsx
  instrument.tsx
  stage-toolbar.tsx            # save / restore / reset / center camera
src/app/studio/stage/page.tsx
```

Data model (draft):

```ts
type StageItemKind = "performer" | "instrument" | "amplifier" | "drums" | "light";
interface StageItem {
  id: string; kind: StageItemKind; label: string;
  position: [number, number, number]; rotationY: number;
  locked: boolean;            // amplifiers & drums default to locked
  hologram?: { color: string; opacity: number; scanlines: boolean };
}
interface CameraState { target: [number, number, number]; position: [number, number, number]; zoom: number }
interface StageLayout { version: 1; artistId: string; items: StageItem[]; camera: CameraState; updatedAt: string }
```

Requirements mapping:

| Requirement | Design |
|---|---|
| Orbit / Pan / Zoom | Orbit controls with clamped polar angle and zoom range |
| Stage Center Camera | Toolbar action resets `camera.target` to stage origin |
| Hologram Performers | Emissive translucent material + scanline shader; no real performer media |
| Movable Performers / Instruments | Drag on the stage floor plane, grid snap, collision-free bounds |
| Locked Amplifiers / Drums | `locked: true`; `layout.ts` refuses moves; UI shows lock icon; only `artist_admin` can unlock |
| Layout Save / Restore | New `StageLayoutRepository { get(artistId); save(layout); listVersions(artistId) }` in interfaces + mock store (`globalThis` store, like the others) |
| Accessibility / fallback | Keyboard nudge for selected item; 2D top-down fallback when WebGL is unavailable; respects `prefers-reduced-motion` |

**Decision needed before step 6:** the project has no 3D dependency. Options: `three` (+ `@react-three/fiber`/`drei`) or a smaller hand-rolled WebGL layer. Adding packages changes `package-lock.json`; get approval first.

## 6. Known items to carry into WS-05

- Next.js 16.4.3 is flagged by `npm audit` (GHSA-mfr8-8qww-v76h, fixed in ≥16.4.5) — upgrade pending approval.
- `src/middleware.ts` uses the deprecated `middleware` convention (Next 16 prefers `proxy`); works today.
- One report immediately sets an artwork to `flagged` (hidden from gallery). Consider a threshold or moderation queue before real users.
- HUD Play button on the experience page stays in the tab order behind the pre-play overlay.
- Firefox / WebKit E2E have not run on Windows (Playwright browser download blocked by TLS inspection); run them on macOS or CI.
