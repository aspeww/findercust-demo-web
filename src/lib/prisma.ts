import { PrismaClient } from "@prisma/client";
import { initDatabaseUrl } from "@/lib/database";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const databaseUrl = initDatabaseUrl();
if (process.env.DATABASE_URL !== databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

export const prisma =
  global.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
