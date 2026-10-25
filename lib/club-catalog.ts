export type ClubCatalogItem = {
  id: string;
  kind: "club";
  name: string;
  clubType: string;
  status: string;
  city: string;
  description: string;
  coordinator: string;
  contact: string;
  notes: string;
  source: "website" | "portal";
};

export const WEBSITE_CLUBS: ClubCatalogItem[] = [
  { id: "media", kind: "club", name: "رسانه و تولید محتوا", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی رسانه و تولید محتوا", coordinator: "", contact: "", notes: "", source: "website" },
  { id: "cinema", kind: "club", name: "سینما و تئاتر", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی سینما و تئاتر", coordinator: "", contact: "", notes: "", source: "website" },
  { id: "music", kind: "club", name: "موسیقی", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی موسیقی", coordinator: "", contact: "", notes: "", source: "website" },
  { id: "art", kind: "club", name: "ادبیات", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی ادبیات", coordinator: "", contact: "", notes: "", source: "website" },
  { id: "visual", kind: "club", name: "هنرهای تجسمی و طراحی", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی هنرهای تجسمی و طراحی", coordinator: "", contact: "", notes: "", source: "website" },
  { id: "responsibility", kind: "club", name: "مسئولیت اجتماعی", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی مسئولیت اجتماعی", coordinator: "", contact: "", notes: "", source: "website" },
  { id: "education", kind: "club", name: "آموزش", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی آموزش", coordinator: "", contact: "", notes: "", source: "website" },
  { id: "partnership", kind: "club", name: "توسعه و شبکه‌سازی", clubType: "thematic", status: "active", city: "", description: "باشگاه تخصصی توسعه و شبکه‌سازی", coordinator: "", contact: "", notes: "", source: "website" },
];

export function mergeClubCatalog(portalClubs: Array<Record<string, unknown>>) {
  const custom = portalClubs.map((club) => ({
    ...club,
    source: "portal" as const,
  })) as ClubCatalogItem[];
  const websiteIds = new Set(WEBSITE_CLUBS.map((club) => club.id));
  return [...WEBSITE_CLUBS, ...custom.filter((club) => !websiteIds.has(club.id))];
}
