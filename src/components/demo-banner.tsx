import { AlertTriangle } from "lucide-react";
import { isDemoMode } from "@/lib/demo";

export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
        <p>
          <strong>Demo modu:</strong> Paneli gezebilirsiniz; kayıt, düzenleme,
          silme, export ve e-posta gönderimi devre dışıdır.
        </p>
      </div>
    </div>
  );
}
