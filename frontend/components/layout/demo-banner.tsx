"use client";

import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDemoStatus } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api } from "@/lib/api";

export function DemoBanner() {
  const { data } = useDemoStatus();
  const [confirm, setConfirm] = useState(false);
  const remove = useFinanceMutation(() => api.demo.remove(), {
    success: "Demo data removed",
    onSuccess: () => setConfirm(false),
  });
  if (!data?.loaded) return null;
  return (
    <>
      <div
        role="status"
        className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-warning/50 bg-warning-soft px-4 py-2.5 text-[13px]"
      >
        <FlaskConical className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        <p className="min-w-0 flex-1 text-fg">
          <span className="font-medium">Demo mode.</span>{" "}
          <span className="text-fg-muted">Sample records marked “Demo” are included in your figures.</span>
        </p>
        <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
          Remove demo data
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title="Remove demo data?"
        confirmLabel="Remove"
        description={<p>Every sample record is deleted. Records you created yourself are kept.</p>}
      />
    </>
  );
}
