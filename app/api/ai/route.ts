import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_MESSAGE = 4000;
const allowedRoles = new Set(["user", "assistant"]);

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!token || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Sign in to use Grandstone AI." }, { status: 401 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "AI provider is not configured. Add OPENROUTER_API_KEY to Vercel server environment variables." }, { status: 503 });
  }

  try {
    const auth = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + token },
      cache: "no-store",
      signal: AbortSignal.timeout(7000)
    });
    if (!auth.ok) return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });

    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (!messages.length || messages.length > 12) {
      return NextResponse.json({ error: "Send between 1 and 12 recent messages." }, { status: 400 });
    }
    const safeMessages = messages.map((m: { role?: unknown; content?: unknown }) => {
      if (typeof m?.role !== "string" || !allowedRoles.has(m.role) || typeof m.content !== "string") {
        throw new Error("Invalid message format.");
      }
      const content = m.content.trim();
      if (!content || content.length > MAX_MESSAGE) throw new Error("Each message must contain 1–4000 characters.");
      return { role: m.role, content };
    });

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://grandstone-wallet.vercel.app",
        "X-Title": "Grandstone Wallet"
      },
      body: JSON.stringify({
        model: process.env.GRANDSTONE_AI_MODEL || "openrouter/auto",
        messages: [
          {
            role: "system",
            content: "You are Grandstone AI, an informational assistant inside a cryptocurrency wallet. Be concise and factual. Never claim to place trades, transfer funds, verify a wallet, or execute transactions. Do not guarantee profits or give personalized financial advice. Explain uncertainty, distinguish current market data from forecasts, warn about volatility and scams, and never ask for passwords, one-time codes, seed phrases, or private keys. If asked for live prices, say that this chat does not independently verify live prices unless supplied in the conversation."
          },
          ...safeMessages
        ],
        temperature: 0.2,
        max_tokens: 700
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000)
    });

    const result = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json({ error: upstream.status === 429 ? "AI provider is busy. Try again shortly." : "AI provider request failed." }, { status: upstream.status === 429 ? 429 : 502 });
    }
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return NextResponse.json({ error: "AI provider returned no answer." }, { status: 502 });
    }
    return NextResponse.json({ reply: reply.trim(), model: result?.model || process.env.GRANDSTONE_AI_MODEL || "openrouter/auto" }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed.";
    const status = message.startsWith("Invalid message") || message.startsWith("Each message") ? 400 : 502;
    return NextResponse.json({ error: status === 400 ? message : "Grandstone AI is temporarily unavailable." }, { status });
  }
}
