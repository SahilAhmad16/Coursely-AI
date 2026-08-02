import { cancelWithdrawal, requestWithdrawal, savePayoutAccount } from "@/app/actions/payouts";
import { formatPrice } from "@/lib/data/marketplace";

type PayoutAccount = {
  id: string;
  method: "upi" | "bank";
  account_holder_name: string;
  upi_id: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  verification_status: "unverified" | "verified" | "rejected";
  verification_note: string | null;
};

type Withdrawal = {
  id: string;
  amount_paise: number;
  status: "requested" | "processing" | "paid" | "rejected" | "cancelled" | "failed";
  provider_payout_id: string | null;
  admin_note: string | null;
  requested_at: string;
};

const messages: Record<string, string> = {
  "account-saved": "Payout details saved. Coursely AI will verify them before withdrawals are enabled.",
  "invalid-account": "Enter valid UPI or bank details.",
  "save-failed": "Payout details could not be saved. Please try again.",
  requested: "Withdrawal request submitted successfully.",
  cancelled: "Withdrawal request cancelled.",
  "verify-required": "Your payout account must be verified before you can withdraw.",
  "insufficient-balance": "The requested amount is higher than your available balance.",
  "invalid-amount": "Enter an amount of at least INR 100.",
  "request-failed": "Withdrawal could not be requested. Please try again.",
};

function mask(value: string | null) {
  if (!value) return "Not provided";
  if (value.length <= 4) return value;
  return `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

export function SellerWallet({ account, withdrawals, earnedPaise, reservedPaise, paidPaise, message }: { account: PayoutAccount | null; withdrawals: Withdrawal[]; earnedPaise: number; reservedPaise: number; paidPaise: number; message?: string }) {
  const availablePaise = Math.max(0, earnedPaise - reservedPaise - paidPaise);
  const notice = message ? messages[message] : null;

  return <section id="seller-wallet" className="mt-8 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
    <div className="bg-slate-950 p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Seller wallet</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <WalletMetric label="Available to withdraw" value={formatPrice(availablePaise)} />
        <WalletMetric label="Pending withdrawals" value={formatPrice(reservedPaise)} />
        <WalletMetric label="Paid to you" value={formatPrice(paidPaise)} />
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">Digital-product commission is deducted before earnings reach this wallet. Service earnings have no sale commission. Subscription payments and Coursely AI commission remain with the platform owner.</p>
    </div>

    <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Payout account</h2><p className="mt-1 text-sm text-slate-600">Use your own UPI ID or Indian bank account.</p></div>{account && <Status status={account.verification_status} />}</div>
        {notice && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message?.includes("saved") || message === "requested" || message === "cancelled" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{notice}</p>}
        {account && <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-bold">{account.account_holder_name}</p><p className="mt-1 text-slate-600">{account.method === "upi" ? `UPI · ${mask(account.upi_id)}` : `${account.bank_name} · A/C ${mask(account.bank_account_number)} · ${account.bank_ifsc}`}</p>{account.verification_note && <p className="mt-2 text-xs text-slate-500">{account.verification_note}</p>}</div>}
        <form action={savePayoutAccount} className="mt-5 grid gap-3">
          <select name="method" defaultValue={account?.method ?? "upi"} className="rounded-xl border border-slate-300 bg-white p-3" required><option value="upi">UPI</option><option value="bank">Bank transfer</option></select>
          <input name="accountHolderName" defaultValue={account?.account_holder_name ?? ""} minLength={2} maxLength={100} required placeholder="Account holder name" className="rounded-xl border border-slate-300 p-3" />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">For UPI, enter the UPI ID below. For bank transfer, enter all three bank fields. Unused fields are ignored.</div>
          <input name="upiId" placeholder="UPI ID, e.g. name@bank" className="rounded-xl border border-slate-300 p-3" />
          <input name="bankName" placeholder="Bank name" className="rounded-xl border border-slate-300 p-3" />
          <input name="bankAccountNumber" inputMode="numeric" placeholder="Bank account number" className="rounded-xl border border-slate-300 p-3" />
          <input name="bankIfsc" placeholder="IFSC code" className="rounded-xl border border-slate-300 p-3 uppercase" />
          <button className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Save and submit for verification</button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-black">Withdraw earnings</h2>
        <p className="mt-1 text-sm text-slate-600">Minimum withdrawal is INR 100. Requests are reviewed before transfer.</p>
        <form action={requestWithdrawal} className="mt-5 flex gap-3"><input name="amountRupees" type="number" min="100" max={Math.floor(availablePaise / 100)} step="0.01" required placeholder="Amount in INR" className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3" /><button disabled={account?.verification_status !== "verified" || availablePaise < 10000} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Request</button></form>
        {account?.verification_status !== "verified" && <p className="mt-2 text-xs font-semibold text-amber-700">Withdrawal unlocks after the payout account is verified.</p>}

        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Withdrawal history</h3>
          {withdrawals.map((withdrawal) => <article key={withdrawal.id} className="rounded-2xl border border-slate-200 p-4 text-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-black">{formatPrice(withdrawal.amount_paise)}</p><p className="mt-1 text-xs text-slate-500">{new Date(withdrawal.requested_at).toLocaleString("en-IN")}</p></div><Status status={withdrawal.status} /></div>{withdrawal.provider_payout_id && <p className="mt-2 text-xs text-slate-600">Transfer reference: {withdrawal.provider_payout_id}</p>}{withdrawal.admin_note && <p className="mt-2 text-xs text-slate-600">{withdrawal.admin_note}</p>}{withdrawal.status === "requested" && <form action={cancelWithdrawal} className="mt-3"><input type="hidden" name="requestId" value={withdrawal.id} /><button className="text-xs font-bold text-rose-700">Cancel request</button></form>}</article>)}
          {!withdrawals.length && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No withdrawal requests yet.</p>}
        </div>
      </div>
    </div>
  </section>;
}

function WalletMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function Status({ status }: { status: string }) {
  const color = status === "verified" || status === "paid" ? "bg-emerald-100 text-emerald-800" : status === "rejected" || status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900";
  return <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${color}`}>{status.replaceAll("_", " ")}</span>;
}
