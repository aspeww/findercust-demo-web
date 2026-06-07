"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
} from "@/lib/domain";
import { deleteLead, updateLeadStatus } from "../../actions";

export function LeadActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onChange = (v: string) => {
    start(async () => {
      const res = await updateLeadStatus(id, v);
      if ("ok" in res) {
        toast.success("Durum güncellendi");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const onDelete = () => {
    if (!confirm("Lead silinecek. Emin misin?")) return;
    start(async () => {
      await deleteLead(id);
      toast.success("Lead silindi");
      router.push("/leads");
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={status} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={onDelete}
        disabled={pending}
        title="Sil"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
