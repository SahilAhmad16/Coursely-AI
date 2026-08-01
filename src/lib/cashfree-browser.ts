"use client";

type CheckoutResult = { error?: { message?: string }; redirect?: boolean; paymentDetails?: { paymentMessage?: string } };
type CashfreeClient = { checkout: (options: { paymentSessionId: string; redirectTarget: "_self" | "_modal" }) => Promise<CheckoutResult> };

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeClient;
  }
}
let sdkPromise: Promise<void> | null = null;

function loadCashfreeSdk() {
  if (window.Cashfree) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => window.Cashfree ? resolve() : reject(new Error("Cashfree checkout did not load."));
    script.onerror = () => reject(new Error("Cashfree checkout could not be loaded."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function openCashfreeCheckout(paymentSessionId: string, mode: "sandbox" | "production") {
  await loadCashfreeSdk();
  if (!window.Cashfree) throw new Error("Cashfree checkout is unavailable.");
  return window.Cashfree({ mode }).checkout({ paymentSessionId, redirectTarget: "_self" });
}
