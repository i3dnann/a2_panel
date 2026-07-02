import type { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config.js";
import { bridgeSecretGuard, createAuthMiddleware, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import type { A2DataService } from "../services/dataService.js";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from "../permissions.js";
import type { Permission, RoleName } from "../types/models.js";

const asyncRoute =
  <T extends express.RequestHandler>(handler: T): express.RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const ip = (req: express.Request) => req.ip || req.socket.remoteAddress || null;
const routeParam = (req: express.Request, key: string) => String(req.params[key] ?? "");

const roleSchema = z.enum(["Owner", "Super Admin", "Admin", "Moderator", "Support", "Viewer"]);

const reasonSchema = z.string().trim().min(2, "Reason is required");

const playerActionSchemas: Record<string, z.ZodTypeAny> = {
  kick: z.object({ reason: reasonSchema }),
  ban: z.object({ reason: reasonSchema, durationHours: z.number().optional(), permanent: z.boolean().optional() }),
  warn: z.object({ reason: reasonSchema, severity: z.enum(["low", "medium", "high", "critical"]).default("low"), evidence: z.string().optional() }),
  revive: z.object({ reason: z.string().optional() }).default({}),
  heal: z.object({ reason: z.string().optional() }).default({}),
  freeze: z.object({ frozen: z.boolean(), reason: z.string().optional() }),
  bring: z.object({ reason: z.string().optional() }).default({}),
  goto: z.object({ reason: z.string().optional() }).default({}),
  message: z.object({ message: z.string().trim().min(1), reason: z.string().optional() }),
  screenshot: z.object({ reason: z.string().optional() }).default({})
};

const playerActionPermissions: Record<string, Permission> = {
  kick: "players.kick",
  ban: "players.ban",
  warn: "players.warn",
  revive: "players.revive",
  heal: "players.heal",
  freeze: "players.teleport",
  bring: "players.teleport",
  goto: "players.teleport",
  message: "players.view",
  screenshot: "players.screenshot"
};

export function createApiRouter(data: A2DataService): Router {
  const router = express.Router();
  const authenticate = createAuthMiddleware(data);

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
          return res.status(201).json({ warning });
        }
        if (action === "ban") {
          const expiresAt = req.body.permanent || !req.body.durationHours ? null : new Date(Date.now() + Number(req.body.durationHours) * 3600000).toISOString();
          const ban = await data.createBan({ targetName: id, reason: req.body.reason, permanent: Boolean(req.body.permanent), expiresAt }, req.user!, ip(req));
          await data.playerAction("ban", id, req.body, req.user!, ip(req));
          return res.status(201).json({ ban });
        }
        const command = await data.playerAction(action, id, req.body ?? {}, req.user!, ip(req));
        return res.status(202).json({ command, bridgeOnline: data.isBridgeOnline() });
      })
    );
  }

  router.get("/players/:id/inventory", authenticate, requirePermission("players.inventory.view"), asyncRoute(async (req, res) => {
    res.json(await data.getInventory(routeParam(req, "id")));
  }));

  router.post(
    "/players/:id/inventory/give",
    authenticate,
    requirePermission("players.inventory.edit"),
    validateBody(z.object({ item: z.string().trim().min(1), amount: z.coerce.number().int().positive(), reason: reasonSchema, metadata: z.unknown().optional() })),
    asyncRoute(async (req, res) => {
      await data.inventoryAction("give", routeParam(req, "id"), req.body.item, req.body.amount, req.body.reason, req.body.metadata ?? {}, req.user!, ip(req));
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.post(
    "/players/:id/inventory/remove",
    authenticate,
    requirePermission("players.inventory.edit"),
    validateBody(z.object({ item: z.string().trim().min(1), amount: z.coerce.number().int().positive(), reason: reasonSchema })),
    asyncRoute(async (req, res) => {
      await data.inventoryAction("remove", routeParam(req, "id"), req.body.item, req.body.amount, req.body.reason, {}, req.user!, ip(req));
      res.status(202).json({ ok: true, bridgeOnline: data.isBridgeOnline() });
    })
  );

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

  router.get("/staff", authenticate, requirePermission("staff.view"), asyncRoute(async (_req, res) => {
    res.json({ staff: await data.listStaff(), roles: Object.keys(ROLE_PERMISSIONS), rolePermissions: ROLE_PERMISSIONS });
  }));

  router.post(
    "/staff",
    authenticate,
    requirePermission("staff.create"),
    validateBody(z.object({ username: z.string().trim().min(3), displayName: z.string().trim().min(2), password: z.string().min(8), roleName: roleSchema })),
    asyncRoute(async (req, res) => {
      res.status(201).json({ staff: await data.createStaff(req.body as { username: string; displayName: string; password: string; roleName: RoleName }, req.user!, ip(req)) });
    })
  );

  router.patch(
    "/staff/:id",
    authenticate,
    requirePermission("staff.edit"),
    validateBody(z.object({ displayName: z.string().optional(), roleName: roleSchema.optional(), disabled: z.boolean().optional() })),
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
    "/console/command",
    authenticate,
    requirePermission("console.use"),
    validateBody(z.object({ command: z.string().trim().min(1).max(180) })),
    asyncRoute(async (req, res) => {
      res.status(202).json({ command: await data.consoleCommand(req.body.command, req.user!, ip(req)), bridgeOnline: data.isBridgeOnline() });
    })
  );

  router.get("/vehicles", authenticate, requirePermission("players.view"), asyncRoute(async (req, res) => {
    res.json({ vehicles: await data.searchVehicles(String(req.query.search ?? "")) });
  }));

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
