"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type Props = {
  enabled: boolean;
};

export function DemoRestrictions({ enabled }: Props) {
  useEffect(() => {
    if (!enabled) return;

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.demoAllow === "true") return;

      event.preventDefault();
      event.stopPropagation();
      toast.error("Demo modunda bu işlem devre dışıdır.");
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [enabled]);

  return null;
}
