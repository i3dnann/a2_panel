import type { Router } from "express";
import express from "express";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config.js";
import { bridgeSecretGuard, createAuthMiddleware, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import type { A2DataService } from "../services/dataService.js";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from "../permissions.js";
import type { Permission, RoleName } from "../types/models.js";
import { HttpError } from "../utils/errors.js";

const asyncRoute =
  <T extends express.RequestHandler>(handler: T): express.RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const ip = (req: express.Request) => req.ip || req.socket.remoteAddress || null;
const routeParam = (req: express.Request, key: string) => String(req.params[key] ?? "");

const roleSchema = z.enum(["Founder", "Owner", "Ban Team", "Super Admin", "Admin", "Moderator", "Support", "Viewer"]);

const reasonSchema = z.string().trim().min(2, "Reason is required");

const frontendBaseUrl = () => {
  const first = env.FRONTEND_URL.split(",")[0]?.trim() || "http://localhost:5173";
  return first.replace(/\/login\/?$/i, "").replace(/\/$/, "");
};

const discordRedirectUri = (_req?: express.Request) => env.DISCORD_REDIRECT_URI || `${frontendBaseUrl()}/api/auth/discord/callback`;

const discordAvatarUrl = (id: string, avatar?: string | null) => avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128` : null;
const proofUploadDir = path.resolve(process.cwd(), "uploads", "proofs");
const proofExtFromMime = (mime: string) => {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return null;
};

const playerActionSchemas: Record<string, z.ZodTypeAny> = {
  kick: z.object({ reason: reasonSchema }),
  ban: z.object({ reason: reasonSchema, durationHours: z.number().optional(), permanent: z.boolean().optional() }),
  warn: z.object({ reason: reasonSchema, severity: z.enum(["low", "medium", "high", "critical"]).default("low"), evidence: z.string().optional() }),
  revive: z.object({ reason: z.string().optional() }).default({}),
  heal: z.object({ reason: z.string().optional() }).default({}),
  armor: z.object({ amount: z.coerce.number().int().min(0).max(100).default(100), reason: z.string().optional() }).default({ amount: 100 }),
  feed: z.object({ amount: z.coerce.number().int().min(0).max(100).default(100), reason: z.string().optional() }).default({ amount: 100 }),
  drink: z.object({ amount: z.coerce.number().int().min(0).max(100).default(100), reason: z.string().optional() }).default({ amount: 100 }),
  jail: z.object({ minutes: z.coerce.number().int().min(1).max(10080), reason: reasonSchema }),
  unjail: z.object({ reason: z.string().optional() }).default({}),
  clothing: z.object({ reason: z.string().optional() }).default({}),
  freeze: z.object({ frozen: z.boolean(), reason: z.string().optional() }),
  bring: z.object({ reason: z.string().optional() }).default({}),
  goto: z.object({ reason: z.string().optional() }).default({}),
  message: z.object({ message: z.string().trim().min(1), reason: z.string().optional() }),
  screenshot: z.object({ reason: z.string().optional() }).default({}),
  admin: z.object({ mode: z.enum(["grant", "remove"]), permission: z.enum(["admin", "god"]).default("admin"), reason: z.string().optional() })
};

const playerActionPermissions: Record<string, Permission> = {
  kick: "players.kick",
  ban: "players.ban",
  warn: "players.warn",
  revive: "players.revive",
  heal: "players.heal",
  armor: "players.armor",
  feed: "players.needs",
  drink: "players.needs",
  jail: "players.jail",
  unjail: "players.jail",
  clothing: "players.clothing",
  freeze: "players.teleport",
  bring: "players.teleport",
  goto: "players.teleport",
  message: "players.view",
  screenshot: "players.screenshot",
  admin: "database.write"
};

export function createApiRouter(data: A2DataService): Router {
  const router = express.Router();
  const authenticate = createAuthMiddleware(data);

  router.get("/assets/items/:name", (req, res, next) => {
    const file = data.findItemImageFile(routeParam(req, "name"));
    if (!file) return next(new HttpError(404, "Item image not found", "item_image_not_found"));
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(file);
  });

  router.post(
    "/uploads/proof",
    authenticate,
    requirePermission("bans.create"),
    validateBody(z.object({
      fileName: z.string().trim().min(1).max(180),
      mediaType: z.string().trim().min(3),
      dataUrl: z.string().min(32)
    })),
    asyncRoute(async (req, res) => {
      const match = /^data:([^;]+);base64,(.+)$/i.exec(req.body.dataUrl);
      if (!match) throw new HttpError(400, "Proof upload must be a base64 data URL", "bad_proof_data");
      const mediaType = match[1].toLowerCase();
      if (mediaType !== req.body.mediaType.toLowerCase()) throw new HttpError(400, "Proof media type mismatch", "bad_proof_type");
      if (!mediaType.startsWith("image/") && !mediaType.startsWith("video/")) throw new HttpError(400, "Only image and video proof files are supported", "bad_proof_media");
      const ext = proofExtFromMime(mediaType);
      if (!ext) throw new HttpError(400, "Unsupported proof file type", "bad_proof_extension");
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new HttpError(413, "Proof files must be 10MB or smaller", "proof_too_large");
      await mkdir(proofUploadDir, { recursive: true });
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
      await writeFile(path.join(proofUploadDir, fileName), buffer);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      res.status(201).json({
        proof: {
          type: mediaType.startsWith("video/") ? "video" : "image",
          url: `${baseUrl}/api/uploads/proofs/${fileName}`,
          label: req.body.fileName,
          size: buffer.length
        }
      });
    })
  );

  const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again shortly." }
  });

  router.get("/health", (_req, res) => {
    res.json({
      name: "A2 Panel",
      ok: true,
      databaseOnline: data.isDatabaseOnline(),
      a2TablesReady: data.isA2TablesReady(),
      bridgeOnline: data.isBridgeOnline()
    });
  });

  router.get("/auth/discord/status", (_req, res) => {
    const missing = [
      env.DISCORD_CLIENT_ID ? null : "DISCORD_CLIENT_ID",
      env.DISCORD_CLIENT_SECRET ? null : "DISCORD_CLIENT_SECRET",
      discordRedirectUri() ? null : "DISCORD_REDIRECT_URI"
    ].filter(Boolean);
    res.json({
      configured: missing.length === 0,
      missing,
      redirectUri: discordRedirectUri(),
      frontendUrl: frontendBaseUrl()
    });
  });

  router.post(
    "/auth/login",
    loginLimiter,
    validateBody(z.object({ username: z.string().trim().min(1), password: z.string().min(1), remember: z.boolean().optional() })),
    asyncRoute(async (req, res) => {
      const user = await data.login(req.body.username, req.body.password, ip(req));
      const token = jwt.sign({ sub: String(user.id), username: user.username }, env.JWT_SECRET, {
        expiresIn: req.body.remember ? "14d" : "8h",
        issuer: "A2 Panel"
      });
      res.json({ token, user });
    })
  );

  router.get("/auth/discord/url", (_req, res) => {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
      const missing = [env.DISCORD_CLIENT_ID ? null : "DISCORD_CLIENT_ID", env.DISCORD_CLIENT_SECRET ? null : "DISCORD_CLIENT_SECRET"].filter(Boolean).join(", ");
      throw new HttpError(400, `Discord OAuth is missing ${missing}`, "discord_not_configured");
    }
    const state = jwt.sign({ flow: "discord", nonce: crypto.randomUUID() }, env.JWT_SECRET, { expiresIn: "10m", issuer: "A2 Panel" });
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: env.DISCORD_REDIRECT_URI || `${frontendBaseUrl()}/api/auth/discord/callback`,
      response_type: "code",
      scope: "identify",
      prompt: "none",
      state
    });
    res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });
  });

  router.get("/auth/discord/callback", loginLimiter, asyncRoute(async (req, res) => {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
      return res.redirect(`${frontendBaseUrl()}/login?discord_error=${encodeURIComponent("Discord OAuth is not configured")}`);
    }
    try {
      const code = String(req.query.code ?? "");
      const state = String(req.query.state ?? "");
      if (!code || !state) throw new HttpError(400, "Missing Discord OAuth code", "discord_missing_code");
      jwt.verify(state, env.JWT_SECRET);
      const redirectUri = discordRedirectUri(req);
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri
        })
      });
      if (!tokenResponse.ok) throw new HttpError(401, "Discord token exchange failed", "discord_token_failed");
      const tokenBody = await tokenResponse.json() as { access_token?: string };
      if (!tokenBody.access_token) throw new HttpError(401, "Discord did not return an access token", "discord_token_missing");
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { authorization: `Bearer ${tokenBody.access_token}` }
      });
      if (!userResponse.ok) throw new HttpError(401, "Discord user lookup failed", "discord_user_failed");
      const discordUser = await userResponse.json() as { id: string; username: string; global_name?: string | null; avatar?: string | null };
      const user = await data.loginDiscord({
        discordId: discordUser.id,
        username: discordUser.username,
        displayName: discordUser.global_name || discordUser.username,
        avatarUrl: discordAvatarUrl(discordUser.id, discordUser.avatar)
      }, ip(req));
      const token = jwt.sign({ sub: String(user.id), username: user.username }, env.JWT_SECRET, {
        expiresIn: "14d",
        issuer: "A2 Panel"
      });
      return res.redirect(`${frontendBaseUrl()}/login#token=${encodeURIComponent(token)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Discord login failed";
      return res.redirect(`${frontendBaseUrl()}/login?discord_error=${encodeURIComponent(message)}`);
    }
  }));

  router.post("/auth/logout", authenticate, asyncRoute(async (req, res) => {
    await data.createAudit({ staffUserId: req.user!.id, staffName: req.user!.username, actionType: "auth.logout", reason: "Staff logged out", ipAddress: ip(req), success: true });
    res.json({ ok: true });
  }));

  router.get("/auth/me", authenticate, (req, res) => {
    res.json({ user: req.user, permissions: ALL_PERMISSIONS, rolePermissions: ROLE_PERMISSIONS });
  });

  router.post(
    "/auth/change-password",
    authenticate,
    validateBody(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })),
    asyncRoute(async (req, res) => {
      await data.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
      await data.createAudit({ staffUserId: req.user!.id, staffName: req.user!.username, actionType: "auth.change_password", reason: "Changed own password", ipAddress: ip(req), success: true });
      res.json({ ok: true });
    })
  );

  router.get("/dashboard/stats", authenticate, requirePermission("dashboard.view"), asyncRoute(async (_req, res) => {
    res.json(await data.getDashboardStats());
  }));

  router.get("/dashboard/activity", authenticate, requirePermission("dashboard.view"), asyncRoute(async (req, res) => {
    res.json({ activity: await data.recentActivity(Number(req.query.limit ?? 12)) });
  }));

  router.get("/server/status", authenticate, requirePermission("dashboard.view"), asyncRoute(async (_req, res) => {
    const stats = await data.getDashboardStats();
    res.json({ online: stats.serverOnline, bridgeLastSeen: stats.bridgeLastSeen, playersOnline: stats.playersOnline, maxPlayers: stats.maxPlayers, performance: stats.performance });
  }));

  router.get("/players/online", authenticate, requirePermission("players.view"), (req, res) => {
    res.json({ players: data.getOnlinePlayers(), bridgeOnline: data.isBridgeOnline() });
  });

  router.get("/players/search", authenticate, requirePermission("players.view"), asyncRoute(async (req, res) => {
    res.json(await data.searchPlayers(String(req.query.q ?? "")));
  }));

  router.get("/players/:id", authenticate, requirePermission("players.view"), asyncRoute(async (req, res) => {
    res.json(await data.getPlayerProfile(routeParam(req, "id")));
  }));

  for (const action of Object.keys(playerActionSchemas)) {
    router.post(
      `/players/:id/${action}`,
      authenticate,
      requirePermission(playerActionPermissions[action]),
      validateBody(playerActionSchemas[action]),
      asyncRoute(async (req, res) => {
        const id = routeParam(req, "id");
        if (action === "warn") {
          const warning = await data.createWarning(
            { targetName: id, reason: req.body.reason, severity: req.body.severity, evidence: req.body.evidence },
            req.user!,
            ip(req)
          );
          await data.playerAction("message", id, { message: `[Warning] ${req.body.reason}`, reason: "Warning notification" }, req.user!, ip(req));
          return res.status(201).json({ warning });
        }
        if (action === "ban") {
          const expiresAt = req.body.permanent || !req.body.durationHours ? null : new Date(Date.now() + Number(req.body.durationHours) * 3600000).toISOString();
          const online = data.resolveOnlinePlayer(id);
          const ban = await data.createBan({
            targetName: online?.characterName ?? id,
            citizenId: online?.citizenId ?? undefined,
            license: online?.license ?? undefined,
            steam: online?.steam ?? undefined,
            discord: online?.discordId?.replace(/^discord:/, "") ?? undefined,
            reason: req.body.reason,
            permanent: Boolean(req.body.permanent),
            expiresAt,
            metadata: { serverId: id, identifiers: online?.identifiers ?? {} }
          }, req.user!, ip(req));
          await data.playerAction("ban", id, { ...req.body, banId: ban.id }, req.user!, ip(req));
          return res.status(201).json({ ban });
        }
        if (action === "admin") {
          if (!["Founder", "Owner"].includes(req.user!.roleName)) throw new HttpError(403, "Only Founder and Owner can manage in-game admin permissions", "owner_only");
          const command = await data.playerAction("admin.permission", id, req.body ?? {}, req.user!, ip(req));
          return res.status(202).json({ command, bridgeOnline: data.isBridgeOnline() });
        }
        const command = await data.playerAction(action, id, req.body ?? {}, req.user!, ip(req));
        return res.status(202).json({ command, bridgeOnline: data.isBridgeOnline() });
      })
    );
  }

  router.get("/players/:id/inventory", authenticate, requirePermission("players.inventory.view"), asyncRoute(async (req, res) => {
    res.json(await data.getInventory(routeParam(req, "id")));
  }));

  router.post("/players/:id/watch/snapshot", authenticate, requirePermission("players.screenshot"), asyncRoute(async (req, res) => {
    res.status(202).json({ command: await data.requestWatchSnapshot(routeParam(req, "id"), req.user!, ip(req)), bridgeOnline: data.isBridgeOnline() });
  }));

  router.get("/players/:id/watch/latest", authenticate, requirePermission("players.screenshot"), asyncRoute(async (req, res) => {
    res.json({ frame: data.getWatchFrame(routeParam(req, "id")) });
  }));

  router.get("/stashes", authenticate, requirePermission("players.inventory.view"), asyncRoute(async (req, res) => {
    res.json({ stashes: await data.listStashes(String(req.query.search ?? "")) });
  }));

  router.post(
    "/players/:id/inventory/give",
    authenticate,
    requirePermission("players.inventory.edit"),
    validateBody(z.object({ item: z.string().trim().min(1), amount: z.coerce.number().int().positive(), reason: reasonSchema, metadata: z.unknown().optional(), slot: z.coerce.number().int().optional() })),
    asyncRoute(async (req, res) => {
      await data.inventoryAction("give", routeParam(req, "id"), req.body.item, req.body.amount, req.body.reason, req.body.metadata ?? {}, req.user!, ip(req), req.body.slot);
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post(
    "/players/:id/inventory/remove",
    authenticate,
    requirePermission("players.inventory.edit"),
    validateBody(z.object({ item: z.string().trim().min(1), amount: z.coerce.number().int().positive(), reason: reasonSchema, slot: z.coerce.number().int().optional() })),
    asyncRoute(async (req, res) => {
      await data.inventoryAction("remove", routeParam(req, "id"), req.body.item, req.body.amount, req.body.reason, {}, req.user!, ip(req), req.body.slot);
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post(
    "/players/:id/inventory/clear",
    authenticate,
    requirePermission("players.inventory.edit"),
    validateBody(z.object({ reason: reasonSchema })),
    asyncRoute(async (req, res) => {
      await data.clearInventory(routeParam(req, "id"), req.body.reason, req.user!, ip(req));
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post(
    "/players/:id/phone",
    authenticate,
    requirePermission("database.write"),
    validateBody(z.object({ phone: z.string().trim().min(3).max(32) })),
    asyncRoute(async (req, res) => {
      await data.setPhoneNumber(routeParam(req, "id"), req.body.phone, req.user!, ip(req));
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post(
    "/players/:id/lock",
    authenticate,
    requirePermission("database.write"),
    validateBody(z.object({ locked: z.boolean() })),
    asyncRoute(async (req, res) => {
      await data.setCharacterLocked(routeParam(req, "id"), req.body.locked, req.user!, ip(req));
      res.json({ ok: true });
    })
  );

  router.delete("/players/:id/character", authenticate, requirePermission("database.write"), asyncRoute(async (req, res) => {
    await data.deleteCharacter(routeParam(req, "id"), req.user!, ip(req));
    res.json({ ok: true });
  }));

  router.get("/players/:id/money", authenticate, requirePermission("players.money.view"), asyncRoute(async (req, res) => {
    res.json(await data.getMoney(routeParam(req, "id")));
  }));

  router.post(
    "/players/:id/money/set",
    authenticate,
    requirePermission("players.money.edit"),
    validateBody(z.object({ account: z.enum(["cash", "bank", "black"]).default("cash"), mode: z.enum(["add", "remove", "set"]).default("set"), amount: z.coerce.number().nonnegative(), reason: reasonSchema })),
    asyncRoute(async (req, res) => {
      await data.setMoney(routeParam(req, "id"), req.body.account, req.body.mode, req.body.amount, req.body.reason, req.user!, ip(req));
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post(
    "/players/:id/job",
    authenticate,
    requirePermission("players.job.edit"),
    validateBody(z.object({ name: z.string().trim().min(1), grade: z.union([z.string(), z.number()]), reason: reasonSchema })),
    asyncRoute(async (req, res) => {
      await data.updateJobGang("job", routeParam(req, "id"), req.body.name, req.body.grade, req.body.reason, req.user!, ip(req));
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post(
    "/players/:id/gang",
    authenticate,
    requirePermission("players.gang.edit"),
    validateBody(z.object({ name: z.string().trim().min(1), grade: z.union([z.string(), z.number()]), reason: reasonSchema })),
    asyncRoute(async (req, res) => {
      await data.updateJobGang("gang", routeParam(req, "id"), req.body.name, req.body.grade, req.body.reason, req.user!, ip(req));
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.get("/bans", authenticate, requirePermission("bans.view"), asyncRoute(async (req, res) => {
    res.json({ bans: await data.listBans({ search: String(req.query.search ?? ""), active: req.query.active ? String(req.query.active) : undefined }) });
  }));

  router.get("/vehicles", authenticate, requirePermission("players.view"), asyncRoute(async (req, res) => {
    res.json({ vehicles: await data.searchVehicles(String(req.query.search ?? "")) });
  }));

  router.post(
    "/vehicles/give",
    authenticate,
    requirePermission("database.write"),
    validateBody(z.object({ citizenId: z.string().trim().min(1), vehicle: z.string().trim().min(1), plate: z.string().optional(), garage: z.string().optional(), state: z.union([z.string(), z.number()]).optional() })),
    asyncRoute(async (req, res) => {
      res.status(201).json({ vehicle: await data.giveVehicle(req.body, req.user!, ip(req)) });
    })
  );

  router.patch(
    "/vehicles/plate",
    authenticate,
    requirePermission("database.write"),
    validateBody(z.object({ oldPlate: z.string().trim().min(1), newPlate: z.string().trim().min(1) })),
    asyncRoute(async (req, res) => {
      await data.changeVehiclePlate(req.body.oldPlate, req.body.newPlate, req.user!, ip(req));
      res.json({ ok: true });
    })
  );

  router.delete(
    "/vehicles/:plate",
    authenticate,
    requirePermission("database.write"),
    validateBody(z.object({ citizenId: z.string().trim().optional() }).default({})),
    asyncRoute(async (req, res) => {
      await data.deleteVehicle(routeParam(req, "plate"), req.user!, ip(req), req.body.citizenId);
      res.json({ ok: true });
    })
  );

  router.get("/bans/export", authenticate, requirePermission("bans.view"), asyncRoute(async (_req, res) => {
    const bans = await data.listBans({});
    res.header("content-type", "text/csv");
    res.attachment("a2-panel-bans.csv");
    res.send(data.toCsv(bans as unknown as Record<string, unknown>[]));
  }));

  router.post(
    "/bans",
    authenticate,
    requirePermission("bans.create"),
    validateBody(z.object({
      targetName: z.string().trim().min(1),
      citizenId: z.string().optional(),
      license: z.string().optional(),
      steam: z.string().optional(),
      discord: z.string().optional(),
      fivem: z.string().optional(),
      ip: z.string().optional(),
      hwid: z.string().optional(),
      reason: reasonSchema,
      evidence: z.string().optional(),
      permanent: z.boolean().default(false),
      expiresAt: z.string().datetime().nullable().optional(),
      evasionNotes: z.string().optional()
    })),
    asyncRoute(async (req, res) => {
      res.status(201).json({ ban: await data.createBan(req.body, req.user!, ip(req)) });
    })
  );

  router.patch(
    "/bans/:id",
    authenticate,
    requirePermission("bans.create"),
    validateBody(z.object({ reason: z.string().optional(), evidence: z.string().optional(), evasionNotes: z.string().optional() })),
    asyncRoute(async (req, res) => {
      res.json({ ban: await data.updateBan(Number(req.params.id), req.body, req.user!, ip(req)) });
    })
  );

  router.delete("/bans/:id", authenticate, requirePermission("bans.delete"), asyncRoute(async (req, res) => {
    if (!["Founder", "Owner"].includes(req.user!.roleName)) throw new HttpError(403, "Only Founder and Owner can delete ban history", "owner_only");
    await data.deleteBan(Number(req.params.id), req.user!, ip(req));
    res.json({ ok: true });
  }));

  router.post("/bans/:id/unban", authenticate, requirePermission("bans.delete"), asyncRoute(async (req, res) => {
    await data.unban(Number(req.params.id), req.user!, ip(req));
    res.json({ ok: true });
  }));

  router.get("/warnings", authenticate, requirePermission("players.warn"), asyncRoute(async (req, res) => {
    res.json({ warnings: await data.listWarnings({ search: String(req.query.search ?? "") }) });
  }));

  router.post(
    "/warnings",
    authenticate,
    requirePermission("players.warn"),
    validateBody(z.object({ targetName: z.string().trim().min(1), citizenId: z.string().optional(), license: z.string().optional(), severity: z.enum(["low", "medium", "high", "critical"]), reason: reasonSchema, evidence: z.string().optional() })),
    asyncRoute(async (req, res) => {
      res.status(201).json({ warning: await data.createWarning(req.body, req.user!, ip(req)) });
    })
  );

  router.delete("/warnings/:id", authenticate, requirePermission("database.write"), asyncRoute(async (req, res) => {
    await data.deleteWarning(Number(req.params.id), req.user!, ip(req));
    res.json({ ok: true });
  }));

  router.get("/reports", authenticate, requirePermission("reports.view"), asyncRoute(async (req, res) => {
    res.json({ reports: await data.listReports({ status: req.query.status ? String(req.query.status) : undefined }) });
  }));

  router.post(
    "/reports",
    authenticate,
    requirePermission("reports.view"),
    validateBody(z.object({ reporterName: z.string().trim().min(1), reporterServerId: z.coerce.number().nullable().optional(), reporterCitizenId: z.string().nullable().optional(), message: z.string().trim().min(2) })),
    asyncRoute(async (req, res) => {
      res.status(201).json({ report: await data.createReport(req.body) });
    })
  );

  router.patch("/reports/:id/claim", authenticate, requirePermission("reports.claim"), asyncRoute(async (req, res) => {
    res.json({ report: await data.claimReport(Number(req.params.id), req.user!, ip(req)) });
  }));

  router.patch(
    "/reports/:id/close",
    authenticate,
    requirePermission("reports.close"),
    validateBody(z.object({ resolution: z.string().trim().min(2) })),
    asyncRoute(async (req, res) => {
      res.json({ report: await data.closeReport(Number(req.params.id), req.body.resolution, req.user!, ip(req)) });
    })
  );

  router.post(
    "/reports/:id/note",
    authenticate,
    requirePermission("reports.claim"),
    validateBody(z.object({ note: z.string().trim().min(2) })),
    asyncRoute(async (req, res) => {
      res.status(201).json({ note: await data.addReportNote(Number(req.params.id), req.body.note, req.user!, ip(req)) });
    })
  );

  router.post(
    "/reports/:id/reply",
    authenticate,
    requirePermission("reports.claim"),
    validateBody(z.object({ message: z.string().trim().min(1).max(500) })),
    asyncRoute(async (req, res) => {
      res.status(202).json(await data.replyToReport(Number(req.params.id), req.body.message, req.user!, ip(req)));
    })
  );

  router.delete("/reports/:id", authenticate, requirePermission("reports.delete"), asyncRoute(async (req, res) => {
    if (!["Founder", "Owner"].includes(req.user!.roleName)) throw new HttpError(403, "Only Founder and Owner can delete reports", "owner_only");
    await data.deleteReport(Number(req.params.id), req.user!, ip(req));
    res.json({ ok: true });
  }));

  router.get("/staff", authenticate, requirePermission("staff.view"), asyncRoute(async (_req, res) => {
    res.json({ staff: await data.listStaff(), roles: Object.keys(ROLE_PERMISSIONS), rolePermissions: ROLE_PERMISSIONS });
  }));

  router.post(
    "/staff",
    authenticate,
    requirePermission("staff.create"),
    validateBody(z.object({
      username: z.string().trim().min(3).optional(),
      displayName: z.string().trim().min(2),
      email: z.string().email().optional(),
      discordId: z.string().trim().min(5).optional(),
      password: z.string().min(8).optional(),
      roleName: roleSchema,
      permissions: z.array(z.custom<Permission>((value) => typeof value === "string" && ALL_PERMISSIONS.includes(value as Permission))).optional()
    }).refine((body) => body.discordId || body.password, { message: "Discord ID or password is required" })),
    asyncRoute(async (req, res) => {
      res.status(201).json({ staff: await data.createStaff(req.body as { username?: string; displayName: string; email?: string; password?: string; roleName: RoleName; discordId?: string; permissions?: Permission[] }, req.user!, ip(req)) });
    })
  );

  router.patch(
    "/staff/:id",
    authenticate,
    requirePermission("staff.edit"),
    validateBody(z.object({
      displayName: z.string().optional(),
      email: z.string().email().nullable().optional(),
      roleName: roleSchema.optional(),
      disabled: z.boolean().optional(),
      discordId: z.string().nullable().optional(),
      permissions: z.array(z.custom<Permission>((value) => typeof value === "string" && ALL_PERMISSIONS.includes(value as Permission))).optional()
    })),
    asyncRoute(async (req, res) => {
      res.json({ staff: await data.updateStaff(Number(req.params.id), req.body, req.user!, ip(req)) });
    })
  );

  router.delete("/staff/:id", authenticate, requirePermission("staff.delete"), asyncRoute(async (req, res) => {
    await data.deleteStaff(Number(req.params.id), req.user!, ip(req));
    res.json({ ok: true });
  }));

  router.post(
    "/staff/:id/reset-password",
    authenticate,
    requirePermission("staff.edit"),
    validateBody(z.object({ newPassword: z.string().min(8) })),
    asyncRoute(async (req, res) => {
      await data.resetStaffPassword(Number(req.params.id), req.body.newPassword, req.user!, ip(req));
      res.json({ ok: true });
    })
  );

  router.get("/logs", authenticate, requirePermission("logs.view"), asyncRoute(async (req, res) => {
    res.json({
      logs: await data.listAuditLogs({
        search: req.query.search ? String(req.query.search) : undefined,
        actionType: req.query.actionType ? String(req.query.actionType) : undefined,
        staff: req.query.staff ? String(req.query.staff) : undefined,
        target: req.query.target ? String(req.query.target) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      })
    });
  }));

  router.get("/logs/export", authenticate, requirePermission("logs.view"), asyncRoute(async (req, res) => {
    const logs = await data.listAuditLogs({ search: req.query.search ? String(req.query.search) : undefined, limit: 1000 });
    res.header("content-type", "text/csv");
    res.attachment("a2-panel-audit-logs.csv");
    res.send(data.toCsv(logs as unknown as Record<string, unknown>[]));
  }));

  router.get("/settings", authenticate, requirePermission("settings.view"), asyncRoute(async (_req, res) => {
    res.json({ settings: await data.getSettings(), modules: await data.detectModules() });
  }));

  router.get("/framework/options", authenticate, requirePermission("players.job.edit"), asyncRoute(async (_req, res) => {
    res.json(await data.getFrameworkOptions());
  }));

  router.get("/players/resolve", authenticate, requirePermission("players.view"), asyncRoute(async (req, res) => {
    res.json(await data.resolvePlayerInfo(String(req.query.q ?? "")));
  }));

  router.patch(
    "/settings",
    authenticate,
    requirePermission("settings.edit"),
    validateBody(z.record(z.unknown())),
    asyncRoute(async (req, res) => {
      res.json({ settings: await data.updateSettings(req.body, req.user!, ip(req)) });
    })
  );

  router.post(
    "/announcements/txadmin",
    authenticate,
    requirePermission("announcements.txadmin"),
    validateBody(z.object({ message: z.string().trim().min(2).max(240), style: z.enum(["info", "success", "warning", "danger"]).default("info"), duration: z.coerce.number().int().min(3000).max(30000).default(8000) })),
    asyncRoute(async (req, res) => {
      if (!["Founder", "Owner"].includes(req.user!.roleName)) throw new HttpError(403, "Only Founder and Owner can send txAdmin announcements", "owner_only");
      res.status(202).json({ command: await data.announcement(req.body.message, req.body.style, req.body.duration, req.user!, ip(req)), bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post("/bridge/heartbeat", bridgeSecretGuard, validateBody(z.record(z.unknown()).default({})), (req, res) => {
    data.handleBridgeHeartbeat(req.body);
    res.json({ ok: true, panel: "A2 Panel" });
  });

  router.post(
    "/bridge/players",
    bridgeSecretGuard,
    validateBody(z.object({ players: z.array(z.record(z.unknown())) })),
    (req, res) => {
      data.updateBridgePlayers(req.body.players as never);
      res.json({ ok: true });
    }
  );

  router.post(
    "/bridge/event",
    bridgeSecretGuard,
    validateBody(z.object({ event: z.string().min(1), payload: z.record(z.unknown()).default({}) })),
    asyncRoute(async (req, res) => {
      await data.handleBridgeEvent(req.body.event, req.body.payload);
      res.json({ ok: true });
    })
  );

  router.post(
    "/bridge/screenshot",
    bridgeSecretGuard,
    validateBody(z.object({ commandId: z.string().min(1), dataUrl: z.string().min(20) })),
    (req, res) => {
      const frame = data.handleScreenshotUpload(req.body.commandId, req.body.dataUrl);
      res.json({ ok: Boolean(frame) });
    }
  );

  router.post(
    "/bridge/ban-check",
    bridgeSecretGuard,
    validateBody(z.object({
      citizenId: z.string().nullable().optional(),
      license: z.string().nullable().optional(),
      steam: z.string().nullable().optional(),
      discord: z.string().nullable().optional(),
      fivem: z.string().nullable().optional(),
      ip: z.string().nullable().optional(),
      hwid: z.string().nullable().optional(),
      identifiers: z.record(z.string()).default({})
    })),
    asyncRoute(async (req, res) => {
      const result = await data.checkActiveBan(req.body);
      res.json({
        banned: result.banned,
        reason: result.reason ?? null,
        ban: result.ban ? { id: result.ban.id, reason: result.ban.reason, expiresAt: result.ban.expiresAt, permanent: result.ban.permanent, source: result.ban.source ?? "a2" } : null
      });
    })
  );

  router.get("/bridge/commands", bridgeSecretGuard, (req, res) => {
    res.json({ commands: data.pollBridgeCommands() });
  });

  router.post(
    "/bridge/command-result",
    bridgeSecretGuard,
    validateBody(z.object({ commandId: z.string().uuid(), success: z.boolean(), result: z.record(z.unknown()).default({}) })),
    asyncRoute(async (req, res) => {
      await data.completeBridgeCommand(req.body.commandId, req.body.success, req.body.result);
      res.json({ ok: true });
    })
  );

  return router;
}
