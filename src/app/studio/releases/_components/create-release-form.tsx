"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";

export function CreateReleaseForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("single");
  const [releaseDate, setReleaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await studioFetch<{ release: { id: string } }>("/api/studio/releases", "POST", { title, type, releaseDate });
    setBusy(false);
    if (res.ok) router.push(`/studio/releases/${res.data.release.id}`);
    else setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Title" id="new-release-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
      <Select
        label="Type"
        id="new-release-type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={[
          { value: "single", label: "Single" },
          { value: "ep", label: "EP" },
          { value: "album", label: "Album" },
          { value: "compilation", label: "Compilation" },
        ]}
      />
      <Input label="Release date" id="new-release-date" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} required />
      <FormMessage result={result} />
      <Button type="submit" loading={busy}>Create draft</Button>
    </form>
  );
}
