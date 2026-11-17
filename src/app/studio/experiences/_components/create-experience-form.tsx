"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";

export function CreateExperienceForm({ releases }: { releases: { id: string; title: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await studioFetch<{ experience: { id: string } }>("/api/studio/experiences", "POST", { title, ...(releaseId ? { releaseId } : {}) });
    setBusy(false);
    if (res.ok) router.push(`/studio/experiences/${res.data.experience.id}`);
    else setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Title" id="new-exp-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
      <Select
        label="Linked release"
        id="new-exp-release"
        value={releaseId}
        onChange={(e) => setReleaseId(e.target.value)}
        options={[{ value: "", label: "None" }, ...releases.map((r) => ({ value: r.id, label: r.title }))]}
      />
      <FormMessage result={result} />
      <Button type="submit" loading={busy}>Create experience</Button>
    </form>
  );
}
