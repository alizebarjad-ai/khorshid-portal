import type { UserRole } from "@/lib/auth";

const DASHBOARD_PATHS: Record<Exclude<UserRole, "beneficiary">, string> = {
  ceo: "/internal/roles/ceo",
  deputy: "/internal/roles/deputy",
  finance: "/internal/roles/finance",
  economic: "/internal/roles/economic",
  csr: "/internal/roles/csr",
  media: "/internal/media-manager",
  artists: "/internal/roles/artists",
  education: "/internal/education-manager",
  members: "/internal/roles/members",
  member: "/internal/member-home",
};

export function dashboardPathForRole(role?: string | null): string {
  if (role === "beneficiary") return "/internal/my-reward";
  if (role && role in DASHBOARD_PATHS) {
    return DASHBOARD_PATHS[role as Exclude<UserRole, "beneficiary">];
  }
  return "/internal";
}
