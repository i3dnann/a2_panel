import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "socket.io";
import { env } from "../config.js";
import { execute, pingDatabase, queryRows, tableExists } from "../db.js";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, normalizeRoleName } from "../permissions.js";
import type {
  AuditLog,
  AuthUser,
  BanRecord,
  BridgeCommand,
  DashboardStats,
  FrameworkOption,
  InventoryItem,
  MoneyAccounts,
  OfflinePlayer,
  OnlinePlayer,
  Permission,
  ReportNote,
  ReportRecord,
  RoleName,
  StaffUser,
  StashRecord,
  VehicleRecord,
  WarningRecord
} from "../types/models.js";
import { HttpError } from "../utils/errors.js";

type StoredUser = StaffUser & {
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: string | null;
};

type DbUserRow = {
  id: number;
  username: string;
  display_name: string;
  discord_id: string | null;
  email: string | null;
  avatar_url: string | null;
  password_hash: string;
  login_provider: "password" | "discord" | "both";
  disabled: number | boolean;
  deleted_at: Date | string | null;
  failed_login_count: number;
  locked_until: Date | string | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
  role_name: string | null;
  role_id: number | null;
};

const iso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const jsonParse = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const like = (query: string) => `%${query.trim()}%`;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const publicItemImageUrl = (name: string): string | null => name ? `/api/assets/items/${encodeURIComponent(name)}` : null;
const configuredItemImageUrl = (name: string): string | null => env.ITEM_IMAGE_BASE_URL ? `${env.ITEM_IMAGE_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(name)}.png` : null;
const itemImageDirs = env.ITEM_IMAGE_DIRS.split(/[;,]/).map((dir) => dir.trim()).filter(Boolean);
const itemImageExtensions = [".png", ".webp", ".jpg", ".jpeg", ".gif"];
const absoluteOrDataUrl = (value: string) => /^(https?:|data:image\/|\/api\/)/i.test(value);
const cleanItemName = (name: string): string => path.basename(name).replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z0-9_-]/g, "");
const randomPlate = (): string => `A2${crypto.randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 8);
const randomWeaponSerial = (): string => `A2-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

const demoPermissions = ROLE_PERMISSIONS.Founder;
const cleanDiscordId = (value: string | null | undefined): string | null => value?.replace(/^discord:/, "").trim() || null;
const envOwnerPassword = env.OWNER_PASSWORD || crypto.randomBytes(24).toString("hex");

type InventoryCatalogItem = { label?: string | null; imageUrl?: string | null };
type WatchFrame = {
  commandId: string;
  target: string;
  image: string;
  createdAt: string;
  requestedBy?: string | null;
};

export class A2DataService {
  private io: Server | null = null;
  private databaseOnline = false;
  private a2TablesReady = false;
  private bridgeLastSeen: string | null = null;
  private bridgeMetrics: DashboardStats["performance"] = {
    ping: null,
    cpu: null,
    memory: null,
    resources: null
  };
  private bridgeMaxPlayers = 64;
  private onlinePlayers: OnlinePlayer[] = [];
  private commands: BridgeCommand[] = [];
  private watchFrames = new Map<string, WatchFrame>();
  private users: StoredUser[] = [
    {
      id: 1,
      username: env.OWNER_USERNAME || "owner",
      displayName: env.OWNER_DISPLAY_NAME || "A2 Founder",
      email: env.OWNER_EMAIL || null,
      discordId: cleanDiscordId(env.OWNER_DISCORD_ID),
      loginProvider: env.OWNER_DISCORD_ID ? "both" : "password",
      roleName: "Founder",
      permissions: demoPermissions,
      disabled: false,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      passwordHash: bcrypt.hashSync(envOwnerPassword, 10),
      failedLoginCount: 0,
      lockedUntil: null
    }
  ];
  private bans: BanRecord[] = [
    {
      id: 1,
      targetName: "Demo Citizen",
      citizenId: "A2DEMO01",
      reason: "Sample expired ban for audit testing",
      staffUserId: 1,
      staffName: "A2 Owner",
      permanent: false,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
      active: false,
      metadata: { demo: true },
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];
  private warnings: WarningRecord[] = [];
  private reports: ReportRecord[] = [
    {
      id: 1,
      reporterName: "Demo Reporter",
      reporterServerId: null,
      reporterCitizenId: "A2DEMO01",
      message: "Sample pending report. Connect the bridge to receive live /report events.",
      status: "pending",
      notes: [],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];
  private auditLogs: AuditLog[] = [
    {
      id: 1,
      staffUserId: 1,
      staffName: "A2 Panel",
      actionType: "system.ready",
      targetPlayer: null,
      reason: "A2 Panel demo data initialized",
      metadata: { mode: "demo-fallback" },
      ipAddress: null,
      success: true,
      createdAt: new Date().toISOString()
    }
  ];
  private settings: Record<string, unknown> = {
    serverName: "A2 FiveM Server",
    backendPublicUrl: "http://localhost:3001",
    fivemServerIp: env.FIVEM_SERVER_IP,
    fivemServerPort: env.FIVEM_SERVER_PORT,
    frameworkMode: "qbcore",
    accentColor: "#b7fe1a",
    logoText: "A2 Panel",
    modules: {
      reports: true,
      discord: true,
      screenshot: true,
      console: true,
      inventory: true,
      money: true,
      vehicles: true,
      jobsGangs: true,
      liveView: true
    },
    tableMapping: {
      qbcore: {
        players: "players",
        vehicles: "player_vehicles"
      },
      esx: {
        users: "users",
        vehicles: "owned_vehicles"
      }
    },
    discordWebhooks: {
      admin: env.DISCORD_WEBHOOK_ADMIN,
      bans: env.DISCORD_WEBHOOK_BANS,
      reports: env.DISCORD_WEBHOOK_REPORTS,
      errors: env.DISCORD_WEBHOOK_ERRORS,
      inventory: "",
      money: "",
      vehicles: "",
      staff: "",
      warnings: "",
      characters: ""
    }
  };

  setSocketServer(io: Server): void {
    this.io = io;
  }

  async init(): Promise<void> {
    this.databaseOnline = await pingDatabase();
    if (!this.databaseOnline) {
      this.a2TablesReady = false;
      return;
    }

    try {
      this.a2TablesReady =
        (await tableExists("a2_users")) &&
        (await tableExists("a2_roles")) &&
        (await tableExists("a2_permissions")) &&
        (await tableExists("a2_audit_logs"));
      if (this.a2TablesReady) {
        await this.ensureOwnerAccount();
      }
    } catch {
      this.a2TablesReady = false;
    }
  }

  private async ensureOwnerAccount(): Promise<void> {
    if (!env.OWNER_DISCORD_ID && !env.OWNER_EMAIL && !env.OWNER_PASSWORD) return;
    const roleRows = await queryRows<{ id: number }>("SELECT id FROM a2_roles WHERE name = 'Founder' LIMIT 1");
    const founderRoleId = roleRows[0]?.id;
    if (!founderRoleId) return;
    const discordId = cleanDiscordId(env.OWNER_DISCORD_ID);
    const username = (env.OWNER_USERNAME || "owner").trim();
    const displayName = (env.OWNER_DISPLAY_NAME || "A2 Founder").trim();
    const email = env.OWNER_EMAIL.trim() || null;
    const passwordHash = await bcrypt.hash(envOwnerPassword, 12);
    await execute(
      `INSERT INTO a2_users (username, display_name, email, discord_id, password_hash, login_provider, role_id, disabled)
       VALUES (:username, :displayName, :email, :discordId, :passwordHash, :loginProvider, :roleId, 0)
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         email = VALUES(email),
         discord_id = VALUES(discord_id),
         password_hash = VALUES(password_hash),
         login_provider = VALUES(login_provider),
         role_id = VALUES(role_id),
         disabled = 0,
         deleted_at = NULL,
         updated_at = NOW()`,
      {
        username,
        displayName,
        email,
        discordId,
        passwordHash,
        loginProvider: discordId ? "both" : "password",
        roleId: founderRoleId
      }
    );
    await execute("UPDATE a2_users SET disabled = 1, updated_at = NOW() WHERE username = 'admin' AND username <> :username", { username });
  }

  isDatabaseOnline(): boolean {
    return this.databaseOnline;
  }

  isA2TablesReady(): boolean {
    return this.a2TablesReady;
  }

  findItemImageFile(rawName: string): string | null {
    const itemName = cleanItemName(rawName);
    if (!itemName || !itemImageDirs.length) return null;

    for (const dir of itemImageDirs) {
      const root = path.resolve(dir);
      for (const ext of itemImageExtensions) {
        const file = path.resolve(root, `${itemName}${ext}`);
        if (!file.toLowerCase().startsWith(root.toLowerCase() + path.sep)) continue;
        if (fs.existsSync(file)) return file;
      }
    }

    return null;
  }

  private imageUrlFromInventoryValue(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const metadata = (record.metadata ?? record.info ?? record.meta) as Record<string, unknown> | undefined;
    const candidates = [
      record.imageUrl,
      record.image_url,
      record.image,
      record.img,
      record.icon,
      record.iconUrl,
      metadata?.imageUrl,
      metadata?.image_url,
      metadata?.image,
      metadata?.img,
      metadata?.icon
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "string" || !candidate.trim()) continue;
      const trimmed = candidate.trim();
      if (absoluteOrDataUrl(trimmed)) return trimmed;
      if (env.ITEM_IMAGE_BASE_URL) return `${env.ITEM_IMAGE_BASE_URL.replace(/\/$/, "")}/${trimmed.replace(/^\/+/, "")}`;
    }

    return null;
  }

  private async tableColumns(tableName: string): Promise<string[]> {
    const rows = await queryRows<{ COLUMN_NAME: string }>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :database AND TABLE_NAME = :tableName",
      { database: env.DATABASE_NAME, tableName }
    );
    return rows.map((row) => row.COLUMN_NAME);
  }

