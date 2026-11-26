// @vitest-environment node
/**
 * WS-08 draft preview is owner-only on the server: the page itself (not the UI
 * around it) refuses another artist's experience with a 404, and renders the
 * owner's saved draft. Mock repository; session resolved through the real
 * getStudioAccess with a mocked cookie session.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Session } from "@/types";

vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});

let current: Session | null = null;
vi.mock("@/lib/auth/session", () => ({ getSession: async () => current }));

class NotFound extends Error {}
class Redirect extends Error {}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

import { getRepository } from "@/lib/repository";
import PreviewPage from "../page";

const session = (patch: Partial<Session>): Session => ({ userId: "usr_test", role: "artist_admin", artistId: "art_001", ...patch }) as Session;
const render = (id: string) => PreviewPage({ params: Promise.resolve({ id }) });

/** Every string in a server-rendered element tree (cycle-safe; client components are not executed). */
function textOf(node: unknown, seen = new Set<unknown>()): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || seen.has(node)) return "";
  seen.add(node);
  if (Array.isArray(node)) return node.map((n) => textOf(n, seen)).join(" ");
  const props = (node as { props?: Record<string, unknown> }).props;
  return props ? Object.values(props).map((v) => textOf(v, seen)).join(" ") : "";
}

let otherArtistId: string;
let otherExperienceId: string;

beforeAll(async () => {
  const repo = getRepository();
  const other = await repo.artist.create({ slug: "preview-other", name: "Preview Other", bio: "", genre: [] }, "test");
  otherArtistId = other.id;
  otherExperienceId = (await repo.experience.create({ artistId: other.id, title: "OTHER_DRAFT", description: "" })).id;
});

describe("/studio/experiences/[id]/preview", () => {
  it("another artist's admin gets 404 for Freefallers' draft, and vice versa", async () => {
    current = session({ artistId: otherArtistId });
    await expect(render("exp_001")).rejects.toBeInstanceOf(NotFound);
    current = session({ artistId: "art_001" });
    await expect(render(otherExperienceId)).rejects.toBeInstanceOf(NotFound);
  });

  it("anonymous visitors are redirected to login; fans get the forbidden page, not the draft", async () => {
    current = null;
    await expect(render("exp_001")).rejects.toBeInstanceOf(Redirect);
    current = session({ role: "fan", artistId: null });
    const el = await render("exp_001");
    expect(textOf(el)).not.toContain("Moonwave");
  });

  it("the owner sees the draft preview", async () => {
    current = session({ artistId: "art_001" });
    const el = await render("exp_001");
    const text = textOf(el);
    expect(text).toContain("Draft preview");
    expect(text).toContain("Moonwave Experience");
  });
});
