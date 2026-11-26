// Loads what buildExperienceReadiness / buildStudioFlow need, scoped to one artist.
// Takes the repository as an argument so callers (pages, routes, tests) choose it.

import type { RepositoryRegistry } from "@/lib/adapters/interfaces";
import { buildExperienceReadiness, buildStudioFlow, type ExperienceReadiness, type StudioFlow } from "./readiness";
import type { Artist, Experience, Scene } from "@/types";

const ALL = { page: 1, pageSize: 200 } as const;

/** Caller must already have checked that `experience` belongs to the acting artist. */
export async function loadExperienceReadiness(repo: RepositoryRegistry, experience: Experience): Promise<ExperienceReadiness> {
  const sceneIds = new Set([...experience.scenes.map((s) => s.sceneId), ...experience.editableParameters.map((p) => p.sceneId)]);
  const scenesById = new Map<string, Scene | null>();
  for (const id of sceneIds) scenesById.set(id, await repo.scene.findById(id));
  const [versions, { campaigns }, release] = await Promise.all([
    repo.experience.listVersions(experience.id),
    repo.campaign.listByArtist(experience.artistId, ALL),
    experience.releaseId ? repo.release.findById(experience.releaseId) : Promise.resolve(null),
  ]);
  return buildExperienceReadiness({ experience, scenesById, versions, campaigns, release });
}

export async function loadStudioFlow(repo: RepositoryRegistry, artist: Artist): Promise<StudioFlow> {
  const [{ releases }, { scenes }, { experiences }, { campaigns }, saved, publication, versions] = await Promise.all([
    repo.release.listByArtist(artist.id, ALL),
    repo.scene.listByArtist(artist.id, ALL),
    repo.experience.listByArtist(artist.id, ALL),
    repo.campaign.listByArtist(artist.id, ALL),
    repo.stage.get(artist.id),
    repo.stage.getPublication(artist.id),
    repo.stage.listVersions(artist.id),
  ]);
  const publicId = publication?.visibility === "public" ? publication.publishedVersionId : null;
  const publicVersion = publicId ? (versions.find((v) => v.id === publicId)?.version ?? null) : null;
  return buildStudioFlow({ artist, releases, scenes, experiences, campaigns, stage: { saved: saved !== null, publicVersion } });
}
