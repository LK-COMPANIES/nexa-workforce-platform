import Decimal from "decimal.js";

// -----------------------------------------------------------------------------
// Rounding policy (documented once here, applied everywhere in this engine):
//
//   - Intermediate calculations: FULL precision (34 significant digits — see
//     Decimal.set below), no rounding at all until a value is about to be
//     returned as a final result field. Tax-band and contribution-tier
//     boundary comparisons use these exact, unrounded values — a salary of
//     precisely 24000.00 must land cleanly on the PAYE band boundary without
//     floating-point drift, which is exactly what native `number` cannot
//     guarantee (0.1 + 0.2 !== 0.3) and Decimal.js does guarantee.
//   - Final monetary values (anything returned on PayrollCalculationResult
//     as an amount): rounded to 2 decimal places, ROUND_HALF_UP — the
//     conventional rounding mode for currency, matching how payroll systems
//     and KRA's own published worked examples round.
//   - Percentages (effectiveTaxRate): rounded to 4 decimal places.
//   - Never native `number` arithmetic for money. `number` is accepted only
//     at the input boundary (see types.ts) and immediately wrapped in Money.
//
// Same input + same rules ALWAYS produces the same output: Decimal.js
// arithmetic is deterministic (no platform/engine floating-point variance),
// and this module introduces no randomness, no clock reads, no I/O.
// -----------------------------------------------------------------------------

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  static of(input: number | string | Decimal): Money {
    if (typeof input === "number" && !Number.isFinite(input)) {
      throw new RangeError(`Monetary value must be a finite number, received: ${input}`);
    }
    const decimal = input instanceof Decimal ? input : new Decimal(input);
    return new Money(decimal);
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  static sum(values: Money[]): Money {
    return values.reduce((total, value) => total.plus(value), Money.zero());
  }

  static min(...values: Money[]): Money {
    if (values.length === 0) {
      throw new RangeError("Money.min() requires at least one value");
    }
    return values.reduce((min, value) => (value.lessThan(min) ? value : min));
  }

  static max(...values: Money[]): Money {
    if (values.length === 0) {
      throw new RangeError("Money.max() requires at least one value");
    }
    return values.reduce((max, value) => (value.greaterThan(max) ? value : max));
  }

  plus(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  minus(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  times(factor: number | string | Decimal): Money {
    return new Money(this.value.times(factor));
  }

  dividedBy(divisor: number | string | Decimal): Money {
    return new Money(this.value.dividedBy(divisor));
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  lessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  lessThanOrEqualTo(other: Money): boolean {
    return this.value.lessThanOrEqualTo(other.value);
  }

  greaterThan(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  /** Statutory amounts (PAYE, NSSF, etc.) must never be negative — clamps a shortfall to zero. */
  clampToZero(): Money {
    return this.isNegative() ? Money.zero() : this;
  }

  /** Final monetary rounding per the policy above: 2dp, ROUND_HALF_UP. */
  toRoundedNumber(): number {
    return this.value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Snaps to 2dp and returns a new Money holding that rounded value. Used to
   * round each statutory LINE ITEM (PAYE, each NSSF tier, SHIF, Housing
   * Levy) exactly once, immediately after it is computed — every aggregate
   * built afterward (totals, netPay) sums these already-rounded values, so
   * a displayed total always reconciles exactly with the sum of the
   * displayed line items an auditor would reconstruct it from. Summing
   * full-precision values and rounding only the total would be marginally
   * more "mathematically pure" but would let a total disagree by a cent
   * from its own published breakdown — unacceptable for a payslip.
   */
  rounded(): Money {
    return new Money(this.value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }

  raw(): Decimal {
    return this.value;
  }
}

/** Rounds a ratio (e.g. paye / income) to 4dp for the effectiveTaxRate result field. */
export function roundRate(value: Decimal): number {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}
