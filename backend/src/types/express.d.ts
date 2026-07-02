import type { AuthUser } from "./models.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
