/** Automatic financial calculations for activity operational data. */

export function calculatePerDiem(rate: number | null | undefined, frequency: number | null | undefined): number {
  return (Number(rate) || 0) * (Number(frequency) || 0);
}

export function calculateFuelAmount(litres: number | null | undefined, fuelRate: number | null | undefined): number {
  return (Number(litres) || 0) * (Number(fuelRate) || 0);
}

export function teamMemberCalculatedTotal(input: {
  rate?: number | null;
  frequency?: number | null;
  airtimeData?: number | null;
  fuelAllocation?: number | null;
}): number {
  return calculatePerDiem(input.rate, input.frequency) + (Number(input.airtimeData) || 0) + (Number(input.fuelAllocation) || 0);
}

export function amountsDisagree(supplied: number | null | undefined, calculated: number | null | undefined, epsilon = 0.01): boolean {
  if (supplied == null || calculated == null) return false;
  return Math.abs(Number(supplied) - Number(calculated)) > epsilon;
}
