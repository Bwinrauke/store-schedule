export const ROLES = ["Cashier", "Sales Associate", "Keyholder"] as const;
export type StaffRole = (typeof ROLES)[number];

export function isStaffRole(v: unknown): v is StaffRole {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
