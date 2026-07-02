import mysql from "mysql2/promise";
import { env } from "./config.js";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      user: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      database: env.DATABASE_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      decimalNumbers: true,
      multipleStatements: false
    });
  }

  return pool;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function queryRows<T>(sql: string, values?: Record<string, unknown> | unknown[]): Promise<T[]> {
  const [rows] = await getPool().execute(sql, values as never);
  return rows as T[];
}

export async function execute(sql: string, values?: Record<string, unknown> | unknown[]): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, values as never);
  return result as mysql.ResultSetHeader;
}

export async function tableExists(tableName: string): Promise<boolean> {
  const rows = await queryRows<{ found: string }>(
    "SELECT TABLE_NAME AS found FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :database AND TABLE_NAME = :tableName LIMIT 1",
    { database: env.DATABASE_NAME, tableName }
  );
  return rows.length > 0;
}
