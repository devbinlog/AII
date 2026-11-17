"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";

const SIZES = {
  "1920x1080": { canvasWidth: 1920, canvasHeight: 1080, label: "Landscape 16:9 (1920×1080)" },
  "1080x1920": { canvasWidth: 1080, canvasHeight: 1920, label: "Portrait 9:16 (1080×1920)" },
  "1080x1080": { canvasWidth: 1080, canvasHeight: 1080, label: "Square (1080×1080)" },
} as const;

export function CreateSceneForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState<keyof typeof SIZES>("1920x1080");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { canvasWidth, canvasHeight } = SIZES[size];
    const res = await studioFetch<{ scene: { id: string } }>("/api/studio/scenes", "POST", { name, canvasWidth, canvasHeight });
    setBusy(false);
    if (res.ok) router.push(`/studio/scenes/${res.data.scene.id}`);
    else setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Scene name" id="new-scene-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      <Select
        label="Canvas"
        id="new-scene-size"
        value={size}
        onChange={(e) => setSize(e.target.value as keyof typeof SIZES)}
        options={Object.entries(SIZES).map(([value, s]) => ({ value, label: s.label }))}
      />
      <FormMessage result={result} />
      <Button type="submit" loading={busy}>Create scene</Button>
    </form>
  );
}
