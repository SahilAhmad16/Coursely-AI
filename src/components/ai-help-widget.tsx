"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { initialHelpSuggestions } from "@/lib/help-knowledge";

type ChatMessage = { role: "user" | "assistant"; text: string; href?: string; linkLabel?: string };

export function AiHelpWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "Hi! I can help with Coursely AI accounts, selling, seller plans, services, affiliate products, payments, and support." },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(initialHelpSuggestions());
  const [question, setQuestion] = useState("");
  const [waiting, setWaiting] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waiting]);

  async function askText(rawText: string) {
    const text = rawText.trim();
    if (!text || waiting) return;
    setQuestion("");
    setSuggestions([]);
    setMessages((current) => [...current, { role: "user", text }]);
    setWaiting(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json() as { reply?: string; error?: string; suggestions?: string[]; href?: string; linkLabel?: string };
      setMessages((current) => [...current, { role: "assistant", text: data.reply ?? data.error ?? "I could not answer that question right now.", href: data.href, linkLabel: data.linkLabel }]);
      setSuggestions(data.suggestions ?? initialHelpSuggestions());
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "I could not connect to the help service. Please try again.", href: "/support", linkLabel: "Open Help Centre" }]);
      setSuggestions(initialHelpSuggestions());
    } finally {
      setWaiting(false);
    }
  }

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askText(question);
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50">
      {open && (
        <section className="pointer-events-auto mb-3 flex h-[30rem] w-[min(24rem,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <div className="bg-slate-950 px-5 py-4 text-white">
            <p className="font-black">Coursely Smart Help</p>
            <p className="mt-1 text-xs text-slate-300">Instant answers about using the marketplace</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-emerald-600 text-white" : "bg-white text-slate-700 shadow-sm"}`}>
                <p>{message.text}</p>
                {message.role === "assistant" && message.href && <Link href={message.href} className="mt-2 inline-block font-bold text-emerald-700 underline decoration-emerald-200 underline-offset-4">{message.linkLabel ?? "Open page"} →</Link>}
              </div>
            ))}
            {waiting && <p className="w-fit rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">Finding an answer...</p>}
            {!waiting && suggestions.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void askText(suggestion)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-left text-xs font-bold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100">{suggestion}</button>)}</div>}
            <div ref={messageEndRef} />
          </div>
          <form onSubmit={ask} className="flex gap-2 border-t border-slate-200 bg-white p-3">
            <label className="sr-only" htmlFor="coursely-help-question">Ask Coursely AI a question</label>
            <input id="coursely-help-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} autoComplete="off" placeholder="Type your question..." className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={waiting} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Send</button>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto ml-auto grid size-14 place-items-center rounded-full bg-slate-950 text-xl text-white shadow-xl shadow-slate-900/30 transition hover:scale-105"
        aria-label={open ? "Close Coursely AI help" : "Open Coursely AI help"}
        aria-expanded={open}
      >
        {open ? "×" : "✦"}
      </button>
    </div>
  );
}
