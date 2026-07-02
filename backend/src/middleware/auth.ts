import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config.js";
import type { A2DataService } from "../services/dataService.js";
import type { Permission } from "../types/models.js";
import { HttpError } from "../utils/errors.js";

export function createAuthMiddleware(data: A2DataService) {
  return async function authenticate(req: Request, _res: Response, next: NextFunction) {
    try {
      const authHeader = req.header("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) throw new HttpError(401, "Missing access token", "missing_token");

      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      const user = await data.getUserById(Number(payload.sub));
      if (!user || user.disabled) throw new HttpError(401, "Session expired", "session_expired");

      req.user = user;
      next();
    } catch (error) {
      next(error instanceof HttpError ? error : new HttpError(401, "Session expired", "session_expired"));
    }
  };
}

export function requirePermission(permission: Permission) {
  return function permissionGuard(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) return next(new HttpError(401, "Missing authenticated user", "missing_user"));
    if (!req.user.permissions.includes(permission)) {
      return next(new HttpError(403, `Permission required: ${permission}`, "permission_denied"));
    }
    next();
  };
}

export function bridgeSecretGuard(req: Request, _res: Response, next: NextFunction) {
  const headerSecret = req.header("x-a2-bridge-secret") ?? req.header("x-bridge-secret");
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const bodySecret = typeof req.body?.secret === "string" ? req.body.secret : undefined;
  if ([headerSecret, bearer, bodySecret].includes(env.FIVEM_SHARED_SECRET)) {
    return next();
  }
  next(new HttpError(401, "Invalid A2 Panel bridge shared secret", "invalid_bridge_secret"));
}
