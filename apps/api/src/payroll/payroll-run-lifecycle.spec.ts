import { ConflictException } from "@nestjs/common";
import { assertValidPayrollTransition, isTerminalPayrollStatus } from "./payroll-run-lifecycle";

describe("payroll run lifecycle", () => {
  it.each([
    ["DRAFT", "CALCULATING"],
    ["CALCULATING", "CALCULATED"],
    ["CALCULATING", "FAILED"],
    ["CALCULATED", "UNDER_REVIEW"],
    ["CALCULATED", "APPROVED"],
    ["UNDER_REVIEW", "APPROVED"],
    ["APPROVED", "FINALIZED"],
    ["FAILED", "CALCULATING"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(() => assertValidPayrollTransition(from, to)).not.toThrow();
  });

  it.each([
    ["DRAFT", "CALCULATED"],
    ["DRAFT", "APPROVED"],
    ["DRAFT", "FINALIZED"],
    ["CALCULATING", "APPROVED"],
    ["CALCULATED", "FINALIZED"], // must go through APPROVED first
    ["FINALIZED", "CALCULATING"], // brief §20: never silently recalculate a finalized run
    ["FINALIZED", "VOIDED"], // finalized runs are never voided either — see PayrollService.voidRun
    ["VOIDED", "CALCULATING"],
    ["APPROVED", "CALCULATING"], // cannot go back to calculating once approved
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(() => assertValidPayrollTransition(from, to)).toThrow(ConflictException);
  });

  it("treats FINALIZED and VOIDED as terminal states", () => {
    expect(isTerminalPayrollStatus("FINALIZED")).toBe(true);
    expect(isTerminalPayrollStatus("VOIDED")).toBe(true);
  });

  it("treats every other state as non-terminal", () => {
    expect(isTerminalPayrollStatus("DRAFT")).toBe(false);
    expect(isTerminalPayrollStatus("CALCULATING")).toBe(false);
    expect(isTerminalPayrollStatus("CALCULATED")).toBe(false);
    expect(isTerminalPayrollStatus("UNDER_REVIEW")).toBe(false);
    expect(isTerminalPayrollStatus("APPROVED")).toBe(false);
    expect(isTerminalPayrollStatus("FAILED")).toBe(false);
  });
});
