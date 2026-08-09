"use client";

import { useMemo, useState } from "react";
import { requestWithdrawal } from "@/app/actions/payouts";
import { maximumWithdrawalPaise, withdrawalDebitPaise, withdrawalFeePaise, type WithdrawalMethod } from "@/lib/withdrawal-fees";

function formatPrice(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
}

export function WithdrawalForm({ method, availablePaise, enabled }: { method: WithdrawalMethod; availablePaise: number; enabled: boolean }) {
  const [amount, setAmount] = useState("");
  const amountPaise = /^\d+(\.\d{0,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0;
  const maximumPaise = maximumWithdrawalPaise(availablePaise, method);
  const feePaise = amountPaise > 0 ? withdrawalFeePaise(amountPaise, method) : 0;
  const debitPaise = amountPaise > 0 ? withdrawalDebitPaise(amountPaise, method) : 0;
  const isValid = enabled && amountPaise >= 10_000 && debitPaise <= availablePaise;
  const description = useMemo(() => {
    if (!amountPaise) return "Enter an amount to see the exact withdrawal fee.";
    if (debitPaise > availablePaise) return `This payout needs ${formatPrice(debitPaise)} in your wallet including the fee.`;
    return `You receive ${formatPrice(amountPaise)}. Fee: ${formatPrice(feePaise)}. Total wallet debit: ${formatPrice(debitPaise)}.`;
  }, [amountPaise, availablePaise, debitPaise, feePaise]);

  return <form action={requestWithdrawal} className="mt-5">
    <div className="flex gap-3">
      <input
        name="amountRupees"
        type="number"
        min="100"
        max={(maximumPaise / 100).toFixed(2)}
        step="0.01"
        required
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="Amount seller receives (INR)"
        className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3"
      />
      <button disabled={!isValid} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Withdraw</button>
    </div>
    <p className={`mt-2 rounded-xl p-3 text-xs font-semibold ${amountPaise && debitPaise <= availablePaise ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600"}`}>{description}</p>
    <p className="mt-2 text-xs text-slate-500">The seller pays the payout provider charge and GST. Buyer checkout is not surcharged, and Coursely AI commission is not deducted again.</p>
  </form>;
}
