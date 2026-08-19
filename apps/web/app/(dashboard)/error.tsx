"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@nexa/ui";

// Catches anything NOT already handled inline via ApiErrorCard (brief §24) —
// a genuinely unexpected failure, not a routine 401/403/404 (those render
// their own state directly in the page, see components/shared/ApiErrorCard).
export default function DashboardSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 py-12">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          An unexpected error occurred while loading this page. You can try again, or contact support if this
          persists.
        </AlertDescription>
      </Alert>
      <Button onClick={reset} className="w-fit">
        Try again
      </Button>
    </div>
  );
}
