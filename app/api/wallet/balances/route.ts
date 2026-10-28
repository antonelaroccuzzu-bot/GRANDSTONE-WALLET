import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!token || !url || !anonKey) {
    return NextResponse.json({ error: "Sign in to view your wallet balances." }, { status: 401 });
  }

  try {
    const base = url.replace(/\/$/, "");
    const response = await fetch(`${base}/rest/v1/wallet_accounts?select=id,asset,network,available_balance,locked_balance,updated_at&order=asset.asc`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });
    }
    if (!response.ok) {
      return NextResponse.json({
        error: response.status === 404 || response.status === 400
          ? "Wallet ledger is not installed yet. Apply the Supabase migration from supabase/migrations/20261028_wallet_ledger.sql."
          : "Could not load wallet balances."
      }, { status: response.status === 404 || response.status === 400 ? 503 : 502 });
    }

    const rows = await response.json();
    return NextResponse.json({
      balances: Array.isArray(rows) ? rows : [],
      ledgerReady: true,
      note: "Balances are read from the account ledger. Deposits are not credited until a verified chain monitor is configured."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Wallet balance service is temporarily unavailable." }, { status: 502 });
  }
}
