import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedSymbols = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"]);
const allowedIntervals = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const binanceHosts = ["https://api.binance.com", "https://api1.binance.com", "https://api2.binance.com"];
const bybitIntervals: Record<string, string> = { "1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };

async function getJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("Provider returned HTTP " + response.status);
  return response.json();
}

async function fromBinance(symbol: string, interval: string) {
  let lastError: unknown;
  for (const host of binanceHosts) {
    try {
      const paths = [
        "/api/v3/ticker/24hr",
        "/api/v3/klines?symbol=" + encodeURIComponent(symbol) + "&interval=" + encodeURIComponent(interval) + "&limit=64",
        "/api/v3/depth?symbol=" + encodeURIComponent(symbol) + "&limit=10"
      ];
      const [tickers, candles, book] = await Promise.all(paths.map(path => getJson(host + path)));
      if (!Array.isArray(tickers) || !Array.isArray(candles) || !Array.isArray(book?.bids) || !Array.isArray(book?.asks)) {
        throw new Error("Unexpected Binance response");
      }
      return { tickers: tickers.filter((ticker: { symbol?: string }) => allowedSymbols.has(ticker.symbol || "")), candles, book, source: "Binance public spot API" };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Binance unavailable");
}

async function fromBybit(symbol: string, interval: string) {
  const base = "https://api.bybit.com/v5/market";
  const [tickerData, candleData, bookData] = await Promise.all([
    getJson(base + "/tickers?category=spot"),
    getJson(base + "/kline?category=spot&symbol=" + encodeURIComponent(symbol) + "&interval=" + encodeURIComponent(bybitIntervals[interval]) + "&limit=64"),
    getJson(base + "/orderbook?category=spot&symbol=" + encodeURIComponent(symbol) + "&limit=10")
  ]);
  if (tickerData.retCode !== 0 || candleData.retCode !== 0 || bookData.retCode !== 0) {
    throw new Error("Bybit market API returned an error");
  }
  const tickers = (tickerData.result?.list || [])
    .filter((t: { symbol?: string }) => allowedSymbols.has(t.symbol || ""))
    .map((t: { symbol: string; lastPrice: string; price24hPcnt: string; turnover24h: string; highPrice24h: string; lowPrice24h: string }) => ({
      symbol: t.symbol,
      lastPrice: t.lastPrice,
      priceChangePercent: (Number(t.price24hPcnt) * 100).toString(),
      quoteVolume: t.turnover24h,
      highPrice: t.highPrice24h,
      lowPrice: t.lowPrice24h
    }));
  const candles = (candleData.result?.list || []).slice().reverse().map((c: string[]) => [
    Number(c[0]), c[1], c[2], c[3], c[4], c[5], Number(c[0]), c[6], 0, "0", "0", "0"
  ]);
  const book = {
    bids: (bookData.result?.b || []).map((level: string[]) => [level[0], level[1]]),
    asks: (bookData.result?.a || []).map((level: string[]) => [level[0], level[1]])
  };
  if (!tickers.length || !candles.length || !book.bids.length || !book.asks.length) {
    throw new Error("Bybit returned incomplete market data");
  }
  return { tickers, candles, book, source: "Bybit public spot API" };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = searchParams.get("interval") || "15m";
  if (!allowedSymbols.has(symbol) || !allowedIntervals.has(interval)) {
    return NextResponse.json({ error: "Unsupported market pair or interval." }, { status: 400 });
  }

  const failures: string[] = [];
  try {
    const market = await fromBinance(symbol, interval);
    return NextResponse.json({ ...market, updatedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    failures.push("Binance: " + (error instanceof Error ? error.message : "request failed"));
  }

  try {
    const market = await fromBybit(symbol, interval);
    return NextResponse.json({ ...market, updatedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    failures.push("Bybit: " + (error instanceof Error ? error.message : "request failed"));
  }

  console.error("Grandstone market providers failed:", failures);
  return NextResponse.json(
    { error: "Live market data is temporarily unavailable from the configured providers.", details: failures },
    { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
