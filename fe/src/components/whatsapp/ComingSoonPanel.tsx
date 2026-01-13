"use client";

import { Button } from "@/components/ui/button";

export function ComingSoonPanel(props: {
  title: string;
  description?: string;
  hint?: string;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
}) {
  const { title, description, hint, onPrimaryAction, primaryActionLabel } = props;

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">
          {description ?? "Fitur ini akan kita tambahin di tahap berikutnya."}
        </p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>

      {onPrimaryAction && (
        <div className="mt-4">
          <Button onClick={onPrimaryAction} variant="outline">
            {primaryActionLabel ?? "Preview"}
          </Button>
        </div>
      )}
    </div>
  );
}


