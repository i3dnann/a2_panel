import type { Permission, RoleName } from "./types/models.js";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "players.view",
  "players.kick",
  "players.ban",
  "players.warn",
  "players.revive",
  "players.heal",
  "players.armor",
  "players.needs",
  "players.jail",
  "players.clothing",
  "players.teleport",
  "players.screenshot",
  "players.inventory.view",
  "players.inventory.edit",
  "players.money.view",
  "players.money.edit",
  "players.job.edit",
  "players.gang.edit",
  "bans.view",
  "bans.create",
  "bans.delete",
  "reports.delete",
  "reports.view",
  "reports.claim",
  "reports.close",
  "announcements.txadmin",
  "screenshots.view",
  "staff.view",
  "staff.create",
  "staff.edit",
  "staff.delete",
  "settings.view",
  "settings.edit",
  "logs.view",
  "database.write"
];

const staffCore: Permission[] = [
  "dashboard.view",
  "players.view",
  "players.kick",
  "players.warn",
  "players.revive",
  "players.heal",
  "players.armor",
  "players.needs",
  "players.jail",
  "players.clothing",
  "players.teleport",
  "reports.view",
  "reports.claim",
  "reports.close",
  "bans.view",
  "logs.view"
];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  Founder: ALL_PERMISSIONS,
  Owner: ALL_PERMISSIONS,
  "Ban Team": [
    "dashboard.view",
    "players.view",
    "players.ban",
    "bans.view",
    "bans.create",
    "logs.view"
  ],
  "Super Admin": ALL_PERMISSIONS.filter((permission) => permission !== "staff.delete"),
  Admin: [
    ...staffCore,
    "players.ban",
    "players.screenshot",
    "players.inventory.view",
    "players.inventory.edit",
    "players.money.view",
    "players.money.edit",
    "players.job.edit",
    "players.gang.edit",
    "bans.create",
    "settings.view",
    "database.write"
  ],
  Moderator: [...staffCore, "players.ban", "bans.create", "players.inventory.view", "players.money.view"],
  Support: ["dashboard.view", "players.view", "players.warn", "reports.view", "reports.claim", "reports.close"],
  Viewer: ["dashboard.view", "players.view", "bans.view", "reports.view", "logs.view"]
};

export function roleHasPermission(roleName: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[roleName]?.includes(permission) ?? false;
}

export function normalizeRoleName(value: string | null | undefined): RoleName {
  const allowed = Object.keys(ROLE_PERMISSIONS) as RoleName[];
  return allowed.includes(value as RoleName) ? (value as RoleName) : "Viewer";
}
