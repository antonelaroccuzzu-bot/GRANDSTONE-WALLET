"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Bot, CandlestickChart, ChevronDown, Clock3, Coins, LayoutDashboard, Menu, Search, Settings, ShieldAlert, ShieldCheck, Wallet, X, Zap } from "lucide-react";

type Ticker = { symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string; highPrice: string; lowPrice: string };
type Candle = [number, string, string, string, string, string, number, string, number, string, string, string];
type Book = { bids: [string, string][]; asks: [string, string][] };
const pairs = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
const money = (n: number, digits = 2) => Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";

export default function Home() {
  const [section, setSection] = useState("Trade");
  const [pair, setPair] = useState("BTCUSDT");
  const [interval, setInterval] = useState("15m");
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [book, setBook] = useState<Book>({ bids: [], asks: [] });
  const [live, setLive] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [tab, setTab] = useState("Open Orders");
  const [side, setSide] = useState("Buy");
  const [orderType, setOrderType] = useState("Limit");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [guardianEnabled, setGuardianEnabled] = useState(true);
  const activeTicker = tickers.find(t => t.symbol === pair);
  const last = Number(activeTicker?.lastPrice || 0);
  const change = Number(activeTicker?.priceChangePercent || 0);
  const total = Number(quantity || 0) * (orderType === "Market" ? last : Number(price || last));

  const loadMarket = useCallback(async () => {
    try {
      const results = await Promise.all([
        fetch("https://api.binance.com/api/v3/ticker/24hr", { cache: "no-store" }),
        fetch("https://api.binance.com/api/v3/klines?symbol=" + pair + "&interval=" + interval + "&limit=64", { cache: "no-store" }),
        fetch("https://api.binance.com/api/v3/depth?symbol=" + pair + "&limit=10", { cache: "no-store" })
      ]);
      if (results.some(r => !r.ok)) throw new Error("Market feed unavailable");
      const data = await Promise.all(results.map(r => r.json()));
      setTickers((data[0] as Ticker[]).filter(t => pairs.includes(t.symbol)));
      setCandles(data[1] as Candle[]);
      setBook(data[2] as Book);
      setLive(true);
      setMarketError("");
    } catch {
      setLive(false);
      setMarketError("Live market feed unavailable. Check connection and retry.");
    }
  }, [pair, interval]);

  useEffect(() => {
    loadMarket();
    const timer = window.setInterval(loadMarket, 15000);
    return () => window.clearInterval(timer);
  }, [loadMarket]);

  useEffect(() => { if (activeTicker && !price) setPrice(activeTicker.lastPrice); }, [activeTicker, price]);

  const chart = useMemo(() => {
    if (!candles.length) return null;
    const values = candles.map(c => ({ low: Number(c[3]), high: Number(c[2]), open: Number(c[1]), close: Number(c[4]) }));
    const min = Math.min(...values.map(v => v.low)) * .999;
    const max = Math.max(...values.map(v => v.high)) * 1.001;
    const range = max - min || 1;
    const y = (v: number) => 260 - ((v - min) / range) * 250;
    const step = 900 / values.length;
    return values.map((v, i) => <g key={i} stroke={v.close >= v.open ? "#16b887" : "#f05268"} strokeWidth="1">
      <line x1={i * step + step / 2} x2={i * step + step / 2} y1={y(v.high)} y2={y(v.low)} />
      <rect x={i * step + step * .2} y={Math.min(y(v.open), y(v.close))} width={Math.max(2, step * .6)} height={Math.max(1, Math.abs(y(v.open) - y(v.close)))} fill={v.close >= v.open ? "#16b887" : "#f05268"} stroke="none" />
    </g>);
  }, [candles]);

  const nav = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Trade", icon: CandlestickChart },
    { label: "Markets", icon: Activity },
    { label: "Assets", icon: Wallet },
    { label: "Trading bots", icon: Bot },
    { label: "AI Guardian", icon: ShieldCheck }
  ];
  const tell = (s: string) => setNotice(s);
  const submitOrder = () => tell("Order not sent. Public market data is live, but private exchange authentication, order signing and server-side risk checks are not connected. No trade was placed.");

  return <main className="exchange-app">
    <header className="exchange-topbar">
      <button className="exchange-brand" onClick={() => setSection("Overview")}><span className="brand-mark"><Coins size={21}/></span><span>GRANDSTONE<small>WALLET & EXCHANGE</small></span></button>
      <nav className="desktop-nav">{nav.map(n => <button key={n.label} className={section === n.label ? "nav-item active" : "nav-item"} onClick={() => setSection(n.label)}>{n.label}</button>)}</nav>
      <div className="header-tools"><span className={live ? "feed-status online" : "feed-status"}><i/>{live ? "Live market" : "Market offline"}</span><button className="header-icon" aria-label="Notifications" onClick={() => tell("Notifications require an authenticated account.")}><Bell size={18}/></button><button className="connect-button" onClick={() => tell("Wallet connection is not configured yet. No wallet has been connected.")}><Wallet size={16}/> Connect wallet</button><button className="mobile-menu-button" aria-label="Menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu/></button></div>
    </header>
    {mobileMenu && <nav className="mobile-nav">{nav.map(n => <button key={n.label} onClick={() => {setSection(n.label);setMobileMenu(false);}}>{n.label}</button>)}</nav>}
    {notice && <div className="exchange-notice" role="status"><ShieldAlert size={18}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}

    {section === "Trade" || section === "Markets" ? <div className="trading-layout">
      <aside className="market-sidebar">
        <div className="market-side-head"><strong>Markets</strong><button aria-label="Search markets" onClick={() => tell("Market search is coming with the full market directory.")}><Search size={16}/></button></div>
        <div className="market-filter"><button className="selected">Spot</button><button onClick={() => tell("Derivatives need a supported exchange provider and product-specific risk controls.")}>Derivatives</button></div>
        <div className="pair-head"><span>Pair</span><span>Last price</span><span>24h</span></div>
        {pairs.map(p => { const t = tickers.find(x => x.symbol === p); return <button className={pair === p ? "pair-row chosen" : "pair-row"} key={p} onClick={() => {setPair(p);setPrice("");}}><span className="pair-name"><b>{p.replace("USDT", "")}</b><small>/USDT</small></span><span className="pair-price">{t ? money(Number(t.lastPrice), Number(t.lastPrice) < 1 ? 5 : 2) : "—"}</span><span className={Number(t?.priceChangePercent || 0) >= 0 ? "up" : "down"}>{t ? Number(t.priceChangePercent).toFixed(2) + "%" : "—"}</span></button>; })}
        <div className="market-sidebar-note"><Activity size={14}/><span>Public spot feed · auto-refresh</span></div>
      </aside>

      <section className="trade-main">
        <div className="pair-overview"><div className="pair-title"><div className="coin-token">{pair.startsWith("BTC") ? "₿" : pair.startsWith("ETH") ? "◆" : pair.startsWith("SOL") ? "◎" : pair.startsWith("BNB") ? "◆" : pair.startsWith("XRP") ? "✕" : "Ð"}</div><div><h1>{pair.replace("USDT", " / USDT")} <ChevronDown size={16}/></h1><small>Spot market</small></div></div>
          <div className="ticker-stat main-stat"><small>Last price</small><strong>{last ? "$" + money(last, last < 1 ? 5 : 2) : "—"}</strong><span className={change >= 0 ? "up" : "down"}>{activeTicker ? (change >= 0 ? "+" : "") + change.toFixed(2) + "%" : "Loading"}</span></div>
          <div className="ticker-stat"><small>24h high</small><strong>{activeTicker ? "$" + money(Number(activeTicker.highPrice)) : "—"}</strong></div><div className="ticker-stat"><small>24h low</small><strong>{activeTicker ? "$" + money(Number(activeTicker.lowPrice)) : "—"}</strong></div><div className="ticker-stat volume-stat"><small>24h volume (USDT)</small><strong>{activeTicker ? money(Number(activeTicker.quoteVolume), 0) : "—"}</strong></div>
        </div>
        <div className="chart-panel">
          <div className="chart-toolbar"><div className="chart-tabs"><button className="active">Candles</button><button onClick={() => tell("TradingView embed is not configured. Current chart uses live public candles.")}>TradingView</button><button onClick={() => tell("Depth is displayed in the order book on the right.")}>Depth</button></div><div className="intervals">{["1m","5m","15m","1h","4h","1d"].map(i => <button key={i} className={interval === i ? "selected" : ""} onClick={() => setInterval(i)}>{i}</button>)}</div></div>
          <div className="chart-legend"><strong>{pair.replace("USDT", "/USDT")}</strong><span>O {candles.length ? money(Number(candles[candles.length-1][1])) : "—"}</span><span>H {candles.length ? money(Number(candles[candles.length-1][2])) : "—"}</span><span>L {candles.length ? money(Number(candles[candles.length-1][3])) : "—"}</span><span>C {candles.length ? money(Number(candles[candles.length-1][4])) : "—"}</span></div>
          <div className="chart-canvas">{candles.length ? <svg viewBox="0 0 900 270" preserveAspectRatio="none" role="img" aria-label={pair + " live candlestick chart"}><defs><pattern id="grid" width="90" height="54" patternUnits="userSpaceOnUse"><path d="M 90 0 L 0 0 0 54" fill="none" stroke="#28313e" strokeWidth=".7"/></pattern></defs><rect width="900" height="270" fill="url(#grid)"/>{chart}</svg> : <div className="chart-loading">{marketError || "Loading live candles…"}</div>}</div>
          <div className="chart-footer"><span><i className={live ? "live-dot" : "offline-dot"}/>{live ? "Public Binance market data · refreshes every 15 seconds" : "Market data disconnected"}</span><span>Public data only · no orders sent</span></div>
        </div>
        <div className="bottom-trade-panel"><div className="trade-tabs">{["Open Orders","Order History","Trade History","Assets"].map(t => <button key={t} className={tab === t ? "selected" : ""} onClick={() => setTab(t)}>{t}</button>)}</div><div className="empty-orders"><Clock3 size={21}/><strong>{tab}</strong><span>{tab === "Open Orders" ? "No connected exchange account. Your real orders will appear here after integration." : "Account data is not connected yet."}</span></div></div>
      </section>

      <aside className="order-sidebar">
        <div className="order-card"><div className="order-card-title"><h2>Spot trading</h2><button aria-label="Order settings" onClick={() => tell("Order preferences will be available after account setup.")}><Settings size={16}/></button></div>
          <div className="order-mode"><button className={side === "Buy" ? "buy-selected" : ""} onClick={() => setSide("Buy")}>Buy</button><button className={side === "Sell" ? "sell-selected" : ""} onClick={() => setSide("Sell")}>Sell</button></div>
          <div className="order-type">{["Limit","Market","Stop-limit"].map(t => <button key={t} className={orderType === t ? "selected" : ""} onClick={() => setOrderType(t)}>{t}</button>)}</div>
          {orderType !== "Market" && <label className="field-label">Price <span>USDT</span><div className="order-input"><input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder={last ? String(last) : "Price"}/><button onClick={() => setPrice(String(last))}>Last</button></div></label>}
          <label className="field-label">Amount <span>{pair.replace("USDT", "")}</span><div className="order-input"><input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00"/><button onClick={() => setQuantity("0.01")}>Set</button></div></label>
          <div className="amount-shortcuts">{["25%","50%","75%","100%"].map((v,i) => <button key={v} onClick={() => setQuantity(String((i+1)*0.0025))}>{v}</button>)}</div>
          <div className="order-summary"><span>Estimated total</span><strong>{total ? "$" + money(total) : "—"} <small>USDT</small></strong></div><div className="available-balance"><span>Available balance</span><strong>— USDT</strong></div>
          <button className={side === "Buy" ? "submit-order buy-order" : "submit-order sell-order"} onClick={submitOrder}>{side} {pair.replace("USDT", "")}</button>
          <div className="order-warning"><ShieldAlert size={15}/><span>Order execution is locked until secure account connection and risk checks are verified.</span></div>
        </div>
        <div className="orderbook-card"><div className="orderbook-head"><h2>Order book</h2><span>USDT</span></div><div className="book-columns"><span>Price</span><span>Amount</span><span>Total</span></div>
          {book.asks.slice(0,5).reverse().map((r,i) => <div className="book-row ask" key={"a"+i}><span>{money(Number(r[0]))}</span><span>{Number(r[1]).toFixed(4)}</span><span>{money(Number(r[0])*Number(r[1]))}</span></div>)}
          <div className={change >= 0 ? "book-mid up" : "book-mid down"}>{last ? "$"+money(last) : "—"} <small>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</small></div>
          {book.bids.slice(0,5).map((r,i) => <div className="book-row bid" key={"b"+i}><span>{money(Number(r[0]))}</span><span>{Number(r[1]).toFixed(4)}</span><span>{money(Number(r[0])*Number(r[1]))}</span></div>)}
        </div>
      </aside>
    </div> : <section className="feature-page"><div className="feature-title"><span className="eyebrow">GRANDSTONE PLATFORM</span><h1>{section}</h1><p>Your wallet, markets and AI-assisted trading workspace.</p></div>
      {section === "Overview" && <div className="feature-grid"><div className="feature-card portfolio-card"><span>Portfolio value</span><strong>$0.00</strong><small>No wallet connected. No funds are represented.</small><button className="feature-cta" onClick={() => tell("Wallet connection requires a configured wallet provider.")}>Connect wallet</button></div><div className="feature-card"><Wallet/><h2>Wallet</h2><p>Secure self-custody and account connections require a verified signing and recovery flow.</p><button onClick={() => setSection("Assets")}>Open assets</button></div><div className="feature-card"><CandlestickChart/><h2>Spot trading</h2><p>Live public market prices and an order-entry preview.</p><button onClick={() => setSection("Trade")}>Open terminal</button></div></div>}
      {section === "Assets" && <div className="feature-card"><Wallet/><h2>Assets & transfers</h2><p>Connect a supported wallet to load verified balances and transaction history. Deposits and withdrawals are not enabled yet.</p><button onClick={() => tell("No wallet provider is connected. No transfer has been made.")}>Connect wallet</button></div>}
      {section === "Trading bots" && <div className="feature-card"><Bot/><h2>Strategy bots</h2><p>Define entry rules, position sizing, stop-loss limits, maximum daily loss and Guardian approval. Bot execution stays disabled until a provider is securely connected.</p><div className="bot-setting"><span><strong>Bot execution</strong><small>Not connected · no orders can be placed</small></span><span className="disabled-badge">DISABLED</span></div></div>}
      {section === "AI Guardian" && <div className="feature-card"><ShieldCheck/><h2>Grandstone AI Trade Guardian</h2><p>Review volatility, order size, concentration, suspicious assets and your strategy rules before confirmation.</p><div className="bot-setting"><span><strong>Pre-trade review</strong><small>Risk rules must be enforced server-side before live orders.</small></span><button className={guardianEnabled ? "toggle on" : "toggle"} onClick={() => setGuardianEnabled(!guardianEnabled)}><i/></button></div><div className="guardian-rule"><ShieldAlert size={18}/><span>Hard security and compliance blocks cannot be overridden.</span></div></div>}
    </section>}
    <footer className="exchange-footer"><span>© 2026 GRANDSTONE WALLET</span><span><i className={live ? "live-dot" : "offline-dot"}/>{live ? "Public market data connected" : "Market feed unavailable"} · private trading not connected</span></footer>
  </main>;
}
