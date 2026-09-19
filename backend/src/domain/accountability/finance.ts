export type AccountabilityLineInput = { kind?: string; description?: string; amount?: number };
export type AccountabilityLineRecord = { kind: string; description: string; amount: number };

export function sanitizeLines(input: unknown): AccountabilityLineRecord[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error('Financial items must be a list.');
  return input.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Financial item ${index + 1} is invalid.`);
    const r = row as AccountabilityLineInput;
    const description = String(r.description ?? '').trim();
    if (!description) throw new Error(`Financial item ${index + 1} needs a description.`);
    const amount = Number(r.amount);
    if (!(amount >= 0)) throw new Error(`Financial item ${index + 1} needs a valid amount.`);
    const kind = String(r.kind || 'expenditure').toLowerCase();
    if (kind !== 'expenditure') throw new Error(`Financial item ${index + 1} kind must be expenditure.`);
    return { kind, description, amount };
  });
}

export function sumAccounted(lines: { amount: number }[]): number {
  return lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
}

export function outstanding(advanced: number, accounted: number, returned: number): number {
  return Number(advanced || 0) - accounted - Number(returned || 0);
}

export function variance(advanced: number, accounted: number, returned: number): number {
  return accounted + Number(returned || 0) - Number(advanced || 0);
}
