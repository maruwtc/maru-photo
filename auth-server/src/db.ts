import pg from "pg";
import type { Config } from "./config.js";

const { Pool } = pg;

export function createPool(config: Config): pg.Pool {
  return new Pool({
    connectionString: config.databaseUrl
  });
}

export type DbPool = pg.Pool;
