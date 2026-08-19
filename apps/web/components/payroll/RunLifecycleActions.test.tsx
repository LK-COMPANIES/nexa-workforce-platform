import { render, screen } from "@testing-library/react";
import { RunLifecycleActions } from "./RunLifecycleActions";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("../../lib/payroll/actions", () => ({
  calculatePayrollRunAction: jest.fn(),
  approvePayrollRunAction: jest.fn(),
  finalizePayrollRunAction: jest.fn(),
  voidPayrollRunAction: jest.fn(),
}));

// Mirrors apps/api/src/payroll/payroll-run-lifecycle.ts's own transition
// table (brief §48: "payroll ... lifecycle" test coverage) — this is a
// convenience affordance only (the backend re-validates every transition
// regardless, per RunLifecycleActions.tsx's own comment), but a regression
// here would still surface the wrong action to a user for a given status.
describe("RunLifecycleActions — status-gated action visibility", () => {
  it("DRAFT offers Calculate and Void, not Approve or Finalize", () => {
    render(<RunLifecycleActions runId="run-1" status="DRAFT" />);
    expect(screen.getByRole("button", { name: "Calculate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalize" })).not.toBeInTheDocument();
  });

  it("CALCULATED offers Recalculate, Approve, and Void, not Finalize", () => {
    render(<RunLifecycleActions runId="run-1" status="CALCULATED" />);
    expect(screen.getByRole("button", { name: "Recalculate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalize" })).not.toBeInTheDocument();
  });

  it("APPROVED offers only Finalize and Void, not Calculate or Approve", () => {
    render(<RunLifecycleActions runId="run-1" status="APPROVED" />);
    expect(screen.getByRole("button", { name: "Finalize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /calculate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("FINALIZED offers no lifecycle actions at all — a terminal state", () => {
    render(<RunLifecycleActions runId="run-1" status="FINALIZED" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("VOIDED offers no lifecycle actions at all — a terminal state", () => {
    render(<RunLifecycleActions runId="run-1" status="VOIDED" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("CALCULATING shows an in-progress message instead of any action buttons", () => {
    render(<RunLifecycleActions runId="run-1" status="CALCULATING" />);
    expect(screen.getByText(/calculating/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("FAILED offers Calculate (not Recalculate) and Void", () => {
    render(<RunLifecycleActions runId="run-1" status="FAILED" />);
    expect(screen.getByRole("button", { name: "Calculate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
  });
});
