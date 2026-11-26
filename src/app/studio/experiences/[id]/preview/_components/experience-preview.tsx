"use client";

import { useState } from "react";
import { ScenePreview } from "@/app/studio/scenes/[id]/_components/scene-preview";
import type { ExperienceScene, SceneSchema } from "@/types";

export interface PreviewScene {
  id: string;
  name: string;
  schema: SceneSchema;
  transitionType: ExperienceScene["transitionType"];
  transitionDuration: number;
}

/** Steps through the saved scene sequence in fan order, one live preview at a time. */
export function ExperiencePreview({ scenes }: { scenes: PreviewScene[] }) {
  const [index, setIndex] = useState(0);
  const scene = scenes[Math.min(index, scenes.length - 1)]!;

  return (
    <section aria-label="Scene sequence preview" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="h-9 px-3 text-sm border border-[var(--color-border)] hover:border-[var(--color-fg)] disabled:opacity-30"
        >
          ← Previous scene
        </button>
        <p className="flex-1 min-w-0 text-center text-sm" aria-live="polite">
          <span className="font-mono text-[var(--color-fg-muted)]">
            {index + 1} / {scenes.length}
          </span>{" "}
          <span className="font-medium">{scene.name}</span>
        </p>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(scenes.length - 1, i + 1))}
          disabled={index === scenes.length - 1}
          className="h-9 px-3 text-sm border border-[var(--color-border)] hover:border-[var(--color-fg)] disabled:opacity-30"
        >
          Next scene →
        </button>
      </div>

      {/* key: a fresh runtime per scene, as fans get on a scene change. */}
      <ScenePreview key={scene.id} schema={scene.schema} manualAudio={null} />

      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Scenes in order">
        {scenes.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? "step" : undefined}
              className={`h-8 px-3 border ${i === index ? "border-[var(--color-fg)] text-[var(--color-fg)]" : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"}`}
            >
              {i + 1}. {s.name}
              {i > 0 && <span className="ml-1 text-[var(--color-fg-subtle)]">({s.transitionType} {s.transitionDuration}ms)</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
