# AII Visual Identity & Stage Design System

Status: applied incrementally (2026-11-17). Business logic, permissions and repository contracts unchanged except the additive Keys member (§5).
Screenshots: `docs/design/screenshots/` — same viewport before/after (1440×900 and 390×844, Edge).

## 1. UI audit (evidence: `before-*.png`)

| Screen | Works | Problems found |
|---|---|---|
| Home | Strong editorial display type (Geist 900, tight tracking); calm black/paper split | Hero right half empty; only two text lines carry the message; CTA is small text |
| Explore | Clear tabs + genre chips; DEMO notice | Large empty area with one artist; tab count badges mix red and grey for the same meaning |
| Artist | Huge name, mono caption labels, good rhythm of bordered sections | — (now gains a Live Stage section) |
| Campaign | Confident hero, stats row | **Everything is the same red**: status badge, tagline, Verified, DEMO notice — platform UI and Freefallers' brand color `#e8192c` are literally the same token, so artist identity and AII chrome are indistinguishable. Dates render in Korean while the UI is English |
| Experience | Immersive full-bleed canvas | **Defect:** HUD play button overlapped the "Create Artwork" CTA (`before-experience-1440.png`, bottom right) |
| Fan Creator | Clear parameter panel | Low-contrast secondary buttons (Undo/Redo at 40% opacity look disabled even when active) |
| Studio | Consistent dark shell, bordered panels | Primary buttons and error text share the same red; small red eyebrow text below AA on dark |
| Stage editor | Functional | All members were identical blue capsules (no role reading); locked items had no 3D cue; one sidebar mixed list + inspector; on phones the toolbar pushed the 3D view below the fold (`before-stage-editor-390.png`) |
| Public stage | Read-only viewer works | Same identical holograms; plain black void without spatial reference |

Cross-cutting: the hard-coded palette was scattered (`#e8192c` ×38, `#0a0a0a` ×42, `#f5f5f0` ×29, `rgba(232,25,44,…)` ×31), so "the brand color" and "the artist color" could not be changed independently.

## 2. Visual identity proposal

Keywords: Independent Music Editorial · Digital Art · Contemporary Experimental · Spatial Interface · Holographic Stage.

Three layers, each with its own palette and rules:

1. **AII platform** — editorial, paper and ink, one signal color. Calm so artist work is the loudest thing on screen.
2. **Artist identity** — the artist's branding colors and motion, only on artist-owned surfaces (profile hero, campaign, canvases, artwork).
3. **Stage** — spatial, luminous, on Void. Only inside 3D stage surfaces; global chrome never goes neon.

## 3. Color tokens (`src/app/globals.css`)

Contrast ratios are computed (WCAG 2.x), not estimated.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--aii-ink` | `#101114` | Dark UI surface, text on paper | 16.4 on paper |
| `--aii-paper` | `#F2EFE8` | Light UI surface | — |
| `--aii-signal` | `#E44942` | Graphics, large text, **accent text on dark** | 4.79 on ink |
| `--aii-signal-deep` | `#C2352F` | **Filled buttons/badges** (white text), accent text on paper | white 5.46 · on paper 4.76 |
| `--aii-stone` | `#A7A5A0` | Borders; muted text **on dark only** | 7.67 on ink · **2.14 on paper → never text on paper** |
| `--aii-stone-mid` | `#85837E` | Quiet (subtle) text on Ink / Ink-2 | 4.99 · 4.68 |
| `--aii-stone-deep` | `#666460` | Muted text on paper and paper-2 | 5.14 on Paper · 4.70 on Paper-2 (was `#6B6964`, 4.36 on Paper-2 — failed AA, fixed 2026-11-18) |
| `--aii-iris` / `--aii-iris-deep` | `#6863DE` / `#514CC4` | Secondary accent (UI/large) / as text on paper | 4.1 / 5.75 |
| `--stage-void` | `#08131F` | Stage background | paper 16.3 |
| `--stage-cyan` | `#38D9F2` | Vocal, stage accent text, CTA fill (Void text) | 11.0 on void |
| `--stage-blue` | `#367CFA` | Guitar, stage light | 4.83 on void |
| `--stage-violet` | `#A3A0FF` | Bass | 8.04 on void |
| `--stage-amber` | `#F5BC73` | Drums, "unsaved" indicator | 10.97 on void |

