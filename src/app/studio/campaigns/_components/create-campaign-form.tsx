"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CreateCampaignForm({
  experiences,
  initialExperienceId,
}: {
  experiences: { id: string; title: string; published: boolean }[];
  initialExperienceId?: string | undefined;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [experienceId, setExperienceId] = useState(initialExperienceId ?? experiences.find((e) => e.published)?.id ?? experiences[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await studioFetch<{ campaign: { id: string } }>("/api/studio/campaigns", "POST", { title, slug, experienceId });
    setBusy(false);
    if (res.ok) router.push(`/studio/campaigns/${res.data.campaign.id}`);
    else setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Title"
        id="new-campaign-title"
        value={title}
        maxLength={120}
        required
        onChange={(e) => {
          setTitle(e.target.value);
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />
      <Input
        label="Address"
        id="new-campaign-slug"
        hint={`aii.music/campaigns/${slug || "your-campaign"}`}
        value={slug}
        required
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        minLength={3}
        maxLength={60}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value.toLowerCase());
        }}
      />
      <Select
        label="Experience"
        id="new-campaign-experience"
        value={experienceId}
        onChange={(e) => setExperienceId(e.target.value)}
        options={experiences.map((x) => ({ value: x.id, label: `${x.title}${x.published ? "" : " (not published)"}` }))}
      />
      <FormMessage result={result} />
      <Button type="submit" loading={busy}>Create draft campaign</Button>
    </form>
  );
}
