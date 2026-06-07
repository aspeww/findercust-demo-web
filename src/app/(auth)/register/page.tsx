import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Kayıt kapalı</CardTitle>
          <CardDescription>
            Bu sistem tek kullanıcılıdır. Lütfen mevcut hesapla giriş yap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Yeni hesap oluşturma devre dışı bırakıldı.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">Giriş yap</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return <RegisterForm />;
}
