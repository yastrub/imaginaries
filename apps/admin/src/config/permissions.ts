// Single source of truth for system permissions
// Each permission has a stable machine key and a human-readable description.

export type PermissionKey =
  | "VIEW_USERS"
  | "MANAGE_USERS"
  | "VIEW_ROLES"
  | "MANAGE_ROLES"
  | "VIEW_PROMO_CODES"
  | "MANAGE_PROMO_CODES"
  | "VIEW_IMAGES"
  | "GENERATE_IMAGES"
  | "DELETE_IMAGES"
  | "UPLOAD_FILES"
  | "VIEW_BILLING"
  | "MANAGE_BILLING"
  | "VIEW_SETTINGS"
  | "MANAGE_SETTINGS"
  | "VIEW_AUDIT_LOGS";

export type PermissionDef = {
  permission: PermissionKey;
  description: string;
  category?: string;
};

export const PERMISSIONS: ReadonlyArray<PermissionDef> = [
  { permission: "VIEW_USERS", description: "View Users", category: "Users" },
  { permission: "MANAGE_USERS", description: "Manage Users", category: "Users" },
  { permission: "VIEW_ROLES", description: "View Roles", category: "Roles" },
  { permission: "MANAGE_ROLES", description: "Manage Roles", category: "Roles" },
  { permission: "VIEW_PROMO_CODES", description: "View Promo Codes", category: "Marketing" },
  { permission: "MANAGE_PROMO_CODES", description: "Manage Promo Codes", category: "Marketing" },
  { permission: "VIEW_IMAGES", description: "View Images", category: "Content" },
  { permission: "GENERATE_IMAGES", description: "Generate Images", category: "Content" },
  { permission: "DELETE_IMAGES", description: "Delete Images", category: "Content" },
  { permission: "UPLOAD_FILES", description: "Upload Files", category: "Content" },
  { permission: "VIEW_BILLING", description: "View Billing", category: "Billing" },
  { permission: "MANAGE_BILLING", description: "Manage Billing", category: "Billing" },
  { permission: "VIEW_SETTINGS", description: "View Settings", category: "System" },
  { permission: "MANAGE_SETTINGS", description: "Manage Settings", category: "System" },
  { permission: "VIEW_AUDIT_LOGS", description: "View Audit Logs", category: "System" },
] as const;

// Convenience lookups
export const PERMISSION_MAP: Readonly<Record<PermissionKey, PermissionDef>> =
  Object.freeze(
    PERMISSIONS.reduce((acc, p) => {
      acc[p.permission] = p;
      return acc;
    }, {} as Record<PermissionKey, PermissionDef>)
  );

export const ALL_PERMISSION_KEYS: ReadonlyArray<PermissionKey> = PERMISSIONS.map(
  (p) => p.permission
);

export function hasPermission(
  rolePermissions: ReadonlyArray<PermissionKey> | null | undefined,
  required: PermissionKey
): boolean {
  if (!rolePermissions) return false;
  return rolePermissions.includes(required);
}
