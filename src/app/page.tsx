// force-dynamic: getRepository() accesses in-memory mock adapter (Node.js singleton).
// The adapter's state is mutable at runtime, so static generation would produce stale HTML.
// In production mode, a real data layer would allow static generation with revalidation.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { isPublicRelease } from "@/lib/public-visibility";
import { MOCK_IDS } from "@/lib/mock/fixtures";
import { formatCount, formatDate, formatDuration } from "@/lib/utils/format";
import { defaultStageLayout, type StageItem } from "@/lib/stage";
import { SoundPlate } from "@/components/editorial/sound-plate";
import { StageSchematic } from "@/components/stage/stage-schematic";
import type { Release, Artist, Campaign } from "@/types";

// Colour layers on this page:
//  • AII platform  — Ink / Paper / Stone, Signal Red only for the playhead, kicker and primary focus.
//  • Artist layer  — artist.branding.* (Freefallers' own red), used only on artist-owned surfaces.
//  • Stage layer   — Stage palette tokens inside the stage preview.

function ReleaseCover({ color, title }: { color: string; title: string }) {
  return (
    <div className="aspect-square relative overflow-hidden bg-[var(--color-media-black)]" aria-hidden="true">
      <svg viewBox="0 0 400 400" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <circle cx="200" cy="200" r="190" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
        <circle cx="200" cy="200" r="140" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" />
        <circle cx="200" cy="200" r="90" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
        <circle cx="200" cy="200" r="40" fill={color} opacity="0.15" />
        <line x1="0" y1="200" x2="400" y2="200" stroke={color} strokeWidth="0.5" opacity="0.2" />
        <line x1="200" y1="0" x2="200" y2="400" stroke={color} strokeWidth="0.5" opacity="0.2" />
      </svg>
      <span className="absolute left-4 bottom-4 heading-display text-2xl text-[var(--aii-paper)]">{title}</span>
    </div>
  );
}

function Kicker({ children, tone = "paper" }: { children: React.ReactNode; tone?: "paper" | "ink" }) {
  return (
    <p className={`caption-label flex items-center gap-3 ${tone === "ink" ? "text-[var(--aii-stone)]" : "text-[var(--color-fg-muted)]"}`}>
      <span className="h-px w-8 bg-current" aria-hidden="true" />
      {children}
    </p>
  );
}

