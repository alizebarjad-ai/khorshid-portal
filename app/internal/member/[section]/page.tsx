import { notFound } from "next/navigation";
import { MemberPortalSection } from "@/components/member-portal";

const sections = {
  programs: "programs",
  clubs: "clubs",
  services: "services",
  development: "upgrades",
} as const;

export default async function MemberSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const initialSection = sections[section as keyof typeof sections];
  if (!initialSection) notFound();
  return <MemberPortalSection initialSection={initialSection} />;
}
