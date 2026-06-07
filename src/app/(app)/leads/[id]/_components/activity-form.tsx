"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone, Mail, MessageSquare, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addActivity } from "../../actions";
import { useState } from "react";

const TYPES = [
  { value: "note", label: "Not", icon: MessageSquare },
  { value: "call", label: "Arama", icon: Phone },
  { value: "email", label: "E-posta", icon: Mail },
  { value: "meeting", label: "Toplantı", icon: CalendarCheck },
] as const;

export function ActivityForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<string>("note");

  const onSubmit = (formData: FormData) => {
    formData.set("leadId", leadId);
    formData.set("type", type);
    start(async () => {
      const res = await addActivity(formData);
      if ("ok" in res) {
        toast.success("Aktivite eklendi");
        (document.getElementById("activity-content") as HTMLTextAreaElement).value = "";
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        id="activity-content"
        name="content"
        rows={3}
        placeholder="Ne oldu? (örn. Müşteriyi aradım, sözleşme hazırlanıyor…)"
        required
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Ekleniyor…" : "Ekle"}
        </Button>
      </div>
    </form>
  );
}