Conflict resolution:
- White text on `#E44942` is only 3.94:1, so fills use **Signal Deep**; Signal is for graphics and text on dark. A single value cannot pass both "white on it ≥ 4.5" and "on Ink ≥ 4.5" (verified), hence the split `--color-accent` (fill) / `--color-accent-fg` (text, per surface).
- Legacy tokens (`--color-black/white/red`) now point at the AII palette, so the 98 `var(--color-accent)` usages moved automatically. Platform notices (31 `rgba(232,25,44,…)`) moved to Signal.
- `#e8192c` stays where it is **Freefallers' color** (campaign hero, canvases, artwork placeholders). That is now the artist layer, not the platform.
- `--color-media-black #0a0a0a` remains behind canvases/artwork (true black for media).
- Scopes: `:root` (paper UI) · `.studio` (ink UI) · `.dark` · `.stage-theme` (Void + Stage palette).

## 4. Typography system (Geist; no new fonts)

| Role | Class / token | Spec | Use |
|---|---|---|---|
| Display | `.heading-display` | Geist Sans 900, −0.04em, uppercase, clamp up to 12rem | Artist names, page heroes |
| Editorial | `.heading-editorial` | Geist Sans 800, −0.03em | Section titles |
| UI title | `text-2xl/3xl font-semibold` | 600, tight | Studio page titles |
| Body | `--font-sans` | 400, 1.6 line-height | Copy |
| Caption | `.caption-label` | 12px 600, +0.1em, uppercase | Eyebrows, labels |
| Data | `--font-mono` | Geist Mono 10–12px uppercase | Coordinates, status, spatial labels |

Rules: one display line per view; mono only for data/state, never paragraphs; spatial labels are mono 10px uppercase on a Void chip with a role-colored rule.

## 5. Stage character system (`src/lib/stage/characters.ts`, `src/components/stage/hologram-characters.tsx`)

Shared language: faceless ellipsoid head, minimal anatomy (capsule limbs/torso), translucent body (opacity 0.5, depthWrite off), wireframe **only on the torso**, one emissive chest band, a faint light column. No armor, no faces, no operator/foreground avatar. All geometry is procedural; three.js, @react-three/fiber and drei are MIT, and no external models or fonts are loaded.

| Role | Hue | Silhouette / pose | Instrument | Base pattern (top view) |
|---|---|---|---|---|
| Vocal | Cyan `#38D9F2` | Upright, right arm raised to the mic | Handheld mic | 3 pulse rings |
| Guitar | Blue `#367CFA` | Wider stance, arms across the body | Short-neck body + neck | Ring + 8 ticks |
| Bass | Violet `#A3A0FF` | 6% taller, more vertical neck | Long-neck body | Double ring |
| Drums | Amber `#F5BC73` | Seated (bent legs), lower torso/head; sticks tap (static under reduced motion) | Sticks | Hexagon |
| Keys | Periwinkle `#7FA3FF` (Blue↔Violet midpoint) | Both arms forward over the keyboard | — (keyboard prop) | Square |

Selection: white `Outlines` on torso and head plus brighter opacity; instruments get a paper ring. Locked items: a dashed Signal-red ring plus "· locked" on their label. Stage scale: 1 unit = 1 m; members ≈1.8 m.

**Keys member (additive contract change):** `member-keys` joins the default layout. `normalizeStageLayout()` inserts default items missing from drafts saved earlier (on read, save and publish); existing coordinates and locks are untouched, and published versions are never migrated. Covered by unit tests.

## 6. Stage editor refinement

