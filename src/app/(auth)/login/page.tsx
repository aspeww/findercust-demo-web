import { getDemoCredentials, isDemoMode } from "@/lib/demo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const demoMode = isDemoMode();
  const demo = demoMode ? getDemoCredentials() : null;

  return (
    <LoginForm
      demoMode={demoMode}
      demoEmail={demo?.email}
      demoPassword={demo?.password}
    />
  );
}
