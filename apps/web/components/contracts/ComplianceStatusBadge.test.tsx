import { render, screen } from "@testing-library/react";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";

describe("ComplianceStatusBadge", () => {
  it("renders a human-readable label for every deterministic compliance status", () => {
    render(<ComplianceStatusBadge status="PASS" />);
    expect(screen.getByText("Pass")).toBeInTheDocument();

    render(<ComplianceStatusBadge status="WARNING" />);
    expect(screen.getByText("Warning")).toBeInTheDocument();

    render(<ComplianceStatusBadge status="FAIL" />);
    expect(screen.getByText("Fail")).toBeInTheDocument();

    render(<ComplianceStatusBadge status="REQUIRES_HUMAN_REVIEW" />);
    expect(screen.getByText("Requires human review")).toBeInTheDocument();
  });
});