- Layout: **left** Session members / Instruments & backline · **center** 3D stage · **right** Inspector (X/Z in meters, rotation, lock state, nudge/rotate controls). Phones: stage first, panels below; toolbar scrolls horizontally.
- Stage grid on Void with blue section lines; Signal-red boundary = movement limit; **center axis marker** (X in Stone, Z toward the audience in Cyan, center ring); audience-edge rule.
- Camera presets with smooth transitions (instant under `prefers-reduced-motion`), Reset camera, **Focus mode** (hides side panels, taller viewport, Esc exits), **Labels** toggle.
- Spatial labels are DOM tags positioned by per-frame projection in an overlay (no drei `Html` → no extra React roots; this removed a React "synchronously unmount a root" error seen during the change).
- Save feedback: status dot (Amber = unsaved, Cyan = saved) + "Saved hh:mm"; publish state in the same bar.
- Unchanged: orbit/pan/zoom, drag on the floor plane, locks, boundary clamping, coordinate save/restore, undo/redo, publish rules (all E2E-verified).

## 7. Artist-specific identity (`src/lib/theme/artist-theme.ts`)

`getArtistTheme(artist)` derives a theme from the existing `Artist.branding` (no new stored fields): primary/secondary/accent/background (validated hex, AII fallback — no CSS injection), type preset from `fontFamily`, motion intensity from `motionPreset` (0/1/2), and scoped `--artist-*` CSS variables.

| Artist-themeable | AII-only (never themed) |
|---|---|
| Profile hero, campaign hero/landing, experience & fan-creator canvases, artwork treatment, Live Stage header rule | Navbar, footer, Studio chrome, forms, buttons, status/feedback colors, DEMO notices, focus rings, type scale, Stage palette |

## 8. Accessibility & performance

- Contrast: see §3 (computed). Studio small accent text moved to `--color-accent-fg` (4.79:1 on ink, was 3.46:1 with the fill color). DEMO notice text is now opaque Signal (was 80% alpha).
- Keyboard: object lists and inspector controls are buttons with `aria-pressed`; arrows/Q/E/Esc; Focus mode exits with Esc; labels overlay is `aria-hidden` (the lists carry the names).
- Reduced motion: hologram bob and drum taps off; camera presets jump instantly (E2E).
- WebGL unavailable → text fallback, lineup still listed (E2E).
- Performance: three.js (941 KB raw / 248 KB gzip chunk) loads **only** on `/studio/stage` and `/artists/[slug]/stage` (dynamic import; verified per route). Stage view held ~61 rAF/s in headless Edge with SwiftShader (software GL). Characters are low-poly primitives.

## 9. Remaining issues

- Home hero composition (empty right half) and Explore empty-state density are noted, not redesigned in this pass.
- Many inline `#0a0a0a`/`#f5f5f0` remain in fan pages (media black / text-on-dark); converge onto tokens gradually.
- Campaign/release dates use Korean formatting inside an English UI (`lang="ko"`); pick one locale strategy.
- Spatial labels can overlap when members line up front-to-back (e.g. front view); toggle exists, no collision avoidance yet.
- `THREE.Clock` deprecation warning comes from @react-three/fiber internals.
- No automated axe audit (would add a dependency); checks above are computed/manual + E2E.


## 2026-11-18 — contrast and locale follow-up

- `--color-fg-subtle` is only ever used for text, but resolved to Stone on Paper (2.14:1), `#55534f` in Studio (2.6:1) and neutral-600 in `.dark` (1.9:1). It now resolves per theme to the quietest shade that passes AA: Stone Deep on Paper, `--aii-stone-mid` in Studio, `#808080` in `.dark`. Stone remains a border colour.
- `--aii-stone-deep` darkened `#6B6964 → #666460` so muted text also passes on Paper-2 (4.36 → 4.70).
- Home and Explore no longer use Freefallers' `#e8192c` for platform chrome (kickers, verified marks, CTAs); it appears only on artist-owned surfaces (covers, artist panel, swatches) via `artist.branding`.
- Display locale is explicit: `UI_LOCALE = "en-US"`, `DISPLAY_TIME_ZONE = "UTC"` in `src/lib/utils/format.ts`. Storage stays ISO 8601.
