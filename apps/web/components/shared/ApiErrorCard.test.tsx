import { render, screen } from "@testing-library/react";
import { ForbiddenError, ServerApiError, UnauthenticatedError } from "../../lib/api/errors";
import { ApiErrorCard } from "./ApiErrorCard";

// brief §24 / §48: every major page must render distinct states for
// logged-out/expired-session, forbidden/unauthorized, and generic
// failures — never a blank crash. This is the one component all those
// pages funnel through, so its branch logic is worth testing directly.
describe("ApiErrorCard", () => {
  it("renders a session-expired message for UnauthenticatedError", () => {
    render(<ApiErrorCard error={new UnauthenticatedError()} />);
    expect(screen.getByText("Session expired")).toBeInTheDocument();
    expect(screen.getByText(/sign in again/i)).toBeInTheDocument();
  });

  it("renders an access-restricted message for ForbiddenError", () => {
    render(<ApiErrorCard error={new ForbiddenError()} />);
    expect(screen.getByText("Access restricted")).toBeInTheDocument();
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });

  it("renders a generic failure message for any other error", () => {
    render(<ApiErrorCard error={new ServerApiError(500)} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders a generic failure message for a non-ApiError thrown value", () => {
    render(<ApiErrorCard error={new Error("network exploded")} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("network exploded")).toBeInTheDocument();
  });

  it("renders a fallback message for a non-Error thrown value", () => {
    render(<ApiErrorCard error={"a plain string was thrown"} />);
    expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument();
  });
});
