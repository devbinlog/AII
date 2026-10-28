/**
 * AII — Repository Provider
 * Central access point for all repositories.
 * Switches between mock and production adapters based on environment.
 *
 * SAFETY: Mock adapters are blocked in production builds.
 */

import type { RepositoryRegistry } from "./adapters/interfaces";

let _registry: RepositoryRegistry | null = null;

export function getRepository(): RepositoryRegistry {
  if (_registry) return _registry;

  const mode = process.env["NEXT_PUBLIC_DATA_MODE"] ?? "MOCK_ONLY";

  if (mode === "MOCK_ONLY") {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "[AII] MOCK_ONLY mode is not allowed in production. " +
        "Set NEXT_PUBLIC_DATA_MODE=production and configure real adapters."
      );
    }
    // Dynamic import to ensure mock code is tree-shaken from prod builds
    // (This function is only called at runtime, so the static import below is fine for dev)
    const { mockRegistry } = require("./mock/adapters") as {
      mockRegistry: RepositoryRegistry;
    };
    _registry = mockRegistry;
    return _registry;
  }

  throw new Error(
    `[AII] Unknown NEXT_PUBLIC_DATA_MODE: "${mode}". ` +
    "Production adapters are not yet connected. See docs/OWNER_SETUP.md."
  );
}

/** Reset registry (for tests) */
export function resetRepository(): void {
  _registry = null;
}
