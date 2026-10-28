import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authenticateCustomer(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !supabaseKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === "string" ? user.id as string : null;
}

async function privyRequest(path: string, init?: RequestInit) {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Privy wallet service is not configured. Check PRIVY_APP_ID and PRIVY_APP_SECRET in Vercel.");
  const response = await fetch(`https://api.privy.io/v1${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateCustomer(request);
    if (!userId) return errorResponse("Sign in again to create your deposit address.", 401);

    // Stable, per-account external ID makes address creation repeatable across logins.
    const externalId = `gs_${userId.replace(/-/g, "")}`;
    const walletPath = `/wallets/ext_wal_${externalId}`;
    const existing = await privyRequest(walletPath, { method: "GET" });

    if (existing.response.ok) {
      const wallet = existing.payload?.data ?? existing.payload;
      if (wallet?.address && wallet?.id) {
        return NextResponse.json({ address: wallet.address, walletId: wallet.id, chainType: wallet.chain_type || "ethereum", reused: true });
      }
      return errorResponse("Privy returned a wallet without a usable address. No address was displayed.", 502);
    }

    if (existing.response.status !== 404) {
      const detail = existing.payload?.error?.message || existing.payload?.message;
      return errorResponse(detail || "Could not check your existing Privy wallet.", 502);
    }

    const created = await privyRequest("/wallets", {
      method: "POST",
      body: JSON.stringify({
        chain_type: "ethereum",
        external_id: externalId,
        display_name: "Grandstone customer wallet"
      })
    });

    if (!created.response.ok) {
      // A concurrent request may have created the same stable wallet first; re-read it.
      const retry = await privyRequest(walletPath, { method: "GET" });
      if (retry.response.ok) {
        const wallet = retry.payload?.data ?? retry.payload;
        if (wallet?.address && wallet?.id) {
          return NextResponse.json({ address: wallet.address, walletId: wallet.id, chainType: wallet.chain_type || "ethereum", reused: true });
        }
      }
      const detail = created.payload?.error?.message || created.payload?.message;
      return errorResponse(detail || "Privy could not create the wallet. Check wallet permissions in the Privy dashboard.", 502);
    }

    const wallet = created.payload?.data ?? created.payload;
    if (typeof wallet?.address !== "string" || typeof wallet?.id !== "string") {
      return errorResponse("Privy did not return a usable wallet address. No address was displayed.", 502);
    }

    return NextResponse.json({ address: wallet.address, walletId: wallet.id, chainType: wallet.chain_type || "ethereum", reused: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet service request failed.";
    return errorResponse(message, 502);
  }
}
