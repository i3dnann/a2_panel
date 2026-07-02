import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().default("change_this_secret"),
  DATABASE_HOST: z.string().default("127.0.0.1"),
  DATABASE_PORT: z.coerce.number().default(3306),
  DATABASE_USER: z.string().default("root"),
  DATABASE_PASSWORD: z.string().default(""),
  DATABASE_NAME: z.string().default("a2_panel"),
  FIVEM_SHARED_SECRET: z.string().default("change_this_bridge_secret"),
  FIVEM_SERVER_IP: z.string().default("127.0.0.1"),
  FIVEM_SERVER_PORT: z.coerce.number().default(30120),
  RCON_PASSWORD: z.string().default(""),
  DISCORD_WEBHOOK_ADMIN: z.string().default(""),
  DISCORD_WEBHOOK_BANS: z.string().default(""),
  DISCORD_WEBHOOK_REPORTS: z.string().default(""),
  DISCORD_WEBHOOK_ERRORS: z.string().default("")
});

export const env = envSchema.parse(process.env);

export const corsOrigins = env.FRONTEND_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
