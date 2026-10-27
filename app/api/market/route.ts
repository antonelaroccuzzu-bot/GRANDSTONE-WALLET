import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedSymbols = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"]);
const allowedIntervals = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const hosts = ["https://api.binance.com", "https://api1.binance.com", "https://api2.binance.com"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = searchParams.get("interval") || "15m";
  if (!allowedSymbols.has(symbol) || !allowedIntervals.has(interval)) {
    return NextResponse.json({ error: "Unsupported market pair or interval." }, { status: 400 });
  }

  let lastError: unknown;
  for (const host of hosts) {
    try {
      const paths = [
        "/api/v3/ticker/24hr",
        "/api/v3/klines?symbol=" + encodeURIComponent(symbol) + "&interval=" + encodeURIComponent(interval) + "&limit=64",
        "/api/v3/depth?symbol=" + encodeURIComponent(symbol) + "&limit=10"
      ];
      const responses = await Promise.all(paths.map(path => fetch(host + path, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" }
      })));
      if (responses.some(response => !response.ok)) {
        throw new Error("Market provider returned HTTP " + responses.find(response => !response.ok)?.status);
      }
      const [tickers, candles, book] = await Promise.all(responses.map(response => response.json()));
      if (!Array.isArray(tickers) || !Array.isArray(candles) || !Array.isArray(book?.bids) || !Array.isArray(book?.asks)) {
        throw new Error("Market provider returned unexpected data.");
      }
      return NextResponse.json(
        { tickers, candles, book, source: "Binance public spot API", updatedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Grandstone server market proxy failed:", lastError);
  return NextResponse.json({ error: "Market provider is unreachable. Please retry shortly." }, { status: 502 });
}
