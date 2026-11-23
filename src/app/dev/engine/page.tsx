import { notFound } from "next/navigation";
import { EnginePlaygroundClient } from "./_components/playground-client";

export const dynamic = "force-dynamic";

/**
 * Engine Playground — development only.
 * Blocked by src/proxy.ts in production; this guard is defense in depth.
 */
export default function DevEnginePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <EnginePlaygroundClient />;
}
