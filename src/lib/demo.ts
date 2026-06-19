export const DEMO_READ_ONLY_ERROR =
  "Demo modunda bu işlem devre dışıdır. Sadece inceleme yapabilirsiniz.";

export function isDemoMode(): boolean {
  return (
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}

export function getDemoCredentials() {
  return {
    email: process.env.DEMO_USER_EMAIL ?? "demo@findercust.com",
    password: process.env.DEMO_USER_PASSWORD ?? "Demo123!",
  };
}

/** Server action guard — returns `{ error }` when demo mutations are blocked. */
export function demoMutationError(): { error: string } | null {
  if (!isDemoMode()) return null;
  return { error: DEMO_READ_ONLY_ERROR };
}

/** Typed guard for actions returning `{ ok: false, error }`. */
export function demoMutationBlocked():
  | { ok: false; error: string }
  | null {
  if (!isDemoMode()) return null;
  return { ok: false, error: DEMO_READ_ONLY_ERROR };
}

/** API route guard — returns 403 Response when demo mutations are blocked. */
export function demoApiBlocked(): Response | null {
  if (!isDemoMode()) return null;
  return Response.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 });
}
