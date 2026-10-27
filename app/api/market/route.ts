import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedSymbols = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "TRXUSDT", "LTCUSDT", "BCHUSDT", "SUIUSDT", "TONUSDT", "SHIBUSDT", "PEPEUSDT", "NEARUSDT", "APTUSDT", "ETCUSDT"]);
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

const coinbaseProducts: Record<string, string> = {
  BTCUSDT: "BTC-USDT", ETHUSDT: "ETH-USDT", SOLUSDT: "SOL-USDT",
  XRPUSDT: "XRP-USDT", DOGEUSDT: "DOGE-USDT", ADAUSDT: "ADA-USDT", AVAXUSDT: "AVAX-USDT",\n  LINKUSDT: "LINK-USDT", DOTUSDT: "DOT-USDT", TRXUSDT: "TRX-USDT", LTCUSDT: "LTC-USDT",\n  BCHUSDT: "BCH-USDT", SHIBUSDT: "SHIB-USDT", NEARUSDT: "NEAR-USDT", ETCUSDT: "ETC-USDT"
};
const candleSeconds: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

async function fromCoinbase(symbol: string, interval: string) {
  const product = coinbaseProducts[symbol];
  if (!product) throw new Error("Coinbase does not list this pair");
  const base = "https://api.exchange.coinbase.com/products/" + product;
  const [ticker, stats, candleRows, bookData] = await Promise.all([
    getJson(base + "/ticker"),
    getJson(base + "/stats"),
    getJson(base + "/candles?granularity=" + candleSeconds[interval]),
    getJson(base + "/book?level=2")
  ]);
  if (!ticker?.price || !Array.isArray(candleRows) || !Array.isArray(bookData?.bids) || !Array.isArray(bookData?.asks)) {
    throw new Error("Coinbase returned incomplete market data");
  }
  const last = Number(ticker.price);
  const open = Number(stats.open);
  const tickers = [{
    symbol, lastPrice: String(last),
    priceChangePercent: open ? String(((last - open) / open) * 100) : "0",
    quoteVolume: String(stats.volume || "0"),
    highPrice: String(stats.high || last),
    lowPrice: String(stats.low || last)
  }];
  const candles = candleRows.slice(0, 64).reverse().map((c: number[]) => [
    c[0] * 1000, String(c[3]), String(c[2]), String(c[1]), String(c[4]), String(c[5]),
    c[0] * 1000, String(c[5]), 0, "0", "0", "0"
  ]);
  const book = {
    bids: bookData.bids.slice(0, 10).map((level: string[]) => [level[0], level[1]]),
    asks: bookData.asks.slice(0, 10).map((level: string[]) => [level[0], level[1]])
  };
  if (!candles.length || !book.bids.length || !book.asks.length) throw new Error("Coinbase returned empty chart or order book");
  return { tickers, candles, book, source: "Coinbase Exchange public API" };
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

  try {
    const market = await fromCoinbase(symbol, interval);
    return NextResponse.json({ ...market, updatedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    failures.push("Coinbase: " + (error instanceof Error ? error.message : "request failed"));
  }

  console.error("Grandstone market providers failed:", failures);
  return NextResponse.json(
    { error: "Live market data is temporarily unavailable from the configured providers.", details: failures },
    { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
