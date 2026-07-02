export type RoleName = "Founder" | "Owner" | "Ban Team" | "Super Admin" | "Admin" | "Moderator" | "Support" | "Viewer";

export type Permission =
  | "dashboard.view"
  | "players.view"
  | "players.kick"
  | "players.ban"
  | "players.warn"
  | "players.revive"
  | "players.heal"
  | "players.armor"
  | "players.needs"
  | "players.jail"
  | "players.clothing"
  | "players.teleport"
  | "players.screenshot"
  | "players.inventory.view"
  | "players.inventory.edit"
  | "players.money.view"
  | "players.money.edit"
  | "players.job.edit"
  | "players.gang.edit"
  | "bans.view"
  | "bans.create"
  | "bans.delete"
  | "reports.delete"
  | "reports.view"
  | "reports.claim"
  | "reports.close"
  | "announcements.txadmin"
  | "screenshots.view"
  | "staff.view"
  | "staff.create"
  | "staff.edit"
  | "staff.delete"
  | "settings.view"
  | "settings.edit"
  | "logs.view"
  | "database.write";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  email?: string | null;
  discordId?: string | null;
  avatarUrl?: string | null;
  loginProvider?: "password" | "discord" | "both";
  roleName: RoleName;
  permissions: Permission[];
  disabled: boolean;
}

export interface StaffUser extends AuthUser {
  lastLoginAt: string | null;
  createdAt: string;
}

export interface OnlinePlayer {
  serverId: number;
  characterName: string;
  steamName: string;
  discordId?: string | null;
  license?: string | null;
  steam?: string | null;
  ip?: string | null;
  fivem?: string | null;
  endpoint?: string | null;
  citizenId?: string | null;
  job?: string | null;
  jobGrade?: string | number | null;
  gang?: string | null;
  gangGrade?: string | number | null;
  ping?: number | null;
  health?: number | null;
  armor?: number | null;
  cash?: number | null;
  bank?: number | null;
  coords?: { x: number; y: number; z: number } | null;
  identifiers?: Record<string, string>;
  lastUpdate: string;
  status: "online" | "stale";
}

export interface OfflinePlayer {
  id: string;
  characterName: string;
  steamName?: string | null;
  discordId?: string | null;
  steam?: string | null;
  fivem?: string | null;
  ip?: string | null;
  license?: string | null;
  citizenId?: string | null;
  phone?: string | null;
  job?: string | null;
  gang?: string | null;
  cash?: number | null;
  bank?: number | null;
  source: "qbcore" | "esx" | "demo";
}

export interface BanRecord {
  id: number;
  targetName: string;
  citizenId?: string | null;
  license?: string | null;
  steam?: string | null;
  discord?: string | null;
  fivem?: string | null;
  ip?: string | null;
  reason: string;
  evidence?: string | null;
  staffUserId?: number | null;
  staffName: string;
  permanent: boolean;
  expiresAt?: string | null;
  active: boolean;
  evasionNotes?: string | null;
  metadata?: Record<string, unknown>;
  hwid?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarningRecord {
  id: number;
  targetName: string;
  citizenId?: string | null;
  license?: string | null;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  evidence?: string | null;
  staffUserId?: number | null;
  staffName: string;
  createdAt: string;
}

export interface ReportRecord {
  id: number;
  reporterName: string;
  reporterServerId?: number | null;
  reporterCitizenId?: string | null;
  message: string;
  status: "pending" | "claimed" | "closed";
  assignedStaffId?: number | null;
  assignedStaffName?: string | null;
  resolution?: string | null;
  notes: ReportNote[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportNote {
  id: number;
  reportId: number;
  staffUserId?: number | null;
  staffName: string;
  note: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  staffUserId?: number | null;
  staffName: string;
  actionType: string;
  targetPlayer?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  success: boolean;
  createdAt: string;
}

export interface BridgeCommand {
  id: string;
  type: string;
  targetServerId?: number | null;
  payload: Record<string, unknown>;
  requestedBy?: AuthUser | null;
  status: "queued" | "sent" | "complete" | "failed";
  result?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  serverOnline: boolean;
  playersOnline: number;
  maxPlayers: number;
  staffOnline: number;
  totalBans: number;
  totalWarnings: number;
  reportsPending: number;
  ticketsPending: number;
  bridgeLastSeen: string | null;
  performance: {
    ping: number | null;
    cpu: number | null;
    memory: number | null;
    resources: number | null;
  };
  moduleStatus: Record<string, "ok" | "missing" | "offline" | "demo">;
}

export interface VehicleRecord {
  id: string;
  citizenId: string;
  ownerName?: string | null;
  plate: string;
  vehicle: string;
  garage?: string | null;
  state?: string | number | null;
  mods?: unknown;
}

export interface InventoryItem {
  name: string;
  label?: string;
  amount: number;
  slot?: number;
  imageUrl?: string | null;
  metadata?: unknown;
}

export interface FrameworkOption {
  name: string;
  label: string;
  grades: Array<{ level: number | string; name: string; label: string }>;
}

export interface MoneyAccounts {
  cash: number;
  bank: number;
  black?: number;
}
