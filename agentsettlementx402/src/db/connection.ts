import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

export type DatabaseClient = NeonHttpDatabase<typeof schema>;

export const createDatabaseClient = (connectionUrl: string): DatabaseClient => {
  const sql = neon(connectionUrl);
  return drizzle(sql, { schema });
};

export const getDatabaseUrlFromEnvironment = (): string => {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  const url = runtime.process?.env?.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return url;
};

export const createDatabaseClientFromEnvironment = (): DatabaseClient => {
  return createDatabaseClient(getDatabaseUrlFromEnvironment());
};