function Hero({ stageHref }: { stageHref: string }) {
  return (
    <section className="relative overflow-hidden bg-[var(--aii-ink)] text-[var(--aii-paper)]">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 pt-10 pb-12 md:pt-14 md:pb-16">
        <div className="flex items-center justify-between gap-4">
          <p className="caption-label text-[var(--aii-signal)]">Make Your Sound Visible</p>
          <p className="caption-label hidden sm:block text-[var(--aii-stone)]">Independent Music Editorial × Digital Art</p>
        </div>

        <div className="mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
          <div className="lg:col-span-7">
            <h1 className="heading-display" style={{ fontSize: "clamp(6rem, 17vw, 17rem)", lineHeight: 0.84, letterSpacing: "-0.05em" }}>
              AII
            </h1>
            <p className="mt-8 max-w-md text-lg leading-snug text-[var(--aii-paper)]">
              Artists turn their music into interactive experiences. Fans step inside, play with it, and make work of their own.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/explore"
                className="inline-flex h-12 items-center px-6 text-sm font-semibold bg-[var(--aii-paper)] text-[var(--aii-ink)] hover:bg-[var(--aii-signal)] hover:text-[var(--aii-ink)] transition-colors"
              >
                Discover Artists →
              </Link>
              <Link href={stageHref} className="text-sm font-semibold text-[var(--aii-paper)] underline decoration-[var(--aii-stone)] underline-offset-4 hover:decoration-[var(--aii-paper)]">
                Enter the 3D stage
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <SoundPlate />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedArtist({ artist }: { artist: Artist }) {
  const b = artist.branding;
  const swatches = [
    { name: "Primary", value: b.primaryColor },
    { name: "Secondary", value: b.secondaryColor },
    { name: "Accent", value: b.accentColor },
    { name: "Background", value: b.backgroundColor },
  ].filter((s): s is { name: string; value: string } => typeof s.value === "string" && s.value.length > 0);
  return (
    <section className="border-b border-[var(--color-border)]" aria-labelledby="featured-artist">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
        {/* Artist-owned surface: drawn in the artist's own branding */}
        <Link
          href={`/artists/${artist.slug}`}
          className="md:col-span-5 group relative block aspect-[4/3] md:aspect-auto md:min-h-[26rem] overflow-hidden"
          style={{ backgroundColor: b.backgroundColor ?? "var(--color-media-black)" }}
          aria-label={`${artist.name} — artist profile`}
        >
          <svg viewBox="0 0 400 500" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <rect key={i} x={i * 50} y="0" width="1" height="500" fill={b.primaryColor} opacity={0.08 + i * 0.02} />
            ))}
            <circle cx="290" cy="170" r="120" fill="none" stroke={b.primaryColor} strokeWidth="1" opacity="0.5" />
            <circle cx="290" cy="170" r="60" fill={b.primaryColor} opacity="0.18" />
          </svg>
          <span className="absolute left-5 bottom-5 right-5 heading-display text-[clamp(2.5rem,6vw,5rem)] leading-[0.86]" style={{ color: b.accentColor ?? "var(--aii-paper)" }}>
            {artist.name}
          </span>
          <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-wider" style={{ color: b.accentColor ?? "var(--aii-paper)", opacity: 0.8 }}>
            Artist branding
          </span>
        </Link>

        <div className="md:col-span-7 flex flex-col">
          <Kicker>Featured artist</Kicker>
          <h2 id="featured-artist" className="heading-editorial mt-5 text-[clamp(2.5rem,6vw,5rem)]">{artist.name}</h2>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Genres">
            {artist.genre.map((g) => (
              <li key={g} className="border border-[var(--color-border-strong)] px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
                {g}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-xl leading-relaxed text-[var(--color-fg)]">{artist.bio}</p>

          <div className="mt-8 border-t border-[var(--color-border)] pt-6">
            <p className="caption-label text-[var(--color-fg-muted)]">Artist visual identity</p>
            <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {swatches.map((s) => (
                <li key={s.name} className="flex min-w-0 items-center gap-3">
                  <span className="h-10 w-10 shrink-0 border border-[var(--color-border-strong)]" style={{ backgroundColor: s.value }} aria-hidden="true" />
                  <span className="leading-tight">
                    <span className="block text-xs font-semibold">{s.name}</span>
                    <span className="block font-mono text-[11px] uppercase text-[var(--color-fg-muted)]">{s.value}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--color-fg-muted)]">Set by the artist in Artist Studio. AII never repaints an artist&apos;s identity.</p>
          </div>

          <div className="mt-auto pt-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-3xl font-bold tabular-nums">{formatCount(artist.followerCount)}</p>
              <p className="caption-label text-[var(--color-fg-muted)]">Followers</p>
            </div>
            <Link
              href={`/artists/${artist.slug}`}
              className="inline-flex h-11 items-center px-5 text-sm font-semibold border border-[var(--color-fg)] hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)] transition-colors"
            >
              View artist profile →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReleaseAndExperience({ release, campaign, artist }: { release: Release; campaign: Campaign | null; artist: Artist | null }) {
  const color = artist?.branding.primaryColor ?? "var(--aii-stone)";
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]" aria-labelledby="featured-release">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-12 gap-6 sm:gap-8">
          <div className="sm:col-span-5 max-w-[15rem] sm:max-w-none">
            <ReleaseCover color={color} title={release.title} />
          </div>
          <div className="sm:col-span-7">
            <Kicker>Latest release</Kicker>
            <p className="mt-5 font-mono text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              {release.type} · {formatDate(release.releaseDate, { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <h2 id="featured-release" className="heading-editorial mt-2 text-[clamp(2rem,4vw,3.25rem)]">{release.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">{release.description}</p>
            <ol className="mt-6 border-t border-[var(--color-border)]">
              {release.tracks.map((track) => (
                <li key={track.id} className="flex items-center gap-4 border-b border-[var(--color-border)] py-2.5 text-sm">
                  <span className="w-6 font-mono text-xs text-[var(--color-fg-muted)]">{String(track.position).padStart(2, "0")}</span>
                  <span className="flex-1 font-medium">{track.title}</span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-fg-muted)]">{formatDuration(track.durationMs)}</span>
                </li>
              ))}
            </ol>
            <Link href={`/releases/${release.id}`} className="mt-6 inline-block text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-accent)]">
              Release details →
            </Link>
          </div>
        </div>

        {campaign && (
          <article className="lg:col-span-5 flex flex-col bg-[var(--aii-ink)] text-[var(--aii-paper)] p-6 sm:p-8" aria-labelledby="featured-experience">
            <div className="flex items-center justify-between gap-3">
              <Kicker tone="ink">Interactive experience</Kicker>
              {campaign.status === "active" && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--aii-paper)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--aii-signal)]" aria-hidden="true" />
                  Live
                </span>
              )}
            </div>
            <h3 id="featured-experience" className="heading-editorial mt-6 text-[clamp(1.75rem,3vw,2.5rem)]">{campaign.title}</h3>
            {campaign.branding.tagline && <p className="mt-2 text-sm italic text-[var(--aii-stone)]">&ldquo;{campaign.branding.tagline}&rdquo;</p>}
            <p className="mt-4 text-sm leading-relaxed text-[var(--aii-paper)]/85 line-clamp-3">{campaign.description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-px bg-[color:rgb(167_165_160/0.25)]">
              <div className="bg-[var(--aii-ink)] py-3 pr-3">
                <dt className="caption-label text-[var(--aii-stone)]">Participants</dt>
                <dd className="font-mono text-2xl font-bold tabular-nums">{formatCount(campaign.participantCount)}</dd>
              </div>
              <div className="bg-[var(--aii-ink)] py-3 pl-3">
                <dt className="caption-label text-[var(--aii-stone)]">Artworks</dt>
                <dd className="font-mono text-2xl font-bold tabular-nums">{formatCount(campaign.artworkCount)}</dd>
              </div>
            </dl>
            {campaign.endsAt && <p className="mt-4 text-xs text-[var(--aii-stone)]">Open until {formatDate(campaign.endsAt, { year: "numeric", month: "long", day: "numeric" })}</p>}
            <div className="mt-auto pt-8 flex flex-wrap gap-3">
              <Link
                href={`/campaigns/${campaign.slug}/experience`}
                className="inline-flex h-11 items-center px-5 text-sm font-semibold bg-[var(--aii-signal-deep)] text-white hover:bg-[var(--aii-signal-press)] transition-colors"
              >
                Enter the experience →
              </Link>
              <Link href={`/campaigns/${campaign.slug}`} className="inline-flex h-11 items-center px-4 text-sm font-semibold border border-[color:rgb(167_165_160/0.5)] hover:border-[var(--aii-paper)] transition-colors">
                About the campaign
              </Link>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function StagePreview({ artist, items, published, href }: { artist: Artist | null; items: StageItem[]; published: { version: number } | null; href: string }) {
  return (
    <section className="bg-[var(--stage-void)] text-[var(--aii-paper)]" aria-labelledby="stage-preview">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="lg:col-span-5">
          <p className="caption-label text-[var(--stage-cyan)]">Interactive preview · Live Stage</p>
          <h2 id="stage-preview" className="heading-editorial mt-5 text-[clamp(2rem,4vw,3.25rem)]">
            {published && artist ? `Step onto ${artist.name}${artist.name.endsWith("s") ? "'" : "'s"} stage` : "The band, as a stage you can walk around"}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--aii-stone)]">
            Hologram members and their gear in 3D. Orbit, zoom and switch between top, front and side views. Artists arrange it in Studio; fans see only the published version.
          </p>
          <Link
            href={href}
            className="mt-8 inline-flex h-11 items-center px-5 text-sm font-semibold border border-[var(--stage-cyan)] text-[var(--stage-cyan)] hover:bg-[var(--stage-cyan)] hover:text-[var(--stage-void)] transition-colors"
          >
            {published ? "Enter the 3D stage →" : "See live stages →"}
          </Link>
        </div>
        <figure className="lg:col-span-7 lg:col-start-6 w-full max-w-3xl justify-self-end">
          <StageSchematic items={items} title={published && artist ? `${artist.name} stage, top view` : "AII stage format, top view"} />
          <figcaption className="mt-3 flex justify-between gap-4 font-mono text-[11px] uppercase tracking-wider text-[var(--aii-stone)]">
            <span>{published && artist ? `${artist.name} · stage v${published.version}` : "Stage format preview — not an artist's published stage"}</span>
            <span>Top view</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Curated({ release, campaign, stage }: { release: Release | null; campaign: Campaign | null; stage: { href: string; meta: string } }) {
  const rows = [
    release && { verb: "Listen", title: release.title, meta: `${release.tracks.length} tracks · ${release.type}`, href: `/releases/${release.id}` },
    campaign && { verb: "Make", title: "Create your artwork", meta: campaign.title, href: `/campaigns/${campaign.slug}/create` },
    { verb: "Explore", title: "Artists & releases", meta: "The full index", href: "/explore" },
    campaign && { verb: "See", title: "Fan gallery", meta: `${formatCount(campaign.artworkCount)} artworks`, href: `/campaigns/${campaign.slug}/gallery` },
    { verb: "Together", title: "On stage with the band", meta: stage.meta, href: stage.href },
  ].filter((r): r is { verb: string; title: string; meta: string; href: string } => !!r);
  return (
    <section className="border-b border-[var(--color-border)]" aria-labelledby="curated">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4">
          <Kicker>Curated</Kicker>
          <h2 id="curated" className="heading-editorial mt-5 text-[clamp(2rem,4vw,3rem)]">Picked this week</h2>
        </div>
        <ol className="md:col-span-8 border-t border-[var(--color-fg)]">
          {rows.map((r, i) => (
            <li key={r.href}>
              <Link href={r.href} className="group grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[3rem_6rem_1fr_auto] items-baseline gap-x-4 border-b border-[var(--color-border)] py-5">
                <span className="font-mono text-xs text-[var(--color-fg-muted)]">{String(i + 1).padStart(2, "0")}</span>
                <span className="hidden sm:block caption-label text-[var(--color-fg-muted)]">{r.verb}</span>
                <span className="min-w-0">
                  <span className="block heading-editorial text-2xl sm:text-3xl group-hover:text-[var(--color-accent)] transition-colors">{r.title}</span>
                  <span className="mt-1 block text-sm text-[var(--color-fg-muted)] truncate">{r.meta}</span>
                </span>
                <span className="text-xl transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const repo = getRepository();
  const [featuredArtist, releaseResult, campaignResult, publishedStage] = await Promise.all([
    repo.artist.findById(MOCK_IDS.ARTIST_FREEFALLERS),
    repo.release.listByArtist(MOCK_IDS.ARTIST_FREEFALLERS, { page: 1, pageSize: 50 }),
    repo.campaign.listPublic({ page: 1, pageSize: 1, status: "active" }),
    repo.stage.getPublished(MOCK_IDS.ARTIST_FREEFALLERS),
  ]);

  const featuredRelease = releaseResult.releases.find(isPublicRelease) ?? null;
  const activeCampaign = campaignResult.campaigns[0] ?? null;
  const stageHref = publishedStage && featuredArtist ? `/artists/${featuredArtist.slug}/stage` : "/stage";
  // Unpublished: show the platform's stage format, clearly captioned, never a draft.
  const stageItems = publishedStage?.items ?? defaultStageLayout("preview").items;

  return (
    <main className="flex-1">
      <Hero stageHref={stageHref} />
      {featuredArtist && <FeaturedArtist artist={featuredArtist} />}
      {featuredRelease && <ReleaseAndExperience release={featuredRelease} campaign={activeCampaign} artist={featuredArtist} />}
      <StagePreview artist={featuredArtist} items={stageItems} published={publishedStage ? { version: publishedStage.version } : null} href={stageHref} />
      <Curated
        release={featuredRelease}
        campaign={activeCampaign}
        stage={{ href: stageHref, meta: publishedStage && featuredArtist ? `${featuredArtist.name} · 3D stage v${publishedStage.version}` : "The 3D hologram stage" }}
      />

      {/* For artists */}
      <section className="bg-[var(--aii-ink)] text-[var(--aii-paper)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-16 md:py-20">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-px border border-[color:rgb(167_165_160/0.2)] bg-[color:rgb(167_165_160/0.2)]">
          <Link href="/explore" className="group bg-[var(--aii-ink)] p-8 md:p-10 hover:bg-[var(--aii-ink-2)] transition-colors">
            <p className="caption-label text-[var(--aii-stone)]">01 · For listeners</p>
            <h3 className="heading-editorial mt-4 text-4xl">Find your next sound</h3>
            <p className="mt-3 text-sm text-[var(--aii-stone)]">Independent artists, releases and live campaigns.</p>
            <span className="mt-6 inline-block text-sm font-semibold text-[var(--aii-signal)]">Browse Explore →</span>
          </Link>
          <Link href="/studio" className="group bg-[var(--aii-ink)] p-8 md:p-10 hover:bg-[var(--aii-ink-2)] transition-colors">
            <p className="caption-label text-[var(--aii-stone)]">02 · For artists</p>
            <h3 className="heading-editorial mt-4 text-4xl">Build the experience</h3>
            <p className="mt-3 text-sm text-[var(--aii-stone)]">Identity, scenes, campaigns and your 3D stage, in Artist Studio.</p>
            <span className="mt-6 inline-block text-sm font-semibold text-[var(--aii-paper)] underline underline-offset-4">Open Artist Studio →</span>
          </Link>
         </div>
        </div>
      </section>
    </main>
  );
}
