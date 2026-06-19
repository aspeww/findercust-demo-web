import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getDemoCredentials, isDemoMode } from "@/lib/demo";

let ready = false;
let bootstrapping: Promise<void> | null = null;

async function createDemoUser(): Promise<void> {
  const { email, password } = getDemoCredentials();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      name: "FinderCust Demo",
      passwordHash,
      role: "admin",
    },
    create: {
      email: email.toLowerCase(),
      name: "FinderCust Demo",
      passwordHash,
      role: "admin",
    },
  });
}

/** Demo ortamında kullanıcı yoksa oluşturur (Vercel cold start güvenlik ağı). */
export async function ensureDemoReady(): Promise<void> {
  if (!isDemoMode()) return;
  if (ready) return;
  if (bootstrapping) return bootstrapping;

  bootstrapping = (async () => {
    try {
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        await createDemoUser();
        console.log("[demo] demo kullanıcısı oluşturuldu");
      }
      ready = true;
    } catch (error) {
      console.error("[demo] bootstrap başarısız:", error);
    } finally {
      bootstrapping = null;
    }
  })();

  return bootstrapping;
}
