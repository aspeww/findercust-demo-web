import fs from "node:fs";
import path from "node:path";

const TMP_DB_PATH = "/tmp/findercust-demo.db";

/** Vercel serverless'ta SQLite yalnızca /tmp altında çalışır. */
export function initDatabaseUrl(): string {
  if (process.env.VERCEL === "1") {
    const bundledDb = path.join(process.cwd(), "prisma", "demo.db");

    try {
      if (fs.existsSync(bundledDb)) {
        fs.copyFileSync(bundledDb, TMP_DB_PATH);
      }
    } catch (error) {
      console.error("[db] bundled demo.db /tmp'ye kopyalanamadı:", error);
    }

    return `file:${TMP_DB_PATH}`;
  }

  return process.env.DATABASE_URL ?? "file:./demo.db";
}
