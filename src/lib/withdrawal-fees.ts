export type WithdrawalMethod = "upi" | "bank";

// Cashfree's standard domestic payout charge, plus 18% GST, in paise.
// The server-side database function repeats this calculation and remains authoritative.
export function withdrawalFeePaise(amountPaise: number, method: WithdrawalMethod) {
  const normalizedAmount = Math.max(0, Math.round(amountPaise));
  const baseFeePaise = method === "upi"
    ? normalizedAmount <= 100_000 ? 600 : normalizedAmount <= 2_500_000 ? 800 : 1_500
    : normalizedAmount <= 100_000 ? 300 : normalizedAmount <= 2_500_000 ? 500 : 800;

  return Math.ceil(baseFeePaise * 1.18);
}

export function withdrawalDebitPaise(amountPaise: number, method: WithdrawalMethod) {
  return Math.max(0, Math.round(amountPaise)) + withdrawalFeePaise(amountPaise, method);
}

export function maximumWithdrawalPaise(availablePaise: number, method: WithdrawalMethod) {
  const available = Math.max(0, Math.floor(availablePaise));
  let low = 0;
  let high = available;

  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    if (withdrawalDebitPaise(candidate, method) <= available) low = candidate;
    else high = candidate - 1;
  }

  return low;
}
