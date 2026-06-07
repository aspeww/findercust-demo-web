import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { MapPin, Search, Briefcase, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <MapPin className="size-5" />
            FinderCust
          </Link>
          <nav className="flex items-center gap-2">
            {session?.user ? (
              <Button asChild size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/login">Giriş yap</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Kayıt ol</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
            Adım 1 — Temel altyapı kuruldu
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Web sitesi olmayan işletmeleri bul,{" "}
            <span className="text-muted-foreground">
              onlara özel siteler sat.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Google Maps üzerinden bölge bölge tarama yap, web sitesi olmayan
            işletmeleri lead olarak kaydet, satış sürecini ve teslim ettiğin
            siteleri tek panelden yönet.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link href={session?.user ? "/dashboard" : "/register"}>
                Hemen başla <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Giriş yap</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<Search className="size-5" />}
            title="Maps ile keşfet"
            desc="Şehir / kategori bazlı tarama. Web sitesi olmayanları otomatik filtrele."
            badge="Adım 2"
          />
          <FeatureCard
            icon={<Briefcase className="size-5" />}
            title="CRM pipeline"
            desc="Yeni → İletişim → İlgili → Pazarlık → Kazanıldı / Kaybedildi."
            badge="Adım 3"
          />
          <FeatureCard
            icon={<MapPin className="size-5" />}
            title="Site teslimi"
            desc="Her lead için proje, fiyat, canlı URL ve teslim tarihi."
            badge="Adım 4"
          />
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} FinderCust</span>
          <span>Built with Next.js · Prisma · Auth.js</span>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-lg border">
          {icon}
        </div>
        <span className="text-xs text-muted-foreground">{badge}</span>
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
