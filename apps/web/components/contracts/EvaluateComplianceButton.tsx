"use client";

import { useState, useTransition } from "react";
import { Button } from "@nexa/ui";
import { evaluateComplianceAction } from "../../lib/contracts/actions";

export function EvaluateComplianceButton({ contractId }: { contractId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await evaluateComplianceAction(contractId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={isPending} aria-busy={isPending} onClick={handleClick}>
        {isPending ? "Evaluating…" : "Run compliance validation"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
