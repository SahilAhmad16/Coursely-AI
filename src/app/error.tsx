"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Coursely AI] Page error", error);
  }, [error]);

  return <main className="grid min-h-[70vh] place-items-center bg-slate-100 p-6"><section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm"><p className="text-sm font-bold uppercase tracking-wider text-rose-700">Something went wrong</p><h1 className="mt-2 text-3xl font-black">This page could not be loaded.</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your account and payment information have not been changed. Try loading the page again, or open the help centre if the problem continues.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={reset} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Try again</button><a href="/support" className="rounded-xl border border-slate-300 px-5 py-3 font-bold">Help centre</a></div></section></main>;
}
