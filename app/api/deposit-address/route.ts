import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEPOSIT_ASSETS: Record<string, { network: string; chainType: string; addressPattern: RegExp }> = {
  BTC: { network: "Bitcoin (SegWit)", chainType: "bitcoin-segwit", addressPattern: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/ },
  ETH: { network: "Ethereum", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  SOL: { network: "Solana", chainType: "solana", addressPattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ },
  BNB: { network: "BNB Smart Chain (BEP-20)", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  AVAX: { network: "Avalanche C-Chain", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  LINK: { network: "Ethereum (ERC-20)", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  TRX: { network: "TRON", chainType: "tron", addressPattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/ },
  SUI: { network: "Sui", chainType: "sui", addressPattern: /^0x[a-fA-F0-9]{64}$/ },
  TON: { network: "TON", chainType: "ton", addressPattern: /^(EQ|UQ)[A-Za-z0-9_-]{46,}$/ },
  SHIB: { network: "Ethereum (ERC-20)", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  PEPE: { network: "Ethereum (ERC-20)", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  NEAR: { network: "NEAR", chainType: "near", addressPattern: /^[a-z0-9_-]+\.(near|testnet)$/ },
  APT: { network: "Aptos", chainType: "aptos", addressPattern: /^0x[a-fA-F0-9]{64}$/ },
  ETC: { network: "Ethereum Classic", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  USDT: { network: "Ethereum (ERC-20)", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ },
  USDC: { network: "Ethereum (ERC-20)", chainType: "ethereum", addressPattern: /^0x[a-fA-F0-9]{40}$/ }
};

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
    cache: "no-store", signal: AbortSignal.timeout(8000)
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
    ...init, cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId, "Content-Type": "application/json", ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateCustomer(request);
    if (!userId) return errorResponse("Sign in again to create your deposit address.", 401);
    const body = await request.json().catch(() => ({}));
    const asset = typeof body.asset === "string" ? body.asset.toUpperCase() : "";
    const config = DEPOSIT_ASSETS[asset];
    if (!config) return errorResponse("A verified native-chain wallet integration is not enabled for this asset yet. No address was created.", 400);

    // Every asset receives its own wallet, even when two assets use the same underlying chain.
    const externalId = `gs_${userId.replace(/-/g, "")}_${asset.toLowerCase()}_${config.chainType}`;
    const walletPath = `/wallets/ext_wal_${externalId}`;
    const existing = await privyRequest(walletPath, { method: "GET" });
    if (existing.response.ok) {
      const wallet = existing.payload?.data ?? existing.payload;
      if (typeof wallet?.address === "string" && typeof wallet?.id === "string" && config.addressPattern.test(wallet.address)) {
        return NextResponse.json({ asset, network: config.network, address: wallet.address, walletId: wallet.id, chainType: config.chainType, reused: true });
      }
      return errorResponse("The existing provider wallet did not return an address matching the selected network. No address was displayed.", 502);
    }
    if (existing.response.status !== 404) {
      const detail = existing.payload?.error?.message || existing.payload?.message;
      return errorResponse(detail || "Could not check your saved wallet with Privy.", 502);
    }

    const created = await privyRequest("/wallets", {
      method: "POST",
      body: JSON.stringify({ chain_type: config.chainType, external_id: externalId, display_name: `Grandstone ${asset} deposit wallet` })
    });
    if (!created.response.ok) {
      const retry = await privyRequest(walletPath, { method: "GET" });
      if (retry.response.ok) {
        const wallet = retry.payload?.data ?? retry.payload;
        if (typeof wallet?.address === "string" && typeof wallet?.id === "string" && config.addressPattern.test(wallet.address)) {
          return NextResponse.json({ asset, network: config.network, address: wallet.address, walletId: wallet.id, chainType: config.chainType, reused: true });
        }
      }
      const detail = created.payload?.error?.message || created.payload?.message;
      return errorResponse(detail || `Privy could not create a ${asset} wallet. Confirm this chain type is enabled for your Privy app.`, 502);
    }
    const wallet = created.payload?.data ?? created.payload;
    if (typeof wallet?.address !== "string" || typeof wallet?.id !== "string" || !config.addressPattern.test(wallet.address)) {
      return errorResponse("The provider response did not match the selected network address format. No address was displayed.", 502);
    }
    return NextResponse.json({ asset, network: config.network, address: wallet.address, walletId: wallet.id, chainType: config.chainType, reused: false });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Wallet service request failed.", 502);
  }
}
