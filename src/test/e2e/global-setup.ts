import type { FullConfig } from "@playwright/test";

/**
 * Test isolation: every E2E run starts from the mock fixtures, so data created by
 * earlier runs (campaigns, stage versions, artworks) never accumulates.
 * Sessions are kept, so a developer signed in to the same dev server stays signed in.
 * Opt out with E2E_RESET_MOCK=0.
 */
export default async function globalSetup(config: FullConfig) {
  if (process.env["E2E_RESET_MOCK"] === "0") return;
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const res = await fetch(new URL("/api/dev/reset-mock", baseURL), { method: "POST" });
  if (!res.ok) throw new Error(`Mock reset failed (${res.status}). Is the dev server running in MOCK_ONLY mode?`);
}
