import http from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { corsOrigins, env } from "./config.js";
import { createApiRouter } from "./routes/index.js";
import { A2DataService } from "./services/dataService.js";
import { HttpError, toMessage } from "./utils/errors.js";

const logger = pino({ name: "A2 Panel", level: env.NODE_ENV === "production" ? "info" : "debug" });
const app = express();
const httpServer = http.createServer(app);
const data = new A2DataService();

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true
  }
});

data.setSocketServer(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, "");
  if (!token) return next(new Error("Missing A2 Panel token"));
  try {
    jwt.verify(token, env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid A2 Panel token"));
  }
});

io.on("connection", (socket) => {
  socket.emit("server.status", { online: data.isBridgeOnline() });
  socket.emit("players.updated", data.getOnlinePlayers());
});

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use((pinoHttp as unknown as (options: { logger: typeof logger }) => express.RequestHandler)({ logger }));
app.use("/api", createApiRouter(data));

app.use((_req, _res, next) => {
  next(new HttpError(404, "A2 Panel API route not found", "not_found"));
});

app.use(async (error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : toMessage(error);
  const code = error instanceof HttpError ? error.code : "internal_error";

  if (status >= 500) {
    req.log.error({ error }, "A2 Panel API error");
  }

  if (req.user) {
    await data.createAudit({
      staffUserId: req.user.id,
      staffName: req.user.username,
      actionType: "api.request_failed",
      targetPlayer: req.path,
      reason: message,
      metadata: { code, method: req.method },
      ipAddress: req.ip,
      success: false
    });
  }

  res.status(status).json({ error: message, code });
});

await data.init();

httpServer.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      frontendUrl: env.FRONTEND_URL,
      databaseOnline: data.isDatabaseOnline(),
      a2TablesReady: data.isA2TablesReady()
    },
    "A2 Panel backend listening"
  );
});
