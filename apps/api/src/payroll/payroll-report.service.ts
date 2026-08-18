import { Injectable } from "@nestjs/common";
import type { PayrollRecord } from "@prisma/client";
import { PayrollRepository } from "./payroll.repository";
import type { RequestTenantContext } from "../tenancy/types";

export interface PayrollRunSummary {
  employeeCount: number;
  grossPayroll: number;
  taxablePayroll: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  shif: number;
  housingLevyEmployee: number;
  housingLevyEmployer: number;
  otherDeductions: number;
  netPayroll: number;
  totalEmployerStatutoryCost: number;
  totalEmploymentCost: number;
}

function toNumber(value: PayrollRecord["grossPay"]): number {
  // Prisma Decimal — .toNumber() would lose no precision here since these
  // are already the 2dp-rounded figures the engine returned.
  return Number(value);
}

/** Reads the `{ total: number }` shape PayrollService writes into the otherDeductions/allowableDeductions JSON columns. */
function jsonTotal(value: PayrollRecord["otherDeductions"]): number {
  if (value && typeof value === "object" && "total" in value && typeof value.total === "number") {
    return value.total;
  }
  return 0;
}

// Brief §24: "Do not calculate report totals independently using a second
// set of formulas. Aggregate the persisted/calculated payroll results." This
// service does exactly that — it sums PayrollRecord columns, the same
// numbers a client sees per-employee, rather than re-deriving totals from
// the engine or from Employee/Contract data.
@Injectable()
export class PayrollReportService {
  constructor(private readonly repository: PayrollRepository) {}

  async getRunSummary(tenant: RequestTenantContext, runId: string): Promise<PayrollRunSummary> {
    const records = await this.repository.getRunRecords(tenant, runId);

    return records.reduce<PayrollRunSummary>(
      (summary, record) => ({
        employeeCount: summary.employeeCount + 1,
        grossPayroll: summary.grossPayroll + toNumber(record.grossPay),
        taxablePayroll: summary.taxablePayroll + toNumber(record.taxableIncome),
        paye: summary.paye + toNumber(record.payeAmount),
        nssfEmployee: summary.nssfEmployee + toNumber(record.nssfEmployeeAmount),
        nssfEmployer: summary.nssfEmployer + toNumber(record.nssfEmployerAmount),
        shif: summary.shif + toNumber(record.shifAmount),
        housingLevyEmployee: summary.housingLevyEmployee + toNumber(record.housingLevyEmployeeAmount),
        housingLevyEmployer: summary.housingLevyEmployer + toNumber(record.housingLevyEmployerAmount),
        otherDeductions: summary.otherDeductions + jsonTotal(record.otherDeductions) + jsonTotal(record.allowableDeductions),
        netPayroll: summary.netPayroll + toNumber(record.netPay),
        totalEmployerStatutoryCost: summary.totalEmployerStatutoryCost + toNumber(record.employerStatutoryCost),
        totalEmploymentCost: summary.totalEmploymentCost + toNumber(record.totalEmploymentCost),
      }),
      {
        employeeCount: 0,
        grossPayroll: 0,
        taxablePayroll: 0,
        paye: 0,
        nssfEmployee: 0,
        nssfEmployer: 0,
        shif: 0,
        housingLevyEmployee: 0,
        housingLevyEmployer: 0,
        otherDeductions: 0,
        netPayroll: 0,
        totalEmployerStatutoryCost: 0,
        totalEmploymentCost: 0,
      },
    );
  }
}