  private async itemCatalog(names: string[]): Promise<Map<string, InventoryCatalogItem>> {
    if (!this.databaseOnline || !names.length) return new Map();
    const uniqueNames = Array.from(new Set(names.map(cleanItemName).filter(Boolean)));
    if (!uniqueNames.length) return new Map();

    const tableRows = await queryRows<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = :database
         AND (TABLE_NAME IN ('items','item','inventory_items','qb_items','ox_items','qs_items','lj_items') OR TABLE_NAME LIKE '%item%')
       ORDER BY FIELD(TABLE_NAME, 'items','inventory_items','qb_items','ox_items','qs_items','lj_items') DESC
       LIMIT 30`,
      { database: env.DATABASE_NAME }
    );
    const catalog = new Map<string, InventoryCatalogItem>();

    for (const row of tableRows) {
      const tableName = row.TABLE_NAME;
      const columns = await this.tableColumns(tableName);
      const nameCol = ["name", "item", "item_name", "id"].find((column) => columns.includes(column));
      if (!nameCol) continue;
      const labelCol = ["label", "display_name", "item_label", "description"].find((column) => columns.includes(column));
      const imageCol = ["image_url", "image", "img", "icon_url", "icon", "picture", "pic"].find((column) => columns.includes(column));
      if (!labelCol && !imageCol) continue;

      const params: Record<string, string> = {};
      const placeholders = uniqueNames.map((name, index) => {
        params[`name${index}`] = name;
        return `:name${index}`;
      });
      const table = `\`${tableName.replace(/`/g, "``")}\``;
      const name = `\`${nameCol.replace(/`/g, "``")}\``;
      const label = labelCol ? `\`${labelCol.replace(/`/g, "``")}\`` : "NULL";
      const image = imageCol ? `\`${imageCol.replace(/`/g, "``")}\`` : "NULL";
      const items = await queryRows<{ name: string; label: string | null; image: string | null }>(
        `SELECT ${name} AS name, ${label} AS label, ${image} AS image FROM ${table} WHERE ${name} IN (${placeholders.join(",")}) LIMIT 500`,
        params
      );

      for (const item of items) {
        const itemName = cleanItemName(item.name);
        if (!itemName || catalog.has(itemName)) continue;
        let imageUrl = item.image?.trim() || null;
        if (imageUrl && !absoluteOrDataUrl(imageUrl)) {
          imageUrl = env.ITEM_IMAGE_BASE_URL ? `${env.ITEM_IMAGE_BASE_URL.replace(/\/$/, "")}/${imageUrl.replace(/^\/+/, "")}` : null;
        }
        catalog.set(itemName, { label: item.label, imageUrl });
      }
    }

    return catalog;
  }

  private async enrichInventoryItems(rawItems: unknown): Promise<InventoryItem[]> {
    if (!Array.isArray(rawItems)) return [];
    const normalized = rawItems.map((raw, index) => {
      const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const name = cleanItemName(String(record.name ?? record.item ?? record.itemName ?? ""));
      if (!name) return null;
      return {
        ...record,
        name,
        label: typeof record.label === "string" ? record.label : undefined,
        amount: Number(record.amount ?? record.count ?? record.quantity ?? 0),
        slot: Number.isFinite(Number(record.slot)) ? Number(record.slot) : index + 1,
        imageUrl: this.imageUrlFromInventoryValue(record),
        metadata: record.metadata ?? record.info ?? record.meta
      } as InventoryItem;
    }).filter((item): item is InventoryItem => Boolean(item));

    const catalog = await this.itemCatalog(normalized.map((item) => item.name));
    return normalized.map((item) => {
      const catalogItem = catalog.get(cleanItemName(item.name));
      return {
        ...item,
        label: item.label ?? catalogItem?.label ?? item.name,
        imageUrl: item.imageUrl ?? catalogItem?.imageUrl ?? configuredItemImageUrl(item.name) ?? (this.findItemImageFile(item.name) ? publicItemImageUrl(item.name) : null)
      };
    });
  }

  isBridgeOnline(): boolean {
    return this.bridgeLastSeen !== null && Date.now() - new Date(this.bridgeLastSeen).getTime() < 15000;
  }

  private emit(event: string, payload: unknown): void {
    this.io?.emit(event, payload);
  }

  private notify(title: string, message: string, level: "success" | "error" | "info" | "warning" = "info"): void {
    this.emit("notification.created", {
      title,
      message,
      level,
      createdAt: new Date().toISOString()
    });
  }

  private nextId(collection: { id: number }[]): number {
    return collection.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  }

  private staffFromStored(user: StoredUser): StaffUser {
    const { passwordHash: _passwordHash, failedLoginCount: _failed, lockedUntil: _locked, ...safe } = user;
    return clone(safe);
  }

  private authFromDbRow(row: DbUserRow, permissions: Permission[]): AuthUser {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      discordId: row.discord_id,
      avatarUrl: row.avatar_url,
      loginProvider: row.login_provider ?? "password",
      roleName: normalizeRoleName(row.role_name),
      permissions,
      disabled: Boolean(row.disabled)
    };
  }

  private async getDbPermissions(roleId: number | null, roleName: RoleName, userId?: number): Promise<Permission[]> {
    const fallback = ROLE_PERMISSIONS[roleName];
    try {
      const roleRows = roleId
        ? await queryRows<{ name: Permission }>(
            `SELECT p.name
             FROM a2_role_permissions rp
             JOIN a2_permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = :roleId`,
            { roleId }
          )
        : [];
      const base = new Set<Permission>((roleRows.length ? roleRows.map((row) => row.name) : fallback).filter((name) => ALL_PERMISSIONS.includes(name)));
      if (userId) {
        const userRows = await queryRows<{ name: Permission; allowed: number | boolean }>(
          `SELECT p.name, up.allowed
           FROM a2_user_permissions up
           JOIN a2_permissions p ON p.id = up.permission_id
           WHERE up.user_id = :userId`,
          { userId }
        );
        for (const row of userRows) {
          if (!ALL_PERMISSIONS.includes(row.name)) continue;
          if (Boolean(row.allowed)) base.add(row.name);
          else base.delete(row.name);
        }
      }
      return [...base];
    } catch {
      return fallback;
    }
  }

  async getUserById(id: number): Promise<AuthUser | null> {
    if (this.a2TablesReady) {
      const rows = await queryRows<DbUserRow>(
        `SELECT u.*, r.name AS role_name
         FROM a2_users u
         LEFT JOIN a2_roles r ON r.id = u.role_id
         WHERE u.id = :id AND u.deleted_at IS NULL
         LIMIT 1`,
        { id }
      );
      const row = rows[0];
      if (!row) return null;
      const roleName = normalizeRoleName(row.role_name);
      const permissions = await this.getDbPermissions(row.role_id, roleName, row.id);
      return this.authFromDbRow(row, permissions);
    }

    const user = this.users.find((candidate) => candidate.id === id);
    return user ? this.staffFromStored(user) : null;
  }

  async login(username: string, password: string, ipAddress: string | null): Promise<AuthUser> {
    if (this.a2TablesReady) {
      const rows = await queryRows<DbUserRow>(
        `SELECT u.*, r.name AS role_name
         FROM a2_users u
         LEFT JOIN a2_roles r ON r.id = u.role_id
          WHERE (u.username = :username OR u.email = :username) AND u.deleted_at IS NULL
         LIMIT 1`,
        { username }
      );
      const user = rows[0];
      if (!user) {
        await this.createAudit({ staffName: username, actionType: "auth.login_failed", reason: "Unknown username", ipAddress, success: false });
        throw new HttpError(401, "Invalid username or password", "invalid_credentials");
      }
      if (Boolean(user.disabled)) {
        await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.login_failed", reason: "Account disabled", ipAddress, success: false });
        throw new HttpError(403, "This staff account is disabled", "account_disabled");
      }
      if (user.login_provider === "discord") {
        await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.login_failed", reason: "Password login disabled for Discord-only staff", ipAddress, success: false });
        throw new HttpError(403, "Use Discord login for this staff account", "discord_login_required");
      }
      if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        throw new HttpError(423, "Account temporarily locked after too many failed logins", "account_locked");
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        const failedLoginCount = (user.failed_login_count ?? 0) + 1;
        const lockedUntil = failedLoginCount >= 5 ? new Date(Date.now() + 10 * 60 * 1000) : null;
        await execute("UPDATE a2_users SET failed_login_count = :failedLoginCount, locked_until = :lockedUntil WHERE id = :id", {
          id: user.id,
          failedLoginCount,
          lockedUntil
        });
        await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.login_failed", reason: "Bad password", ipAddress, success: false });
        throw new HttpError(401, "Invalid username or password", "invalid_credentials");
      }

      await execute("UPDATE a2_users SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = :id", { id: user.id });
      const roleName = normalizeRoleName(user.role_name);
      const permissions = await this.getDbPermissions(user.role_id, roleName, user.id);
      const auth = this.authFromDbRow(user, permissions);
      await this.createAudit({ staffUserId: auth.id, staffName: auth.username, actionType: "auth.login_success", reason: "Staff logged in", ipAddress, success: true });
      return auth;
    }

    const user = this.users.find((candidate) => candidate.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      await this.createAudit({ staffName: username, actionType: "auth.login_failed", reason: "Unknown username", ipAddress, success: false });
      throw new HttpError(401, "Invalid username or password", "invalid_credentials");
    }
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      throw new HttpError(423, "Account temporarily locked after too many failed logins", "account_locked");
    }
    if (user.loginProvider === "discord") {
      await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.login_failed", reason: "Password login disabled for Discord-only staff", ipAddress, success: false });
      throw new HttpError(403, "Use Discord login for this staff account", "discord_login_required");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= 5) {
        user.lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      }
      await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.login_failed", reason: "Bad password", ipAddress, success: false });
      throw new HttpError(401, "Invalid username or password", "invalid_credentials");
    }
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date().toISOString();
    await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.login_success", reason: "Staff logged in", ipAddress, success: true });
    return this.staffFromStored(user);
  }

  async loginDiscord(profile: { discordId: string; username: string; displayName: string; avatarUrl?: string | null }, ipAddress: string | null): Promise<AuthUser> {
    const discordId = profile.discordId.replace(/^discord:/, "");
    if (this.a2TablesReady) {
      const rows = await queryRows<DbUserRow>(
        `SELECT u.*, r.name AS role_name
         FROM a2_users u
         LEFT JOIN a2_roles r ON r.id = u.role_id
         WHERE u.discord_id = :discordId AND u.deleted_at IS NULL
         LIMIT 1`,
        { discordId }
      );
      const user = rows[0];
      if (!user) {
        await this.createAudit({ staffName: profile.username, actionType: "auth.discord_denied", reason: `Discord ID ${discordId} is not allowed`, ipAddress, success: false });
        throw new HttpError(403, "Your Discord account has not been granted A2 Panel access", "discord_not_allowed");
      }
      if (Boolean(user.disabled)) {
        await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.discord_denied", reason: "Account disabled", ipAddress, success: false });
        throw new HttpError(403, "This staff account is disabled", "account_disabled");
      }
      await execute(
        `UPDATE a2_users
         SET avatar_url = COALESCE(:avatarUrl, avatar_url),
             last_login_at = NOW(),
             failed_login_count = 0,
             locked_until = NULL
         WHERE id = :id`,
        { id: user.id, avatarUrl: profile.avatarUrl ?? null }
      );
      const roleName = normalizeRoleName(user.role_name);
      const permissions = await this.getDbPermissions(user.role_id, roleName, user.id);
      const auth = this.authFromDbRow({ ...user, avatar_url: profile.avatarUrl ?? user.avatar_url }, permissions);
      await this.createAudit({ staffUserId: auth.id, staffName: auth.username, actionType: "auth.discord_success", reason: "Staff logged in with Discord", ipAddress, success: true });
      return auth;
    }

    const user = this.users.find((candidate) => candidate.discordId === discordId);
    if (!user || user.disabled) {
      await this.createAudit({ staffName: profile.username, actionType: "auth.discord_denied", reason: `Discord ID ${discordId} is not allowed`, ipAddress, success: false });
      throw new HttpError(403, "Your Discord account has not been granted A2 Panel access", "discord_not_allowed");
    }
    user.lastLoginAt = new Date().toISOString();
    await this.createAudit({ staffUserId: user.id, staffName: user.username, actionType: "auth.discord_success", reason: "Staff logged in with Discord", ipAddress, success: true });
    return this.staffFromStored(user);
  }

  private async replaceUserPermissions(userId: number, permissions: Permission[] | undefined, grantedBy: number): Promise<void> {
    if (!permissions || !this.a2TablesReady) return;
    const selected = new Set(permissions.filter((permission) => ALL_PERMISSIONS.includes(permission)));
    await execute("DELETE FROM a2_user_permissions WHERE user_id = :userId", { userId });
    for (const permission of ALL_PERMISSIONS) {
      await execute(
        `INSERT INTO a2_user_permissions (user_id, permission_id, allowed, granted_by)
         SELECT :userId, id, :allowed, :grantedBy FROM a2_permissions WHERE name = :permission`,
        { userId, permission, allowed: selected.has(permission) ? 1 : 0, grantedBy }
      );
    }
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    if (this.a2TablesReady) {
      const rows = await queryRows<DbUserRow>("SELECT * FROM a2_users WHERE id = :userId LIMIT 1", { userId });
      const row = rows[0];
      if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
        throw new HttpError(400, "Current password is incorrect", "bad_current_password");
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await execute("UPDATE a2_users SET password_hash = :passwordHash, updated_at = NOW() WHERE id = :userId", { userId, passwordHash });
      return;
    }

    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect", "bad_current_password");
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const activeBans = await this.listBans({});
    const warnings = await this.listWarnings({});
    const reports = await this.listReports({});
    const settings = await this.getSettings();
    const modules = await this.detectModules();

    return {
      serverOnline: this.isBridgeOnline(),
      playersOnline: this.onlinePlayers.length,
      maxPlayers: this.bridgeMaxPlayers,
      staffOnline: 0,
      totalBans: activeBans.filter((ban) => ban.active).length,
      totalWarnings: warnings.length,
      reportsPending: reports.filter((report) => report.status === "pending").length,
      ticketsPending: reports.filter((report) => report.status !== "closed").length,
      bridgeLastSeen: this.bridgeLastSeen,
      performance: this.bridgeMetrics,
      moduleStatus: {
        a2Tables: this.a2TablesReady ? "ok" : "demo",
        bridge: this.isBridgeOnline() ? "ok" : "offline",
        database: this.databaseOnline ? "ok" : "offline",
        players: modules.players,
        vehicles: modules.vehicles,
        esxUsers: modules.esxUsers,
        settings: settings ? "ok" : "demo"
      }
    };
  }

  async detectModules(): Promise<Record<string, "ok" | "missing" | "offline" | "demo">> {
    if (!this.databaseOnline) {
      return { players: "demo", vehicles: "demo", esxUsers: "demo" };
    }

    const status: Record<string, "ok" | "missing" | "offline" | "demo"> = {};
    try {
      status.players = (await tableExists("players")) ? "ok" : "missing";
      status.vehicles = (await tableExists("player_vehicles")) || (await tableExists("owned_vehicles")) ? "ok" : "missing";
      status.esxUsers = (await tableExists("users")) ? "ok" : "missing";
    } catch {
      status.players = "offline";
      status.vehicles = "offline";
      status.esxUsers = "offline";
    }
    return status;
  }

  async recentActivity(limit = 12): Promise<AuditLog[]> {
    return (await this.listAuditLogs({ limit })).slice(0, limit);
  }

  getOnlinePlayers(): OnlinePlayer[] {
    return this.onlinePlayers.map((player) => {
      const stale = Date.now() - new Date(player.lastUpdate).getTime() > 15000;
      return { ...clone(player), status: stale ? "stale" : "online" };
    });
  }

  resolveOnlinePlayer(id: string): OnlinePlayer | null {
    const normalizedDiscord = id.replace(/^discord:/, "");
    return this.getOnlinePlayers().find((player) => (
      String(player.serverId) === id ||
      player.citizenId === id ||
      player.license === id ||
      player.steam === id ||
      player.discordId === id ||
      player.discordId?.replace(/^discord:/, "") === normalizedDiscord
    )) ?? null;
  }

  async searchPlayers(query: string): Promise<{ online: OnlinePlayer[]; offline: OfflinePlayer[] }> {
    const needle = query.trim().toLowerCase();
    const online = this.getOnlinePlayers().filter((player) => {
      const searchable = [
        player.serverId,
        player.characterName,
        player.steamName,
        player.discordId,
        player.license,
        player.steam,
        player.citizenId
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !needle || searchable.includes(needle);
    });

    const offline = await this.searchOfflinePlayers(query);
    return { online, offline };
  }

  async resolvePlayerInfo(query: string): Promise<Record<string, unknown>> {
    const q = query.trim();
    const online = q ? this.resolveOnlinePlayer(q) : null;
    const offlineMatches = q ? await this.searchOfflinePlayers(q) : [];
    const offline = online ? offlineMatches.find((player) => player.citizenId === online.citizenId) ?? null : offlineMatches[0] ?? null;
    const identity = online ?? offline;
    if (!identity) return { found: false, query: q, online: null, offline: null };
    const citizenId = "citizenId" in identity ? identity.citizenId : null;
    return {
      found: true,
      online,
      offline,
      identifiers: {
        serverId: online?.serverId ?? null,
        citizenId,
        characterName: identity.characterName,
        steamName: "steamName" in identity ? identity.steamName ?? null : null,
        discordId: "discordId" in identity ? identity.discordId ?? null : null,
        discord: "discordId" in identity ? identity.discordId?.replace(/^discord:/, "") ?? null : null,
        license: "license" in identity ? identity.license ?? null : null,
        steam: "steam" in identity ? identity.steam ?? null : null,
        fivem: "fivem" in identity ? identity.fivem ?? null : null,
        ip: "ip" in identity ? identity.ip ?? null : null,
        hwid: online?.identifiers?.hwid ?? null
      },
      profile: citizenId ? await this.getPlayerProfile(String(citizenId)) : null
    };
  }

  async searchOfflinePlayers(query: string): Promise<OfflinePlayer[]> {
    const q = query.trim();
    if (!this.databaseOnline || !q) {
      return this.demoOfflinePlayers(q);
    }

    const results: OfflinePlayer[] = [];
    try {
      if (await tableExists("players")) {
        const rows = await queryRows<Record<string, unknown>>(
          `SELECT citizenid, license, name, money, charinfo, job, gang, metadata
           FROM players
           WHERE citizenid LIKE :q OR license LIKE :q OR name LIKE :q OR CAST(charinfo AS CHAR) LIKE :q OR CAST(metadata AS CHAR) LIKE :q
           ORDER BY name ASC
           LIMIT 50`,
          { q: like(q) }
        );
        for (const row of rows) {
          const charinfo = jsonParse<Record<string, unknown>>(row.charinfo, {});
          const money = jsonParse<Record<string, number>>(row.money, {});
          const job = jsonParse<Record<string, unknown>>(row.job, {});
          const gang = jsonParse<Record<string, unknown>>(row.gang, {});
          const metadata = jsonParse<Record<string, unknown>>(row.metadata, {});
          results.push({
            id: String(row.citizenid),
            characterName: [charinfo.firstname, charinfo.lastname].filter(Boolean).join(" ") || String(row.name ?? row.citizenid),
            license: String(row.license ?? ""),
            discordId: metadata.discord ? String(metadata.discord) : null,
            steam: metadata.steam ? String(metadata.steam) : null,
            fivem: metadata.fivem ? String(metadata.fivem) : null,
            citizenId: String(row.citizenid ?? ""),
            phone: String(charinfo.phone ?? ""),
            job: String(job.name ?? ""),
            gang: String(gang.name ?? ""),
            cash: Number(money.cash ?? 0),
            bank: Number(money.bank ?? 0),
            source: "qbcore"
          });
        }
      }

      if (results.length === 0 && (await tableExists("users"))) {
        const rows = await queryRows<Record<string, unknown>>(
          `SELECT identifier, firstname, lastname, accounts, job, job_grade, inventory, loadout
           FROM users
           WHERE identifier LIKE :q OR firstname LIKE :q OR lastname LIKE :q OR CAST(inventory AS CHAR) LIKE :q OR CAST(loadout AS CHAR) LIKE :q
           ORDER BY lastname ASC
           LIMIT 50`,
          { q: like(q) }
        );
        for (const row of rows) {
          const accounts = jsonParse<Record<string, number>>(row.accounts, {});
          results.push({
            id: String(row.identifier),
            characterName: [row.firstname, row.lastname].filter(Boolean).join(" ") || String(row.identifier),
            license: String(row.identifier ?? ""),
            citizenId: String(row.identifier ?? ""),
            job: String(row.job ?? ""),
            cash: Number(accounts.money ?? 0),
            bank: Number(accounts.bank ?? 0),
            black: Number(accounts.black_money ?? 0),
            source: "esx"
          } as OfflinePlayer);
        }
      }
    } catch {
      return this.demoOfflinePlayers(q);
    }

    return results.length ? results : this.demoOfflinePlayers(q);
  }

  private demoOfflinePlayers(query: string): OfflinePlayer[] {
    const sample: OfflinePlayer[] = [
      {
        id: "A2DEMO01",
        characterName: "Demo Citizen",
        steamName: "demo_steam",
        discordId: "100000000000000001",
        license: "license:demo",
        citizenId: "A2DEMO01",
        phone: "555-0101",
        job: "police",
        gang: "none",
        cash: 2500,
        bank: 42000,
        source: "demo"
      }
    ];
    const needle = query.trim().toLowerCase();
    return sample.filter((player) => !needle || JSON.stringify(player).toLowerCase().includes(needle));
  }

  async getPlayerProfile(id: string): Promise<Record<string, unknown>> {
    const online = this.resolveOnlinePlayer(id);
    const lookupId = online?.citizenId || id;
    const offline = (await this.searchOfflinePlayers(lookupId)).find((player) => player.id === lookupId || player.citizenId === lookupId) ?? null;
    const identifiers = [id, lookupId, online?.license, online?.discordId, online?.discordId?.replace(/^discord:/, ""), online?.steam].filter(Boolean).map(String);
    const bans = (await Promise.all(identifiers.map((identifier) => this.listBans({ search: identifier })))).flat().filter((ban, index, all) => all.findIndex((candidate) => candidate.id === ban.id) === index);
    const warnings = (await Promise.all(identifiers.map((identifier) => this.listWarnings({ search: identifier })))).flat().filter((warning, index, all) => all.findIndex((candidate) => candidate.id === warning.id) === index);
    const vehicles = await this.searchVehicles(lookupId);
    const inventory = await this.getInventory(lookupId);
    const money = await this.getMoney(lookupId);
    const logs = (await this.listAuditLogs({ search: lookupId, limit: 20 })).slice(0, 20);

    return {
      online,
      offline,
      vehicles,
      inventory,
      money,
      bans,
      warnings,
      staffNotes: [],
      joinsLeaves: logs.filter((log) => log.actionType.startsWith("player.")),
      adminActions: logs.filter((log) => !log.actionType.startsWith("player."))
    };
  }

  async getInventory(id: string): Promise<{ configured: boolean; items: InventoryItem[]; message?: string }> {
    const online = this.resolveOnlinePlayer(id);
    const lookupId = online?.citizenId || id;

    if (!this.databaseOnline) {
      return {
        configured: true,
        items: [
          { name: "water", label: "Water", amount: 3, slot: 1, imageUrl: configuredItemImageUrl("water") ?? publicItemImageUrl("water") },
          { name: "phone", label: "Phone", amount: 1, slot: 2, imageUrl: configuredItemImageUrl("phone") ?? publicItemImageUrl("phone") }
        ]
      };
    }

    try {
      if (await tableExists("players")) {
        const rows = await queryRows<Record<string, unknown>>("SELECT inventory FROM players WHERE citizenid = :id LIMIT 1", { id: lookupId });
        const inventory = jsonParse<InventoryItem[]>(rows[0]?.inventory, []);
        return { configured: true, items: await this.enrichInventoryItems(inventory) };
      }
      if (await tableExists("users")) {
        const rows = await queryRows<Record<string, unknown>>("SELECT inventory FROM users WHERE identifier = :id LIMIT 1", { id: lookupId });
        const inventory = jsonParse<InventoryItem[]>(rows[0]?.inventory, []);
        return { configured: true, items: await this.enrichInventoryItems(inventory) };
      }
    } catch {
      return { configured: false, items: [], message: "Inventory table or column is not configured for this framework." };
    }

    return { configured: false, items: [], message: "Inventory module is not configured." };
  }

  async getMoney(id: string): Promise<{ configured: boolean; accounts: MoneyAccounts | null; message?: string }> {
    const online = this.resolveOnlinePlayer(id);
    if (online) {
      return { configured: true, accounts: { cash: Number(online.cash ?? 0), bank: Number(online.bank ?? 0) } };
    }
    const lookupId = id;

    if (!this.databaseOnline) {
      return { configured: true, accounts: { cash: 2500, bank: 42000, black: 0 } };
    }

    try {
      if (await tableExists("players")) {
        const rows = await queryRows<Record<string, unknown>>("SELECT money FROM players WHERE citizenid = :id LIMIT 1", { id: lookupId });
        const money = jsonParse<Record<string, number>>(rows[0]?.money, {});
        return { configured: true, accounts: { cash: Number(money.cash ?? 0), bank: Number(money.bank ?? 0) } };
      }
      if (await tableExists("users")) {
        const rows = await queryRows<Record<string, unknown>>("SELECT accounts FROM users WHERE identifier = :id LIMIT 1", { id: lookupId });
        const accounts = jsonParse<Record<string, number>>(rows[0]?.accounts, {});
        return {
          configured: true,
          accounts: {
            cash: Number(accounts.money ?? 0),
            bank: Number(accounts.bank ?? 0),
            black: Number(accounts.black_money ?? 0)
          }
        };
      }
    } catch {
      return { configured: false, accounts: null, message: "Money table or JSON column is not configured for this framework." };
    }

    return { configured: false, accounts: null, message: "Money module is not configured." };
  }

  async searchVehicles(query: string): Promise<VehicleRecord[]> {
    const q = query.trim();
    if (!this.databaseOnline || !q) {
      return [
        {
          id: "demo-vehicle-1",
          citizenId: "A2DEMO01",
          ownerName: "Demo Citizen",
          plate: "A2PANEL",
          vehicle: "sultan",
          garage: "pillbox",
          state: 1,
          mods: {}
        }
      ].filter((vehicle) => !q || JSON.stringify(vehicle).toLowerCase().includes(q.toLowerCase()));
    }

    try {
      if (await tableExists("player_vehicles")) {
        const rows = await queryRows<Record<string, unknown>>(
          `SELECT v.citizenid, v.plate, v.vehicle, v.garage, v.state, v.mods, p.charinfo
           FROM player_vehicles v
           LEFT JOIN players p ON p.citizenid = v.citizenid
           WHERE v.plate LIKE :q OR v.citizenid LIKE :q OR v.vehicle LIKE :q OR CAST(p.charinfo AS CHAR) LIKE :q
           LIMIT 75`,
          { q: like(q) }
        );
        return rows.map((row, index) => ({
          ownerName: (() => {
            const charinfo = jsonParse<Record<string, unknown>>(row.charinfo, {});
            return [charinfo.firstname, charinfo.lastname].filter(Boolean).join(" ") || null;
          })(),
          id: `${row.citizenid}-${row.plate}-${index}`,
          citizenId: String(row.citizenid ?? ""),
          plate: String(row.plate ?? ""),
          vehicle: String(row.vehicle ?? ""),
          garage: String(row.garage ?? ""),
          state: row.state as string | number | null,
          mods: jsonParse(row.mods, {})
        }));
      }

      if (await tableExists("owned_vehicles")) {
        const rows = await queryRows<Record<string, unknown>>(
          `SELECT owner, plate, vehicle, stored
           FROM owned_vehicles
           WHERE plate LIKE :q OR owner LIKE :q
           LIMIT 50`,
          { q: like(q) }
        );
        return rows.map((row, index) => ({
          id: `${row.owner}-${row.plate}-${index}`,
          citizenId: String(row.owner ?? ""),
          plate: String(row.plate ?? ""),
          vehicle: "esx_vehicle",
          state: row.stored as string | number | null,
          mods: jsonParse(row.vehicle, {})
        }));
      }
    } catch {
      return [];
    }

    return [];
  }

  async giveVehicle(input: { citizenId: string; vehicle: string; plate?: string | null; garage?: string | null; state?: number | string | null }, staff: AuthUser, ipAddress: string | null): Promise<VehicleRecord> {
    const plate = (input.plate?.trim() || randomPlate()).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const garage = input.garage?.trim() || "pillbox";
    const state = input.state ?? 1;

    if (this.databaseOnline && await tableExists("player_vehicles")) {
      const columns = await this.tableColumns("player_vehicles");
      const values: Record<string, unknown> = {};
      const add = (column: string, value: unknown) => {
        if (columns.includes(column)) values[column] = value;
      };
      add("license", "");
      add("citizenid", input.citizenId);
      add("vehicle", input.vehicle);
      add("hash", input.vehicle);
      add("mods", "{}");
      add("plate", plate);
      add("garage", garage);
      add("state", state);
      const names = Object.keys(values);
      await execute(
        `INSERT INTO player_vehicles (${names.map((name) => `\`${name}\``).join(",")}) VALUES (${names.map((name) => `:${name}`).join(",")})`,
        values
      );
    } else if (this.databaseOnline && await tableExists("owned_vehicles")) {
      await execute("INSERT INTO owned_vehicles (owner, plate, vehicle, stored) VALUES (:owner, :plate, :vehicle, 1)", {
        owner: input.citizenId,
        plate,
        vehicle: JSON.stringify({ model: input.vehicle, plate })
      });
    } else {
      throw new HttpError(400, "Vehicle table is not configured", "vehicle_table_missing");
    }

    const record: VehicleRecord = { id: `${input.citizenId}-${plate}`, citizenId: input.citizenId, plate, vehicle: input.vehicle, garage, state };
    await this.createAudit({
      staffUserId: staff.id,
      staffName: staff.username,
      actionType: "vehicles.give",
      targetPlayer: input.citizenId,
      reason: `Gave vehicle ${input.vehicle} (${plate})`,
      metadata: record as unknown as Record<string, unknown>,
      ipAddress,
      success: true
    });
    return record;
  }

  async changeVehiclePlate(oldPlate: string, newPlate: string, staff: AuthUser, ipAddress: string | null): Promise<void> {
    const nextPlate = newPlate.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!nextPlate) throw new HttpError(400, "New plate is required", "plate_required");
    let updated = false;
    if (this.databaseOnline && await tableExists("player_vehicles")) {
      await execute("UPDATE player_vehicles SET plate = :newPlate WHERE plate = :oldPlate", { oldPlate, newPlate: nextPlate });
      updated = true;
    }
    if (this.databaseOnline && await tableExists("owned_vehicles")) {
      await execute("UPDATE owned_vehicles SET plate = :newPlate WHERE plate = :oldPlate", { oldPlate, newPlate: nextPlate });
      updated = true;
    }
    if (!updated) throw new HttpError(400, "Vehicle table is not configured", "vehicle_table_missing");
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "vehicles.plate", targetPlayer: oldPlate, reason: `Changed plate ${oldPlate} to ${nextPlate}`, metadata: { oldPlate, newPlate: nextPlate }, ipAddress, success: true });
  }

  async setPhoneNumber(citizenId: string, phone: string, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (this.databaseOnline && await tableExists("players")) {
      const rows = await queryRows<Record<string, unknown>>("SELECT charinfo FROM players WHERE citizenid = :citizenId LIMIT 1", { citizenId });
      if (!rows.length) throw new HttpError(404, "Character not found", "character_not_found");
      const charinfo = jsonParse<Record<string, unknown>>(rows[0].charinfo, {});
      charinfo.phone = phone;
      await execute("UPDATE players SET charinfo = :charinfo WHERE citizenid = :citizenId", { citizenId, charinfo: JSON.stringify(charinfo) });
    } else if (this.databaseOnline && await tableExists("users")) {
      const columns = await this.tableColumns("users");
      const column = columns.includes("phone_number") ? "phone_number" : columns.includes("phone") ? "phone" : null;
      if (!column) throw new HttpError(400, "No phone column found in users table", "phone_column_missing");
      await execute(`UPDATE users SET \`${column}\` = :phone WHERE identifier = :citizenId`, { citizenId, phone });
    } else {
      throw new HttpError(400, "Player table is not configured", "player_table_missing");
    }
    await this.enqueueCommand("character.phone.set", null, { id: citizenId, phone, reason: "Phone number updated" }, staff);
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "players.phone.set", targetPlayer: citizenId, reason: `Phone set to ${phone}`, metadata: { phone }, ipAddress, success: true });
  }

  async setCharacterLocked(citizenId: string, locked: boolean, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (!(this.databaseOnline && await tableExists("players"))) throw new HttpError(400, "QBCore players table is not configured", "players_table_missing");
    const columns = await this.tableColumns("players");
    if (columns.includes("disabled")) {
      await execute("UPDATE players SET disabled = :locked WHERE citizenid = :citizenId", { citizenId, locked: locked ? 1 : 0 });
    } else {
      const rows = await queryRows<Record<string, unknown>>("SELECT metadata FROM players WHERE citizenid = :citizenId LIMIT 1", { citizenId });
      if (!rows.length) throw new HttpError(404, "Character not found", "character_not_found");
      const metadata = jsonParse<Record<string, unknown>>(rows[0].metadata, {});
      metadata.a2_locked = locked;
      await execute("UPDATE players SET metadata = :metadata WHERE citizenid = :citizenId", { citizenId, metadata: JSON.stringify(metadata) });
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: locked ? "characters.lock" : "characters.unlock", targetPlayer: citizenId, reason: locked ? "Character locked" : "Character unlocked", metadata: { citizenId, locked }, ipAddress, success: true });
  }

  async deleteCharacter(citizenId: string, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (!(this.databaseOnline && await tableExists("players"))) throw new HttpError(400, "QBCore players table is not configured", "players_table_missing");
    await execute("DELETE FROM players WHERE citizenid = :citizenId", { citizenId });
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "characters.delete", targetPlayer: citizenId, reason: "Deleted character", metadata: { citizenId }, ipAddress, success: true });
  }

  async listStashes(search = ""): Promise<StashRecord[]> {
    if (!this.databaseOnline) return [];
    const q = search.trim();
    try {
      if (await tableExists("stashitems")) {
        const rows = await queryRows<Record<string, unknown>>(
          `SELECT stash, items FROM stashitems ${q ? "WHERE stash LIKE :q OR CAST(items AS CHAR) LIKE :q" : ""} ORDER BY stash ASC LIMIT 200`,
          q ? { q: like(q) } : {}
        );
        const stashes = await Promise.all(rows.map(async (row) => ({
          id: String(row.stash ?? ""),
          label: String(row.stash ?? ""),
          owner: null,
          items: await this.enrichInventoryItems(jsonParse<unknown[]>(row.items, [])),
          source: "stashitems",
          updatedAt: null
        })));
        return stashes;
      }
      if (await tableExists("inventories")) {
        const rows = await queryRows<Record<string, unknown>>(
          `SELECT identifier, owner, items, data, updated_at FROM inventories ${q ? "WHERE identifier LIKE :q OR owner LIKE :q OR CAST(items AS CHAR) LIKE :q OR CAST(data AS CHAR) LIKE :q" : ""} ORDER BY identifier ASC LIMIT 200`,
          q ? { q: like(q) } : {}
        );
        const stashes = await Promise.all(rows.map(async (row) => ({
          id: String(row.identifier ?? row.owner ?? ""),
          label: String(row.identifier ?? "stash"),
          owner: row.owner ? String(row.owner) : null,
          items: await this.enrichInventoryItems(jsonParse<unknown[]>(row.items ?? row.data, [])),
          source: "inventories",
          updatedAt: iso(row.updated_at as Date | string)
        })));
        return stashes;
      }
    } catch {
      return [];
    }
    return [];
  }

  async getFrameworkOptions(): Promise<{ jobs: FrameworkOption[]; gangs: FrameworkOption[] }> {
    const fallback = {
      jobs: [
        { name: "police", label: "Police", grades: [{ level: 0, name: "cadet", label: "Cadet" }, { level: 1, name: "officer", label: "Officer" }] },
        { name: "ambulance", label: "EMS", grades: [{ level: 0, name: "emt", label: "EMT" }] },
        { name: "unemployed", label: "Unemployed", grades: [{ level: 0, name: "none", label: "None" }] }
      ],
      gangs: [
        { name: "none", label: "None", grades: [{ level: 0, name: "none", label: "None" }] }
      ]
    };
    if (!this.databaseOnline) return fallback;
    try {
      if (!(await tableExists("players"))) return fallback;
      const rows = await queryRows<Record<string, unknown>>("SELECT job, gang FROM players LIMIT 2000");
      const collect = (key: "job" | "gang") => {
        const map = new Map<string, FrameworkOption>();
        for (const row of rows) {
          const raw = jsonParse<Record<string, unknown>>(row[key], {});
          const name = String(raw.name ?? (key === "gang" ? "none" : "unemployed"));
          const label = String(raw.label ?? name);
          const grade = raw.grade && typeof raw.grade === "object" ? raw.grade as Record<string, unknown> : {};
          const level = grade.level ?? 0;
          const gradeName = String(grade.name ?? level);
          const gradeLabel = String(grade.label ?? gradeName);
          if (!map.has(name)) map.set(name, { name, label, grades: [] });
          const option = map.get(name)!;
          if (!option.grades.some((item) => String(item.level) === String(level))) {
            option.grades.push({ level: level as string | number, name: gradeName, label: gradeLabel });
          }
        }
        return [...map.values()].map((option) => ({ ...option, grades: option.grades.sort((a, b) => Number(a.level) - Number(b.level)) }));
      };
      return { jobs: collect("job"), gangs: collect("gang") };
    } catch {
      return fallback;
    }
  }

  async setMoney(id: string, account: string, mode: "add" | "remove" | "set", amount: number, reason: string, staff: AuthUser, ipAddress: string | null): Promise<void> {
    await this.enqueueCommand(mode === "set" ? "money.set" : `money.${mode}`, Number(id) || null, { id, account, amount, reason }, staff);
    await this.createAudit({
      staffUserId: staff.id,
      staffName: staff.username,
      actionType: "players.money.edit",
      targetPlayer: id,
      reason,
      metadata: { account, mode, amount },
      ipAddress,
      success: true
    });
  }

  async updateJobGang(kind: "job" | "gang", id: string, name: string, grade: string | number, reason: string, staff: AuthUser, ipAddress: string | null): Promise<void> {
    await this.enqueueCommand(`players.${kind}.set`, Number(id) || null, { id, name, grade, reason }, staff);
    await this.createAudit({
      staffUserId: staff.id,
      staffName: staff.username,
      actionType: `players.${kind}.edit`,
      targetPlayer: id,
      reason,
      metadata: { name, grade },
      ipAddress,
      success: true
    });
  }

  async inventoryAction(type: "give" | "remove", id: string, item: string, amount: number, reason: string, metadata: unknown, staff: AuthUser, ipAddress: string | null, slot?: number | null): Promise<void> {
    const isWeapon = item.toLowerCase().startsWith("weapon_");
    if (type === "give" && isWeapon && amount > 1) {
      for (let index = 0; index < amount; index += 1) {
        await this.enqueueCommand("inventory.give", Number(id) || null, {
          id,
          item,
          amount: 1,
          reason,
          metadata: { ...(metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {}), serial: randomWeaponSerial() }
        }, staff);
      }
    } else {
      await this.enqueueCommand(`inventory.${type}`, Number(id) || null, { id, item, amount, reason, metadata, slot: slot ?? undefined }, staff);
    }
    await this.createAudit({
      staffUserId: staff.id,
      staffName: staff.username,
      actionType: `players.inventory.${type}`,
      targetPlayer: id,
      reason,
      metadata: { item, amount, slot, direction: type === "give" ? "added" : "removed" },
      ipAddress,
      success: true
    });
  }

  async clearInventory(id: string, reason: string, staff: AuthUser, ipAddress: string | null): Promise<void> {
    const online = this.resolveOnlinePlayer(id);
    const lookupId = online?.citizenId || id;
    await this.enqueueCommand("inventory.clear", Number(id) || null, { id, reason }, staff);
    if (this.databaseOnline && await tableExists("players")) {
      await execute("UPDATE players SET inventory = '[]' WHERE citizenid = :id", { id: lookupId });
    } else if (this.databaseOnline && await tableExists("users")) {
      await execute("UPDATE users SET inventory = '[]' WHERE identifier = :id", { id: lookupId });
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "players.inventory.clear", targetPlayer: id, reason, metadata: { id }, ipAddress, success: true });
  }

  async playerAction(type: string, id: string, payload: Record<string, unknown>, staff: AuthUser, ipAddress: string | null): Promise<BridgeCommand> {
    const command = await this.enqueueCommand(type, Number(id) || null, { id, ...payload }, staff);
    await this.createAudit({
      staffUserId: staff.id,
      staffName: staff.username,
      actionType: `players.${type}`,
      targetPlayer: id,
      reason: typeof payload.reason === "string" ? payload.reason : null,
      metadata: payload,
      ipAddress,
      success: true
    });
    this.emit("admin.action", { type, target: id, staff: staff.username, bridgeOnline: this.isBridgeOnline() });
    return command;
  }

  async requestWatchSnapshot(id: string, staff: AuthUser, ipAddress: string | null): Promise<BridgeCommand> {
    const command = await this.enqueueCommand("screenshot", Number(id) || null, { id, watch: true, reason: "Live player watch snapshot" }, staff);
    await this.createAudit({
      staffUserId: staff.id,
      staffName: staff.username,
      actionType: "players.watch.snapshot",
      targetPlayer: id,
      reason: "Requested live watch frame",
      metadata: { commandId: command.id },
      ipAddress,
      success: true
    });
    return command;
  }

  getWatchFrame(id: string): WatchFrame | null {
    return this.watchFrames.get(id) ?? null;
  }

  handleScreenshotUpload(commandId: string, dataUrl: string): WatchFrame | null {
    const command = this.commands.find((candidate) => candidate.id === commandId);
    if (!command || !dataUrl.startsWith("data:image/")) return null;
    const target = String(command.payload.id ?? command.targetServerId ?? "");
    const frame: WatchFrame = {
      commandId,
      target,
      image: dataUrl,
      createdAt: new Date().toISOString(),
      requestedBy: command.requestedBy?.username ?? null
    };
    this.watchFrames.set(target, frame);
    this.emit("screenshot.updated", { target, commandId, createdAt: frame.createdAt, requestedBy: frame.requestedBy });
    return frame;
  }

  async enqueueCommand(type: string, targetServerId: number | null, payload: Record<string, unknown>, requestedBy: AuthUser | null): Promise<BridgeCommand> {
    const now = new Date().toISOString();
    const command: BridgeCommand = {
      id: crypto.randomUUID(),
      type,
      targetServerId,
      payload,
      requestedBy,
      status: "queued",
      result: null,
      createdAt: now,
      updatedAt: now
    };
    this.commands.unshift(command);
    if (this.a2TablesReady) {
      try {
        await execute(
          `INSERT INTO a2_player_action_history (command_id, action_type, target_identifier, target_server_id, staff_user_id, staff_name, reason, payload, status)
           VALUES (:commandId, :actionType, :targetIdentifier, :targetServerId, :staffUserId, :staffName, :reason, :payload, 'queued')`,
          {
            commandId: command.id,
            actionType: type,
            targetIdentifier: String(payload.id ?? targetServerId ?? ""),
            targetServerId,
            staffUserId: requestedBy?.id ?? null,
            staffName: requestedBy?.username ?? "A2 Panel",
            reason: typeof payload.reason === "string" ? payload.reason : null,
            payload: JSON.stringify(payload)
          }
        );
      } catch {
        // Action history should never block live command delivery.
      }
    }
    if (!this.isBridgeOnline()) {
      this.notify("Bridge offline", `${type} queued while bridge is offline.`, "warning");
    }
    return command;
  }

  handleBridgeHeartbeat(payload: Record<string, unknown>): void {
    this.bridgeLastSeen = new Date().toISOString();
    this.bridgeMaxPlayers = Number(payload.maxPlayers ?? this.bridgeMaxPlayers);
    this.bridgeMetrics = {
      ping: typeof payload.ping === "number" ? payload.ping : this.bridgeMetrics.ping,
      cpu: typeof payload.cpu === "number" ? payload.cpu : this.bridgeMetrics.cpu,
      memory: typeof payload.memory === "number" ? payload.memory : this.bridgeMetrics.memory,
      resources: typeof payload.resources === "number" ? payload.resources : this.bridgeMetrics.resources
    };
    this.emit("server.status", { online: true, lastSeen: this.bridgeLastSeen, metrics: this.bridgeMetrics });
  }

  updateBridgePlayers(players: OnlinePlayer[]): void {
    const now = new Date().toISOString();
    this.onlinePlayers = players.map((player) => ({
      ...player,
      serverId: Number(player.serverId),
      lastUpdate: player.lastUpdate ?? now,
      status: "online"
    }));
    this.emit("players.updated", this.getOnlinePlayers());
  }

  async handleBridgeEvent(event: string, payload: Record<string, unknown>): Promise<void> {
    if (event === "report.created") {
      const report = await this.createReport({
        reporterName: String(payload.reporterName ?? "Unknown Player"),
        reporterServerId: payload.reporterServerId ? Number(payload.reporterServerId) : null,
        reporterCitizenId: payload.reporterCitizenId ? String(payload.reporterCitizenId) : null,
        message: String(payload.message ?? "")
      });
      this.emit("report.created", report);
      return;
    }

    await this.createAudit({
      staffName: "FiveM Bridge",
      actionType: event,
      targetPlayer: payload.target ? String(payload.target) : null,
      reason: typeof payload.reason === "string" ? payload.reason : null,
      metadata: payload,
      ipAddress: null,
      success: true
    });
    this.emit(event, payload);
  }

  pollBridgeCommands(): BridgeCommand[] {
    const pending = this.commands.filter((command) => command.status === "queued").slice(0, 20);
    const now = new Date().toISOString();
    for (const command of pending) {
      command.status = "sent";
      command.updatedAt = now;
    }
    return clone(pending);
  }

  async completeBridgeCommand(commandId: string, success: boolean, result: Record<string, unknown>): Promise<void> {
    const command = this.commands.find((candidate) => candidate.id === commandId);
    if (!command) return;
    command.status = success ? "complete" : "failed";
    command.result = result;
    command.updatedAt = new Date().toISOString();
    if (this.a2TablesReady) {
      try {
        await execute(
          "UPDATE a2_player_action_history SET status = :status, result = :result, updated_at = NOW() WHERE command_id = :commandId",
          { commandId, status: command.status, result: JSON.stringify(result) }
        );
      } catch {
        // Keep command completion resilient if history storage fails.
      }
    }
    await this.createAudit({
      staffUserId: command.requestedBy?.id,
      staffName: command.requestedBy?.username ?? "FiveM Bridge",
      actionType: `bridge.command.${command.type}`,
      targetPlayer: command.targetServerId ? String(command.targetServerId) : null,
      reason: typeof command.payload.reason === "string" ? command.payload.reason : null,
      metadata: { commandId, result },
      ipAddress: null,
      success
    });
    if (!success) {
      this.notify("Command failed", `${command.type}: ${String(result.message ?? "Failed")}`, "error");
    }
  }

  async listBans(filters: { search?: string; active?: string }): Promise<BanRecord[]> {
    if (this.a2TablesReady) {
      const where: string[] = [];
      const params: Record<string, unknown> = {};
      if (filters.search) {
        where.push("(target_name LIKE :search OR citizenid LIKE :search OR license LIKE :search OR discord LIKE :search OR reason LIKE :search)");
        params.search = like(filters.search);
      }
      if (filters.active === "true") where.push("active = 1");
      if (filters.active === "false") where.push("active = 0");
      const rows = await queryRows<Record<string, unknown>>(
        `SELECT * FROM a2_bans ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 500`,
        params
      );
      return rows.map(this.mapBan);
    }

    return this.bans
      .filter((ban) => {
        const searchOk = !filters.search || JSON.stringify(ban).toLowerCase().includes(filters.search.toLowerCase());
        const activeOk = filters.active === undefined || String(ban.active) === filters.active;
        return searchOk && activeOk;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  private mapBan(row: Record<string, unknown>): BanRecord {
    return {
      id: Number(row.id),
      targetName: String(row.target_name ?? "Unknown"),
      citizenId: row.citizenid ? String(row.citizenid) : null,
      license: row.license ? String(row.license) : null,
      steam: row.steam ? String(row.steam) : null,
      discord: row.discord ? String(row.discord) : null,
      fivem: row.fivem ? String(row.fivem) : null,
      ip: row.ip ? String(row.ip) : null,
      hwid: row.hwid ? String(row.hwid) : null,
      reason: String(row.reason ?? ""),
      evidence: row.evidence ? String(row.evidence) : null,
      staffUserId: row.staff_user_id ? Number(row.staff_user_id) : null,
      staffName: String(row.staff_name ?? "Unknown"),
      permanent: Boolean(row.permanent),
      expiresAt: iso(row.expires_at as Date | string | null),
      active: Boolean(row.active),
      evasionNotes: row.evasion_notes ? String(row.evasion_notes) : null,
      metadata: jsonParse<Record<string, unknown>>(row.metadata, {}),
      createdAt: iso(row.created_at as Date | string) ?? new Date().toISOString(),
      updatedAt: iso(row.updated_at as Date | string) ?? new Date().toISOString()
    };
  }

  async createBan(input: Partial<BanRecord>, staff: AuthUser, ipAddress: string | null): Promise<BanRecord> {
    const now = new Date().toISOString();
    const record: BanRecord = {
      id: this.nextId(this.bans),
      targetName: input.targetName || "Unknown Player",
      citizenId: input.citizenId ?? null,
      license: input.license ?? null,
      steam: input.steam ?? null,
      discord: input.discord ?? null,
      fivem: input.fivem ?? null,
      ip: input.ip ?? null,
      hwid: input.hwid ?? (input.metadata && typeof input.metadata.hwid === "string" ? input.metadata.hwid : null),
      reason: input.reason || "No reason provided",
      evidence: input.evidence ?? null,
      staffUserId: staff.id,
      staffName: staff.username,
      permanent: Boolean(input.permanent),
      expiresAt: input.permanent ? null : input.expiresAt ?? null,
      active: true,
      evasionNotes: input.evasionNotes ?? null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now
    };

    if (this.a2TablesReady) {
      const result = await execute(
        `INSERT INTO a2_bans
          (target_name, citizenid, license, steam, discord, fivem, ip, hwid, reason, evidence, staff_user_id, staff_name, permanent, expires_at, active, evasion_notes, metadata)
         VALUES
          (:targetName, :citizenId, :license, :steam, :discord, :fivem, :ip, :hwid, :reason, :evidence, :staffUserId, :staffName, :permanent, :expiresAt, 1, :evasionNotes, :metadata)`,
        { ...record, permanent: record.permanent ? 1 : 0, metadata: JSON.stringify(record.metadata) }
      );
      record.id = result.insertId;
    } else {
      this.bans.unshift(record);
    }

    await this.createAudit({
      staffUserId: staff.id,
      staffName: staff.username,
      actionType: "bans.create",
      targetPlayer: record.targetName,
      reason: record.reason,
      metadata: record as unknown as Record<string, unknown>,
      ipAddress,
      success: true
    });
    this.emit("ban.created", record);
    this.notify("Ban created", `${record.targetName}: ${record.reason}`, "warning");
    return record;
  }

  async checkActiveBan(input: { citizenId?: string | null; license?: string | null; steam?: string | null; discord?: string | null; fivem?: string | null; ip?: string | null; hwid?: string | null; identifiers?: Record<string, string> }): Promise<{ banned: boolean; ban?: BanRecord; reason?: string }> {
    const identifiers = input.identifiers ?? {};
    const candidates = {
      citizenId: input.citizenId ?? null,
      license: input.license ?? identifiers.license ?? null,
      steam: input.steam ?? identifiers.steam ?? null,
      discord: (input.discord ?? identifiers.discord ?? null)?.replace(/^discord:/, "") ?? null,
      fivem: input.fivem ?? identifiers.fivem ?? null,
      ip: input.ip ?? identifiers.ip ?? null,
      hwid: input.hwid ?? identifiers.hwid ?? null
    };

    if (this.a2TablesReady) {
      const where: string[] = ["active = 1", "(expires_at IS NULL OR expires_at > NOW())"];
      const params: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(candidates)) {
        if (!value) continue;
        const column = key === "citizenId" ? "citizenid" : key;
        where.push(`${column} = :${key}`);
        params[key] = value;
      }
      if (where.length <= 2) return { banned: false };
      const rows = await queryRows<Record<string, unknown>>(
        `SELECT * FROM a2_bans WHERE ${where.slice(0, 2).join(" AND ")} AND (${where.slice(2).join(" OR ")}) ORDER BY created_at DESC LIMIT 1`,
        params
      );
      const ban = rows[0] ? this.mapBan(rows[0]) : null;
      return ban ? { banned: true, ban, reason: ban.reason } : { banned: false };
    }

    const ban = this.bans.find((candidate) => {
      if (!candidate.active) return false;
      if (candidate.expiresAt && Date.parse(candidate.expiresAt) <= Date.now()) return false;
      return (
        (candidates.citizenId && candidate.citizenId === candidates.citizenId) ||
        (candidates.license && candidate.license === candidates.license) ||
        (candidates.discord && candidate.discord?.replace(/^discord:/, "") === candidates.discord) ||
        (candidates.steam && candidate.steam === candidates.steam) ||
        (candidates.hwid && candidate.hwid === candidates.hwid)
      );
    });
    return ban ? { banned: true, ban, reason: ban.reason } : { banned: false };
  }

  async updateBan(id: number, patch: Partial<BanRecord>, staff: AuthUser, ipAddress: string | null): Promise<BanRecord> {
    if (this.a2TablesReady) {
      await execute(
        `UPDATE a2_bans
         SET reason = COALESCE(:reason, reason),
             evidence = COALESCE(:evidence, evidence),
             evasion_notes = COALESCE(:evasionNotes, evasion_notes),
             updated_at = NOW()
         WHERE id = :id`,
        { id, reason: patch.reason ?? null, evidence: patch.evidence ?? null, evasionNotes: patch.evasionNotes ?? null }
      );
      const record = (await this.listBans({ search: String(id) })).find((ban) => ban.id === id);
      if (!record) throw new HttpError(404, "Ban not found", "ban_not_found");
      await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "bans.edit", targetPlayer: record.targetName, reason: patch.reason, metadata: patch, ipAddress, success: true });
      return record;
    }

    const record = this.bans.find((ban) => ban.id === id);
    if (!record) throw new HttpError(404, "Ban not found", "ban_not_found");
    Object.assign(record, patch, { updatedAt: new Date().toISOString() });
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "bans.edit", targetPlayer: record.targetName, reason: patch.reason, metadata: patch, ipAddress, success: true });
    return clone(record);
  }

  async unban(id: number, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (this.a2TablesReady) {
      await execute("UPDATE a2_bans SET active = 0, updated_at = NOW() WHERE id = :id", { id });
    } else {
      const record = this.bans.find((ban) => ban.id === id);
      if (record) {
        record.active = false;
        record.updatedAt = new Date().toISOString();
      }
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "bans.unban", targetPlayer: String(id), reason: "Unban", metadata: { id }, ipAddress, success: true });
  }

  async deleteBan(id: number, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (this.a2TablesReady) {
      await execute("DELETE FROM a2_bans WHERE id = :id", { id });
    } else {
      this.bans = this.bans.filter((ban) => ban.id !== id);
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "bans.delete", targetPlayer: String(id), reason: "Deleted ban record", metadata: { id }, ipAddress, success: true });
  }

  async listWarnings(filters: { search?: string }): Promise<WarningRecord[]> {
    if (this.a2TablesReady) {
      const params: Record<string, unknown> = {};
      const where = filters.search
        ? "WHERE target_name LIKE :search OR citizenid LIKE :search OR license LIKE :search OR reason LIKE :search"
        : "";
      if (filters.search) params.search = like(filters.search);
      const rows = await queryRows<Record<string, unknown>>(`SELECT * FROM a2_warnings ${where} ORDER BY created_at DESC LIMIT 500`, params);
      return rows.map((row) => ({
        id: Number(row.id),
        targetName: String(row.target_name ?? "Unknown"),
        citizenId: row.citizenid ? String(row.citizenid) : null,
        license: row.license ? String(row.license) : null,
        severity: String(row.severity ?? "low") as WarningRecord["severity"],
        reason: String(row.reason ?? ""),
        evidence: row.evidence ? String(row.evidence) : null,
        staffUserId: row.staff_user_id ? Number(row.staff_user_id) : null,
        staffName: String(row.staff_name ?? "Unknown"),
        createdAt: iso(row.created_at as Date | string) ?? new Date().toISOString()
      }));
    }

    return this.warnings.filter((warning) => !filters.search || JSON.stringify(warning).toLowerCase().includes(filters.search.toLowerCase()));
  }

  async createWarning(input: Partial<WarningRecord>, staff: AuthUser, ipAddress: string | null): Promise<WarningRecord> {
    const record: WarningRecord = {
      id: this.nextId(this.warnings),
      targetName: input.targetName || "Unknown Player",
      citizenId: input.citizenId ?? null,
      license: input.license ?? null,
      severity: input.severity ?? "low",
      reason: input.reason || "No reason provided",
      evidence: input.evidence ?? null,
      staffUserId: staff.id,
      staffName: staff.username,
      createdAt: new Date().toISOString()
    };

    if (this.a2TablesReady) {
      const result = await execute(
        `INSERT INTO a2_warnings (target_name, citizenid, license, severity, reason, evidence, staff_user_id, staff_name)
         VALUES (:targetName, :citizenId, :license, :severity, :reason, :evidence, :staffUserId, :staffName)`,
        record as unknown as Record<string, unknown>
      );
      record.id = result.insertId;
    } else {
      this.warnings.unshift(record);
    }

    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "warnings.create", targetPlayer: record.targetName, reason: record.reason, metadata: record as unknown as Record<string, unknown>, ipAddress, success: true });
    this.emit("warning.created", record);
    this.notify("Warning issued", `${record.targetName}: ${record.reason}`, "warning");
    return record;
  }

  async deleteWarning(id: number, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (this.a2TablesReady) {
      await execute("DELETE FROM a2_warnings WHERE id = :id", { id });
    } else {
      this.warnings = this.warnings.filter((warning) => warning.id !== id);
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "warnings.delete", targetPlayer: String(id), reason: "Deleted warning", metadata: { id }, ipAddress, success: true });
  }

  async listReports(filters: { status?: string } = {}): Promise<ReportRecord[]> {
    if (this.a2TablesReady) {
      const params: Record<string, unknown> = {};
      const where = filters.status ? "WHERE status = :status" : "";
      if (filters.status) params.status = filters.status;
      const reports = await queryRows<Record<string, unknown>>(`SELECT * FROM a2_reports ${where} ORDER BY created_at DESC LIMIT 500`, params);
      const notes = await queryRows<Record<string, unknown>>("SELECT * FROM a2_report_notes ORDER BY created_at ASC");
      return reports.map((row) => ({
        id: Number(row.id),
        reporterName: String(row.reporter_name ?? "Unknown"),
        reporterServerId: row.reporter_server_id ? Number(row.reporter_server_id) : null,
        reporterCitizenId: row.reporter_citizenid ? String(row.reporter_citizenid) : null,
        message: String(row.message ?? ""),
        status: String(row.status ?? "pending") as ReportRecord["status"],
        assignedStaffId: row.assigned_staff_id ? Number(row.assigned_staff_id) : null,
        assignedStaffName: row.assigned_staff_name ? String(row.assigned_staff_name) : null,
        resolution: row.resolution ? String(row.resolution) : null,
        notes: notes
          .filter((note) => Number(note.report_id) === Number(row.id))
          .map((note) => ({
            id: Number(note.id),
            reportId: Number(note.report_id),
            staffUserId: note.staff_user_id ? Number(note.staff_user_id) : null,
            staffName: String(note.staff_name ?? "Unknown"),
            note: String(note.note ?? ""),
            createdAt: iso(note.created_at as Date | string) ?? new Date().toISOString()
          })),
        createdAt: iso(row.created_at as Date | string) ?? new Date().toISOString(),
        updatedAt: iso(row.updated_at as Date | string) ?? new Date().toISOString()
      }));
    }

    return this.reports.filter((report) => !filters.status || report.status === filters.status);
  }

  async createReport(input: { reporterName: string; reporterServerId?: number | null; reporterCitizenId?: string | null; message: string }): Promise<ReportRecord> {
    const now = new Date().toISOString();
    const record: ReportRecord = {
      id: this.nextId(this.reports),
      reporterName: input.reporterName,
      reporterServerId: input.reporterServerId ?? null,
      reporterCitizenId: input.reporterCitizenId ?? null,
      message: input.message,
      status: "pending",
      notes: [],
      createdAt: now,
      updatedAt: now
    };

    if (this.a2TablesReady) {
      const result = await execute(
        `INSERT INTO a2_reports (reporter_name, reporter_server_id, reporter_citizenid, message, status)
         VALUES (:reporterName, :reporterServerId, :reporterCitizenId, :message, 'pending')`,
        record as unknown as Record<string, unknown>
      );
      record.id = result.insertId;
    } else {
      this.reports.unshift(record);
    }

    this.emit("notification.created", {
      title: "New report",
      message: `${record.reporterName}: ${record.message}`,
      level: "info",
      createdAt: now
    });
    return record;
  }

  async claimReport(id: number, staff: AuthUser, ipAddress: string | null): Promise<ReportRecord> {
    if (this.a2TablesReady) {
      await execute("UPDATE a2_reports SET status = 'claimed', assigned_staff_id = :staffId, assigned_staff_name = :staffName, updated_at = NOW() WHERE id = :id", {
        id,
        staffId: staff.id,
        staffName: staff.username
      });
    } else {
      const report = this.reports.find((candidate) => candidate.id === id);
      if (!report) throw new HttpError(404, "Report not found", "report_not_found");
      report.status = "claimed";
      report.assignedStaffId = staff.id;
      report.assignedStaffName = staff.username;
      report.updatedAt = new Date().toISOString();
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "reports.claim", targetPlayer: String(id), reason: "Report claimed", metadata: { id }, ipAddress, success: true });
    const report = (await this.listReports({})).find((candidate) => candidate.id === id);
    if (!report) throw new HttpError(404, "Report not found", "report_not_found");
    this.emit("report.updated", report);
    this.notify("Report claimed", `#${id} claimed by ${staff.username}`, "info");
    return report;
  }

  async closeReport(id: number, resolution: string, staff: AuthUser, ipAddress: string | null): Promise<ReportRecord> {
    if (this.a2TablesReady) {
      await execute("UPDATE a2_reports SET status = 'closed', resolution = :resolution, updated_at = NOW() WHERE id = :id", { id, resolution });
    } else {
      const report = this.reports.find((candidate) => candidate.id === id);
      if (!report) throw new HttpError(404, "Report not found", "report_not_found");
      report.status = "closed";
      report.resolution = resolution;
      report.updatedAt = new Date().toISOString();
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "reports.close", targetPlayer: String(id), reason: resolution, metadata: { id }, ipAddress, success: true });
    const report = (await this.listReports({})).find((candidate) => candidate.id === id);
    if (!report) throw new HttpError(404, "Report not found", "report_not_found");
    this.emit("report.updated", report);
    this.notify("Report closed", `#${id}: ${resolution}`, "success");
    return report;
  }

  async deleteReport(id: number, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (this.a2TablesReady) {
      await execute("DELETE FROM a2_reports WHERE id = :id", { id });
    } else {
      this.reports = this.reports.filter((report) => report.id !== id);
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "reports.delete", targetPlayer: String(id), reason: "Deleted report history", metadata: { id }, ipAddress, success: true });
    this.notify("Report deleted", `#${id} deleted by ${staff.username}`, "warning");
  }

  async addReportNote(id: number, note: string, staff: AuthUser, ipAddress: string | null): Promise<ReportNote> {
    const record: ReportNote = { id: 1, reportId: id, staffUserId: staff.id, staffName: staff.username, note, createdAt: new Date().toISOString() };
    if (this.a2TablesReady) {
      const result = await execute("INSERT INTO a2_report_notes (report_id, staff_user_id, staff_name, note) VALUES (:reportId, :staffUserId, :staffName, :note)", record as unknown as Record<string, unknown>);
      record.id = result.insertId;
    } else {
      const report = this.reports.find((candidate) => candidate.id === id);
      if (!report) throw new HttpError(404, "Report not found", "report_not_found");
      record.id = this.nextId(report.notes);
      report.notes.push(record);
      report.updatedAt = new Date().toISOString();
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "reports.note", targetPlayer: String(id), reason: note, metadata: { id }, ipAddress, success: true });
    return record;
  }

  async replyToReport(id: number, message: string, staff: AuthUser, ipAddress: string | null): Promise<{ report: ReportRecord; note: ReportNote; command: BridgeCommand | null }> {
    const report = (await this.listReports({})).find((candidate) => candidate.id === id);
    if (!report) throw new HttpError(404, "Report not found", "report_not_found");
    const note = await this.addReportNote(id, `Reply to player: ${message}`, staff, ipAddress);
    let command: BridgeCommand | null = null;
    if (report.reporterServerId) {
      command = await this.enqueueCommand("message", report.reporterServerId, { id: report.reporterServerId, message: `[Report #${id}] ${message}`, reason: "Report reply" }, staff);
    }
    if (this.a2TablesReady) {
      try {
        await execute("UPDATE a2_report_notes SET sent_to_player = 1 WHERE id = :id", { id: note.id });
      } catch {
        // Older schemas may not have sent_to_player until migrations are applied.
      }
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "reports.reply", targetPlayer: String(report.reporterServerId ?? report.reporterCitizenId ?? id), reason: message, metadata: { reportId: id, commandId: command?.id }, ipAddress, success: true });
    this.notify("Report reply sent", `#${id}: ${message}`, "success");
    return { report: (await this.listReports({})).find((candidate) => candidate.id === id) ?? report, note, command };
  }

  async listStaff(): Promise<StaffUser[]> {
    if (this.a2TablesReady) {
      const rows = await queryRows<DbUserRow>(
        `SELECT u.*, r.name AS role_name
         FROM a2_users u
         LEFT JOIN a2_roles r ON r.id = u.role_id
         WHERE u.deleted_at IS NULL
         ORDER BY u.created_at DESC`
      );
      const staff: StaffUser[] = [];
      for (const row of rows) {
        const roleName = normalizeRoleName(row.role_name);
        staff.push({
          ...this.authFromDbRow(row, await this.getDbPermissions(row.role_id, roleName, row.id)),
          lastLoginAt: iso(row.last_login_at),
          createdAt: iso(row.created_at) ?? new Date().toISOString()
        });
      }
      return staff;
    }
    return this.users.map((user) => this.staffFromStored(user));
  }

  async createStaff(input: { username?: string; displayName: string; email?: string | null; password?: string; roleName: RoleName; discordId?: string | null; permissions?: Permission[] }, staff: AuthUser, ipAddress: string | null): Promise<StaffUser> {
    const discordId = cleanDiscordId(input.discordId);
    const email = input.email?.trim() || null;
    const username = (input.username?.trim() || (discordId ? `discord_${discordId}` : input.displayName)).slice(0, 64);
    const loginProvider = discordId && !input.password ? "discord" : discordId ? "both" : "password";
    if (this.a2TablesReady) {
      const roleRows = await queryRows<{ id: number }>("SELECT id FROM a2_roles WHERE name = :roleName LIMIT 1", { roleName: input.roleName });
      const roleId = roleRows[0]?.id;
      if (!roleId) throw new HttpError(400, "Role not found", "role_not_found");
      const passwordHash = await bcrypt.hash(input.password || crypto.randomBytes(24).toString("hex"), 12);
      const result = await execute(
        `INSERT INTO a2_users (username, display_name, email, discord_id, password_hash, login_provider, role_id)
         VALUES (:username, :displayName, :email, :discordId, :passwordHash, :loginProvider, :roleId)`,
        {
        username,
        displayName: input.displayName,
        email,
        discordId,
        passwordHash,
        loginProvider,
        roleId
      });
      await this.replaceUserPermissions(result.insertId, input.permissions, staff.id);
      await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "staff.create", targetPlayer: username, reason: "Created staff account", metadata: { roleName: input.roleName, email, discordId, permissions: input.permissions }, ipAddress, success: true });
      const created = await this.getUserById(result.insertId);
      if (!created) throw new HttpError(500, "Staff account was created but could not be loaded", "staff_load_failed");
      return { ...created, lastLoginAt: null, createdAt: new Date().toISOString() };
    }

    const record: StoredUser = {
      id: this.nextId(this.users),
      username,
      displayName: input.displayName,
      email,
      discordId,
      loginProvider: loginProvider as StaffUser["loginProvider"],
      roleName: input.roleName,
      permissions: input.permissions?.filter((permission) => ALL_PERMISSIONS.includes(permission)) ?? ROLE_PERMISSIONS[input.roleName],
      disabled: false,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      passwordHash: await bcrypt.hash(input.password || crypto.randomBytes(24).toString("hex"), 12),
      failedLoginCount: 0,
      lockedUntil: null
    };
    this.users.push(record);
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "staff.create", targetPlayer: username, reason: "Created staff account", metadata: { roleName: input.roleName, email, discordId, permissions: input.permissions }, ipAddress, success: true });
    return this.staffFromStored(record);
  }

  async updateStaff(id: number, input: { displayName?: string; email?: string | null; roleName?: RoleName; disabled?: boolean; discordId?: string | null; permissions?: Permission[] }, staff: AuthUser, ipAddress: string | null): Promise<StaffUser> {
    if (this.a2TablesReady) {
      let roleId: number | null = null;
      if (input.roleName) {
        const roleRows = await queryRows<{ id: number }>("SELECT id FROM a2_roles WHERE name = :roleName LIMIT 1", { roleName: input.roleName });
        roleId = roleRows[0]?.id ?? null;
      }
      const discordTouched = Object.prototype.hasOwnProperty.call(input, "discordId");
      const discordId = typeof input.discordId === "string" ? cleanDiscordId(input.discordId) : null;
      const emailTouched = Object.prototype.hasOwnProperty.call(input, "email");
      const email = typeof input.email === "string" ? input.email.trim() || null : null;
      await execute(
        `UPDATE a2_users
         SET display_name = COALESCE(:displayName, display_name),
             email = CASE WHEN :emailTouched = 1 THEN :email ELSE email END,
             discord_id = CASE WHEN :discordTouched = 1 THEN :discordId ELSE discord_id END,
             role_id = COALESCE(:roleId, role_id),
             disabled = COALESCE(:disabled, disabled),
             login_provider = CASE
               WHEN :discordTouched = 1 AND :discordId IS NULL AND login_provider IN ('discord','both') THEN 'password'
               WHEN :discordTouched = 1 AND :discordId IS NOT NULL AND login_provider = 'password' THEN 'both'
               ELSE login_provider
             END,
             updated_at = NOW()
          WHERE id = :id`,
        { id, displayName: input.displayName ?? null, emailTouched: emailTouched ? 1 : 0, email, discordTouched: discordTouched ? 1 : 0, discordId, roleId, disabled: typeof input.disabled === "boolean" ? Number(input.disabled) : null }
      );
      await this.replaceUserPermissions(id, input.permissions, staff.id);
      const updated = await this.getUserById(id);
      if (!updated) throw new HttpError(404, "Staff account not found", "staff_not_found");
      await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "staff.edit", targetPlayer: updated.username, reason: "Updated staff account", metadata: input, ipAddress, success: true });
      return { ...updated, lastLoginAt: null, createdAt: new Date().toISOString() };
    }

    const record = this.users.find((user) => user.id === id);
    if (!record) throw new HttpError(404, "Staff account not found", "staff_not_found");
    if (input.displayName) record.displayName = input.displayName;
    if (typeof input.email === "string") record.email = input.email.trim() || null;
    if (typeof input.discordId === "string") record.discordId = cleanDiscordId(input.discordId);
    if (input.roleName) {
      record.roleName = input.roleName;
      record.permissions = ROLE_PERMISSIONS[input.roleName];
    }
    if (input.permissions) record.permissions = input.permissions.filter((permission) => ALL_PERMISSIONS.includes(permission));
    if (typeof input.disabled === "boolean") record.disabled = input.disabled;
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "staff.edit", targetPlayer: record.username, reason: "Updated staff account", metadata: input, ipAddress, success: true });
    return this.staffFromStored(record);
  }

  async deleteStaff(id: number, staff: AuthUser, ipAddress: string | null): Promise<void> {
    if (id === staff.id) throw new HttpError(400, "You cannot delete your own active staff account", "self_delete");
    if (this.a2TablesReady) {
      await execute("DELETE FROM a2_users WHERE id = :id", { id });
    } else {
      this.users = this.users.filter((user) => user.id !== id);
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "staff.delete", targetPlayer: String(id), reason: "Deleted staff account", metadata: { id }, ipAddress, success: true });
  }

  async resetStaffPassword(id: number, newPassword: string, staff: AuthUser, ipAddress: string | null): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    if (this.a2TablesReady) {
      await execute("UPDATE a2_users SET password_hash = :passwordHash, failed_login_count = 0, locked_until = NULL, updated_at = NOW() WHERE id = :id", { id, passwordHash });
    } else {
      const record = this.users.find((user) => user.id === id);
      if (!record) throw new HttpError(404, "Staff account not found", "staff_not_found");
      record.passwordHash = passwordHash;
      record.failedLoginCount = 0;
      record.lockedUntil = null;
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "staff.reset_password", targetPlayer: String(id), reason: "Reset staff password", metadata: { id }, ipAddress, success: true });
  }

  async getSettings(): Promise<Record<string, unknown>> {
    if (this.a2TablesReady) {
      const rows = await queryRows<{ setting_key: string; setting_value: string }>("SELECT setting_key, setting_value FROM a2_settings");
      const merged = { ...this.settings };
      for (const row of rows) {
        merged[row.setting_key] = jsonParse(row.setting_value, row.setting_value);
      }
      return merged;
    }
    return clone(this.settings);
  }

  async updateSettings(patch: Record<string, unknown>, staff: AuthUser, ipAddress: string | null): Promise<Record<string, unknown>> {
    const safePatch = { ...patch };
    delete safePatch.databasePassword;
    this.settings = { ...this.settings, ...safePatch };
    if (this.a2TablesReady) {
      for (const [key, value] of Object.entries(safePatch)) {
        await execute(
          `INSERT INTO a2_settings (setting_key, setting_value, updated_by)
           VALUES (:key, :value, :updatedBy)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
          { key, value: JSON.stringify(value), updatedBy: staff.id }
        );
      }
    } else {
      this.settings = { ...this.settings, ...safePatch };
    }
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "settings.edit", targetPlayer: null, reason: "Updated settings", metadata: safePatch, ipAddress, success: true });
    return this.getSettings();
  }

  async announcement(message: string, style: string, duration: number, staff: AuthUser, ipAddress: string | null): Promise<BridgeCommand> {
    const bridgeCommand = await this.enqueueCommand("announcement.txadmin", null, { message, style, duration, source: "System" }, staff);
    await this.createAudit({ staffUserId: staff.id, staffName: staff.username, actionType: "announcements.txadmin", targetPlayer: null, reason: message, metadata: { commandId: bridgeCommand.id, style, duration }, ipAddress, success: true });
    return bridgeCommand;
  }

  async listAuditLogs(filters: { search?: string; actionType?: string; staff?: string; target?: string; limit?: number }): Promise<AuditLog[]> {
    const limit = Math.min(filters.limit ?? 500, 1000);
    if (this.a2TablesReady) {
      const where: string[] = [];
      const params: Record<string, unknown> = { limit };
      if (filters.search) {
        where.push("(staff_name LIKE :search OR action_type LIKE :search OR target_player LIKE :search OR reason LIKE :search)");
        params.search = like(filters.search);
      }
      if (filters.actionType) {
        where.push("action_type = :actionType");
        params.actionType = filters.actionType;
      }
      if (filters.staff) {
        where.push("staff_name LIKE :staff");
        params.staff = like(filters.staff);
      }
      if (filters.target) {
        where.push("target_player LIKE :target");
        params.target = like(filters.target);
      }
      const rows = await queryRows<Record<string, unknown>>(
        `SELECT * FROM a2_audit_logs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT :limit`,
        params
      );
      return rows.map((row) => ({
        id: Number(row.id),
        staffUserId: row.staff_user_id ? Number(row.staff_user_id) : null,
        staffName: String(row.staff_name ?? "Unknown"),
        actionType: String(row.action_type ?? ""),
        targetPlayer: row.target_player ? String(row.target_player) : null,
        reason: row.reason ? String(row.reason) : null,
        metadata: jsonParse<Record<string, unknown>>(row.metadata, {}),
        ipAddress: row.ip_address ? String(row.ip_address) : null,
        success: Boolean(row.success),
        createdAt: iso(row.created_at as Date | string) ?? new Date().toISOString()
      }));
    }

    return this.auditLogs
      .filter((log) => {
        const raw = JSON.stringify(log).toLowerCase();
        return (
          (!filters.search || raw.includes(filters.search.toLowerCase())) &&
          (!filters.actionType || log.actionType === filters.actionType) &&
          (!filters.staff || log.staffName.toLowerCase().includes(filters.staff.toLowerCase())) &&
          (!filters.target || (log.targetPlayer ?? "").toLowerCase().includes(filters.target.toLowerCase()))
        );
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit);
  }

  async createAudit(input: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
    const record: AuditLog = {
      id: this.nextId(this.auditLogs),
      staffUserId: input.staffUserId ?? null,
      staffName: input.staffName,
      actionType: input.actionType,
      targetPlayer: input.targetPlayer ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
      success: input.success,
      createdAt: new Date().toISOString()
    };

    if (this.a2TablesReady) {
      try {
        await execute(
          `INSERT INTO a2_audit_logs (staff_user_id, staff_name, action_type, target_player, reason, metadata, ip_address, success)
           VALUES (:staffUserId, :staffName, :actionType, :targetPlayer, :reason, :metadata, :ipAddress, :success)`,
          { ...record, metadata: JSON.stringify(record.metadata), success: record.success ? 1 : 0 }
        );
      } catch {
        // Keep the panel responsive if logging storage has a transient issue.
      }
    } else {
      this.auditLogs.unshift(record);
    }
    void this.sendDiscordLog(record);
  }

  private webhookForAudit(record: AuditLog): string | null {
    const configured = (this.settings.discordWebhooks ?? {}) as Record<string, string>;
    const fromSettings = (key: string) => configured[key] || "";
    if (record.actionType.startsWith("players.inventory.")) return fromSettings("inventory") || fromSettings("admin") || env.DISCORD_WEBHOOK_ADMIN || null;
    if (record.actionType.startsWith("players.money.")) return fromSettings("money") || fromSettings("admin") || env.DISCORD_WEBHOOK_ADMIN || null;
    if (record.actionType.startsWith("vehicles.")) return fromSettings("vehicles") || fromSettings("admin") || env.DISCORD_WEBHOOK_ADMIN || null;
    if (record.actionType.startsWith("characters.")) return fromSettings("characters") || fromSettings("admin") || env.DISCORD_WEBHOOK_ADMIN || null;
    if (record.actionType.startsWith("warnings.")) return fromSettings("warnings") || env.DISCORD_WEBHOOK_ADMIN || null;
    if (record.actionType.startsWith("staff.")) return fromSettings("staff") || env.DISCORD_WEBHOOK_ADMIN || null;
    if (record.actionType.startsWith("bans.")) return fromSettings("bans") || env.DISCORD_WEBHOOK_BANS || null;
    if (record.actionType.startsWith("reports.")) return fromSettings("reports") || env.DISCORD_WEBHOOK_REPORTS || null;
    if (record.actionType.includes("error") || !record.success) return fromSettings("errors") || env.DISCORD_WEBHOOK_ERRORS || null;
    if (record.actionType.startsWith("auth.")) return fromSettings("login") || env.DISCORD_WEBHOOK_ADMIN || null;
    return fromSettings("admin") || env.DISCORD_WEBHOOK_ADMIN || null;
  }

  private async sendDiscordLog(record: AuditLog): Promise<void> {
    const webhook = this.webhookForAudit(record);
    if (!webhook || !webhook.startsWith("https://discord.com/api/webhooks/")) return;
    const color = !record.success ? 0xff4d4d : record.actionType.includes(".remove") || record.actionType.includes(".delete") ? 0xff4d4d : record.actionType.includes(".give") || record.actionType.includes(".add") ? 0x2ecc71 : 0xb7fe1a;
    const metadata = record.metadata ?? {};
    const detailFields = Object.entries(metadata)
      .filter(([key, value]) => ["item", "amount", "slot", "account", "mode", "plate", "oldPlate", "newPlate", "vehicle", "citizenId", "phone", "direction"].includes(key) && value !== undefined && value !== null && value !== "")
      .slice(0, 8)
      .map(([key, value]) => ({ name: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()), value: String(value), inline: true }));
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "A2 Panel Logs",
          embeds: [{
            title: record.actionType,
            color,
            fields: [
              { name: "Staff", value: record.staffName || "System", inline: true },
              { name: "Target", value: record.targetPlayer || "None", inline: true },
              { name: "Result", value: record.success ? "Success" : "Failed", inline: true },
              ...detailFields,
              { name: "Reason", value: record.reason || "No reason", inline: false }
            ],
            timestamp: record.createdAt,
            footer: { text: "A2 Panel" }
          }]
        })
      });
    } catch {
      // Webhook delivery must not block panel actions.
    }
  }

  toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return "";
    const headers = Array.from(rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>()));
    const escape = (value: unknown) => `"${String(typeof value === "object" ? JSON.stringify(value) : value ?? "").replace(/"/g, '""')}"`;
    return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  }
}
