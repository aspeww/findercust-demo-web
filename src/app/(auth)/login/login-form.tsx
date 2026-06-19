"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginAction, type AuthFormState } from "../actions";

type Props = {
  demoMode: boolean;
  demoEmail?: string;
  demoPassword?: string;
};

export function LoginForm({ demoMode, demoEmail, demoPassword }: Props) {
  const [state, formAction, pending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(loginAction, undefined);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Giriş yap</CardTitle>
        <CardDescription>
          {demoMode
            ? "Demo hesabıyla paneli inceleyin."
            : "Hesabınla devam et."}
        </CardDescription>
      </CardHeader>

      {demoMode && demoEmail && demoPassword && (
        <div className="mx-6 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-950">Demo hesabı</p>
          <dl className="mt-2 space-y-1 text-amber-900">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">E-posta:</dt>
              <dd className="font-mono">{demoEmail}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Şifre:</dt>
              <dd className="font-mono">{demoPassword}</dd>
            </div>
          </dl>
        </div>
      )}

      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={demoMode ? demoEmail : undefined}
              required
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.email[0]}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue={demoMode ? demoPassword : undefined}
              required
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Giriş yapılıyor…" : demoMode ? "Demo ile giriş yap" : "Giriş yap"}
          </Button>
          {!demoMode && (
            <p className="text-sm text-muted-foreground">
              Hesabın yok mu?{" "}
              <Link
                href="/register"
                className="font-medium text-foreground hover:underline"
              >
                Kayıt ol
              </Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
