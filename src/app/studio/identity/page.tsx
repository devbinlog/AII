export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { StudioPageHeader } from "@/components/studio/ui";
import { IdentityForm } from "./_components/identity-form";

export const metadata: Metadata = { title: "Identity" };

export default async function StudioIdentityPage() {
  const access = await getStudioAccess("/studio/identity");
  if (access.status !== "ok") return <StudioForbidden />;
  return (
    <>
      <StudioPageHeader eyebrow="Identity" title="Artist identity" description="Your public name, bio, genres, links and brand colors." />
      <IdentityForm artist={access.artist} canEdit={access.can("identity.edit")} />
    </>
  );
}
