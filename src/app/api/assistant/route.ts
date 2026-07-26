import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { answerHelpQuestion } from "@/lib/help-knowledge";

export const runtime = "nodejs";

const HELP_RATE_LIMIT = 12;
const HELP_RATE_WINDOW_MS = 15 * 60 * 1000;
const helpRequestWindows = new Map<string, { startedAt: number; count: number }>();

export async function POST(request: Request) {
  let message = "";
  try {
    const body = await request.json() as { message?: unknown };
    message = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  if (!message || message.length > 1000) return NextResponse.json({ error: "Write a question between 1 and 1,000 characters." }, { status: 400 });
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const rateKey = createHash("sha256").update(clientAddress).digest("hex");
  if (!allowHelpRequest(rateKey)) return NextResponse.json({ error: "Too many help requests. Please wait a few minutes and try again." }, { status: 429 });
  return NextResponse.json({ ...answerHelpQuestion(message), mode: "free-knowledge" });
}

function allowHelpRequest(rateKey: string) {
  const now = Date.now();
  const window = helpRequestWindows.get(rateKey);
  if (!window || now - window.startedAt >= HELP_RATE_WINDOW_MS) {
    helpRequestWindows.set(rateKey, { startedAt: now, count: 1 });
    return true;
  }
  if (window.count >= HELP_RATE_LIMIT) return false;
  window.count += 1;
  return true;
}
