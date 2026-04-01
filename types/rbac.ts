/**
 * Role-Based Access Control types.
 *
 * Role hierarchy (lowest → highest):
 *   VIEWER < EDITOR < ADMIN
 *
 * Future: extend with fine-grained permission flags per resource type
 * when Google Workspace SSO is added.
 */

export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
};

/** Returns true if `userRole` meets or exceeds `requiredRole`. */
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/** Permissions per role for common actions. */
export const PERMISSIONS = {
  // Template management
  manageTemplates: ["ADMIN"] as Role[],
  viewTemplates: ["ADMIN", "EDITOR", "VIEWER"] as Role[],
  scanTemplates: ["ADMIN"] as Role[],

  // Generation
  generateDeck: ["ADMIN", "EDITOR"] as Role[],
  viewRuns: ["ADMIN", "EDITOR", "VIEWER"] as Role[],
  viewAllRuns: ["ADMIN"] as Role[],

  // Provider / system settings
  manageProviders: ["ADMIN"] as Role[],
  viewProviders: ["ADMIN"] as Role[],

  // Audit
  viewAuditLog: ["ADMIN"] as Role[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** Check if a role has a specific permission. */
export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as Role[]).includes(role);
}
