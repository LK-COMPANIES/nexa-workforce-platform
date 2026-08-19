import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@nexa/ui";
import { ForbiddenError, UnauthenticatedError } from "../../lib/api/errors";

// brief §24: every major page must handle Unauthorized / Forbidden / Expired
// session distinctly, never a generic crash. Renders inline, in the page's
// own layout — never a full blank error screen.
export function ApiErrorCard({ error }: { error: unknown }) {
  if (error instanceof UnauthenticatedError) {
    return (
      <Alert variant="warning">
        <Lock className="h-4 w-4" aria-hidden />
        <AlertTitle>Session expired</AlertTitle>
        <AlertDescription>Your session has expired. Please sign in again to continue.</AlertDescription>
      </Alert>
    );
  }

  if (error instanceof ForbiddenError) {
    return (
      <Alert variant="warning">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        <AlertTitle>Access restricted</AlertTitle>
        <AlertDescription>
          You do not have permission to view this. Contact your organization administrator if you believe this is
          incorrect.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" aria-hidden />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      </AlertDescription>
    </Alert>
  );
}
