"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CustomerGate from "./CustomerGate";
import { supabase } from "../lib/supabase/client";
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Bot, CandlestickChart, ChevronDown, Clock3, Coins, Eye, LayoutDashboard, Menu, Search, Settings, ShieldAlert, ShieldCheck, Wallet, X, Zap } from "lucide-react";

type Ticker = { symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string; highPrice: string; lowPrice: string };
type Candle = [number, string, string, string, string, string, number, string, number, string, string, string];
type Book = { bids: [string, string][]; asks: [string, string][] };
const chainNames: Record<string, string> = { "0x1": "Ethereum", "0x89": "Polygon", "0xa4b1": "Arbitrum", "0xa": "Optimism", "0x2105": "Base", "0x38": "BNB Chain" };
const pairs = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "TRXUSDT", "LTCUSDT", "BCHUSDT", "SUIUSDT", "TONUSDT", "SHIBUSDT", "PEPEUSDT", "NEARUSDT", "APTUSDT", "ETCUSDT"];
const money = (n: number, digits = 2) => Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";

function WalletDashboard() {
  const [section, setSection] = useState("Overview");
  const [pair, setPair] = useState("BTCUSDT");
  const [interval, setInterval] = useState("15m");
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [book, setBook] = useState<Book>({ bids: [], asks: [] });
  const [live, setLive] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketSource, setMarketSource] = useState("");
  const [tab, setTab] = useState("Open Orders");
  const [side, setSide] = useState("Buy");
  const [orderType, setOrderType] = useState("Limit");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [guardianEnabled, setGuardianEnabled] = useState(true);
  // Wallet connection state only; the app never requests seed phrases or private keys.
  const [depositCoin, setDepositCoin] = useState("ETH");
  const [depositNetwork, setDepositNetwork] = useState("Ethereum (ERC-20)");
  const [depositAddress, setDepositAddress] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");
  async function generateDepositAddress() {
    if (!supabase) { setDepositError("Grandstone account service is not configured."); return; }
    setDepositLoading(true);
    setDepositError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your sign-in session expired. Sign in again to continue.");
      const response = await fetch("/api/deposit-address", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not create a deposit wallet.");
      if (typeof data.address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(data.address)) throw new Error("The wallet provider did not return a valid EVM address.");
      setDepositAddress(data.address);
    } catch (error) {
      setDepositError(error instanceof Error ? error.message : "Deposit wallet setup failed.");
    } finally { setDepositLoading(false); }
  }

  const activeTicker = tickers.find(t => t.symbol === pair);
  const last = Number(activeTicker?.lastPrice || 0);
  const change = Number(activeTicker?.priceChangePercent || 0);
  const total = Number(quantity || 0) * (orderType === "Market" ? last : Number(price || last));

  const loadMarket = useCallback(async () => {
    try {
      const response = await fetch("/api/market?symbol=" + encodeURIComponent(pair) + "&interval=" + encodeURIComponent(interval), {
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error([data?.error || "Market feed unavailable", ...(Array.isArray(data?.details) ? data.details : [])].join(" — "));
      if (!Array.isArray(data.tickers) || !Array.isArray(data.candles) || !Array.isArray(data.book?.bids)) {
        throw new Error("Market feed returned invalid data");
      }
      setTickers(previous => { const merged = new Map(previous.map(t => [t.symbol, t])); (data.tickers as Ticker[]).filter(t => pairs.includes(t.symbol)).forEach(t => merged.set(t.symbol, t)); return pairs.flatMap(symbol => merged.has(symbol) ? [merged.get(symbol)!] : []); });
      if (data.source) setMarketSource(data.source);
      setCandles(data.candles as Candle[]);
      setBook(data.book as Book);
      setLive(true);
      setMarketError("");
    } catch (error) {
      console.error("Grandstone market request failed:", error);
      setLive(false);
      setMarketError(error instanceof Error ? error.message : "Live market feed unavailable. Retrying automatically.");
    }
  }, [pair, interval]);

  useEffect(() => {
    loadMarket();
    const timer = window.setInterval(loadMarket, 15000);
    return () => window.clearInterval(timer);
  }, [loadMarket]);

  useEffect(() => {
    let cancelled = false;
    const loadTickers = async () => {
      try {
        const response = await fetch("/api/market?mode=tickers", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.tickers)) throw new Error(data?.error || "Ticker feed unavailable");
        if (cancelled) return;
        setTickers(previous => {
          const merged = new Map(previous.map(t => [t.symbol, t]));
          (data.tickers as Ticker[]).filter(t => pairs.includes(t.symbol) && Number(t.lastPrice) > 0).forEach(t => merged.set(t.symbol, t));
          return pairs.flatMap(symbol => merged.has(symbol) ? [merged.get(symbol)!] : []);
        });
        setMarketSource(data.source || "Public market feed");
      } catch (error) {
        if (!cancelled) console.error("Grandstone bulk ticker request failed:", error);
      }
    };
    loadTickers();
    const timer = window.setInterval(loadTickers, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

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

  // Keep the primary navigation simple; specialist workspaces live under More.
  const nav = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Trade", icon: CandlestickChart },
    { label: "Markets", icon: Activity },
    { label: "Assets", icon: Wallet },
    { label: "Convert", icon: ArrowLeftRight },
    { label: "More", icon: Menu }
  ];
  const tell = (s: string) => setNotice(s);
  const submitOrder = () => tell("Order not sent. Public market data is live, but private exchange authentication, order signing and server-side risk checks are not connected. No trade was placed.");

  return <main className="exchange-app">
    <header className="exchange-topbar">
      <button className="exchange-brand" onClick={() => setSection("Overview")}><span className="brand-mark"><Coins size={21}/></span><span>GRANDSTONE<small>WALLET & EXCHANGE</small></span></button>
      <nav className="desktop-nav">{nav.map(n => <button key={n.label} className={section === n.label ? "nav-item active" : "nav-item"} onClick={() => setSection(n.label)}>{n.label}</button>)}</nav>
      <div className="header-tools"><span className={live ? "feed-status online" : "feed-status"}><i/>{live ? "Live market" : "Market offline"}</span><button className="header-icon" aria-label="Notifications" onClick={() => tell("Notifications require an authenticated account.")}><Bell size={18}/></button><button className="mobile-menu-button" aria-label="Menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu/></button></div>
    </header>
    {mobileMenu && <nav className="mobile-nav">{nav.map(n => <button key={n.label} onClick={() => {setSection(n.label);setMobileMenu(false);}}>{n.label}</button>)}</nav>}
    {notice && <div className="exchange-notice" role="status"><ShieldAlert size={18}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}

    {section === "Trade" || section === "Markets" ? <div className="trading-layout">
      <aside className="market-sidebar">
        <div className="market-side-head"><strong>Markets</strong><button aria-label="Search markets" onClick={() => tell("Market search is coming with the full market directory.")}><Search size={16}/></button></div>
        <div className="market-filter"><button className="selected">Spot</button><button onClick={() => tell("Derivatives need a supported exchange provider and product-specific risk controls.")}>Derivatives</button></div>
        <div className="pair-head"><span>Pair</span><span>Last price</span><span>24h</span></div>
        {pairs.map(p => { const t = tickers.find(x => x.symbol === p); return <button className={pair === p ? "pair-row chosen" : "pair-row"} key={p} onClick={() => {setPair(p);setPrice("");}}><span className="pair-name"><b>{p.replace("USDT", "")}</b><small>/USDT</small></span><span className="pair-price">{t ? money(Number(t.lastPrice), Number(t.lastPrice) < 1 ? 5 : 2) : "—"}</span><span className={Number(t?.priceChangePercent || 0) >= 0 ? "up" : "down"}>{t ? Number(t.priceChangePercent).toFixed(2) + "%" : "—"}</span></button>; })}
        <div className="market-sidebar-note"><Activity size={14}/><span>{marketSource || "Public spot feed"} · auto-refresh</span></div>
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
      {section === "Overview" && <>
        <div className="mobile-home">
          <div className="mobile-home-header">
            <button className="mobile-profile-mark" onClick={() => tell("Your Grandstone account and security settings.")} aria-label="Account">G</button>
            <button className="mobile-search" onClick={() => setSection("Markets")}><Search size={20}/><span>Search markets and assets</span></button>
            <button className="mobile-header-action" aria-label="Market tools" onClick={() => setSection("Markets")}><Activity size={23}/></button>
            <button className="mobile-header-action" aria-label="Notifications" onClick={() => tell("Notifications require an authenticated notification service.")}><Bell size={23}/></button>
          </div>
          <div className="mobile-category-row">
            {["All","Stocks","Macro","Crypto","Earn"].map((item) => <button key={item} className={item === "All" ? "active" : ""} onClick={() => setSection(item === "All" ? "Overview" : item === "Crypto" ? "Assets" : item === "Earn" ? "Earn" : "Markets")}>{item}</button>)}
            <button className="mobile-category-menu" onClick={() => setSection("More")} aria-label="More categories"><Menu size={23}/></button>
          </div>
          <div className="mobile-balance-panel">
            <div className="mobile-balance-label">Total Assets <Eye size={16}/></div>
            <div className="mobile-balance-row"><div className="mobile-balance-amount">$0.00 <small>USD</small></div><button onClick={() => setSection("Deposit")}>Deposit <ArrowDownLeft size={18}/></button></div>
            <div className="mobile-pnl"><span>Today's P&amp;L</span><strong>— USD (—%)</strong></div>
            <div className="mobile-balance-note">Your verified wallet balance will appear here.</div>
          </div>
          <div className="mobile-shortcuts">
            <button onClick={() => setSection("Deposit")}><span><ArrowDownLeft/></span>Deposit</button>
            <button onClick={() => setSection("Convert")}><span><ArrowLeftRight/></span>Convert</button>
            <button onClick={() => setSection("Rewards Hub")}><span><Zap/></span>Rewards Hub</button>
            <button onClick={() => setSection("Demo Trading")}><span><Wallet/></span>Demo Trading</button>
            <button onClick={() => setSection("Earn")}><span><Coins/></span>Grandstone Earn</button>
            <button onClick={() => setSection("More")}><span><Menu/></span>More</button>
          </div>
          <button className="mobile-promo-card" onClick={() => setSection("P2P")}><span className="mobile-promo-icon"><Coins size={28}/></span><span><small>GRANDSTONE WALLET</small><strong>Explore digital assets and markets</strong><em>Public market prices update automatically.</em></span><ChevronDown size={18}/></button>
          <div className="mobile-market-heading"><h2>Market watch</h2><button onClick={() => setSection("Markets")}>View all <ChevronDown size={15}/></button></div>
          <div className="mobile-market-grid">
            {pairs.slice(0,4).map(market => {
              const t = tickers.find(item => item.symbol === market);
              const value = Number(t?.lastPrice || 0);
              const pct = Number(t?.priceChangePercent || 0);
              return <button key={market} onClick={() => {setPair(market);setPrice("");setSection("Trade");}}><strong>{market.replace("USDT","")} <ChevronDown size={13}/></strong><span>{t ? "$"+money(value,value < 1 ? 5 : 2) : "Loading price…"}</span><em className={pct >= 0 ? "up" : "down"}>{t ? (pct >= 0 ? "+" : "")+pct.toFixed(2)+"%" : "—"}</em></button>;
            })}
          </div>
          <div className="mobile-market-tabs"><button onClick={() => setSection("Markets")}>Favorites</button><button className="active" onClick={() => setSection("Markets")}>Spot</button><button onClick={() => tell("Futures require a supported derivatives provider and risk controls.")}>Futures</button><button onClick={() => setSection("Assets")}>Crypto assets</button></div>
          <nav className="mobile-bottom-nav" aria-label="Main navigation"><button className="active" onClick={() => setSection("Overview")}><LayoutDashboard/><span>Home</span></button><button onClick={() => setSection("Markets")}><Activity/><span>Markets</span></button><button onClick={() => setSection("Trade")}><CandlestickChart/><span>Trade</span></button><button onClick={() => setSection("More")}><Zap/><span>TradFi</span></button><button onClick={() => setSection("Assets")}><Wallet/><span>Assets</span></button></nav>
        </div>
        <div className="desktop-overview-content"><div className="overview-top-actions"><div className="overview-top-group"><button className="top-pill selected" onClick={() => setSection("Overview")}>All</button><button className="top-pill" onClick={() => setSection("Markets")}>Stocks</button><button className="top-pill" onClick={() => setSection("Markets")}>Macro</button><button className="top-pill" onClick={() => setSection("Assets")}>Crypto</button><button className="top-pill" onClick={() => setSection("Earn")}>Earn</button></div><div className="overview-top-group"><button className="top-pill" onClick={() => setSection("Deposit")}>Deposit</button><button className="top-pill" onClick={() => setSection("Convert")}>Convert</button><button className="top-pill" onClick={() => setSection("Rewards Hub")}>Reward Hub</button><button className="top-pill" onClick={() => setSection("Demo Trading")}>Demo Trading</button><button className="top-pill" onClick={() => setSection("Earn")}>Grandstone Earn</button><button className="top-pill" onClick={() => setSection("More")}>More</button></div></div><div className="overview-dashboard"><div className="feature-card overview-assets"><span>Total Assets</span><strong className="overview-total">$0.00 <small>USD</small></strong><p>Connect an account to show verified balances. No funds are connected.</p><div className="overview-pnl"><span>Today’s P&amp;L</span><strong>— USD (—%)</strong></div></div>
        <div className="feature-card" style={{gridColumn:"1 / -1"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div><h2>Live market overview</h2><p>Prices refresh automatically from public market providers. These are market prices, not your wallet balances.</p></div>
            <button onClick={() => setSection("Markets")}>View all markets</button>
          </div>
          <div className="bot-setting"><span><strong>Market feed</strong><small>{marketSource || (live ? "Public market feed connected" : "Connecting to public providers…")}</small></span><span className={live && tickers.length ? "disabled-badge" : "disabled-badge"}>{tickers.length ? tickers.length + " PAIRS" : "LOADING"}</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:12}}>
            {pairs.slice(0,8).map(market => {
              const t = tickers.find(item => item.symbol === market);
              const value = Number(t?.lastPrice || 0);
              const pct = Number(t?.priceChangePercent || 0);
              return <button key={market} onClick={() => {setPair(market);setPrice("");setSection("Trade");}} className="bot-setting" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:12,border:"1px solid var(--border, #2b3442)",borderRadius:12,textAlign:"left",cursor:"pointer"}}>
                <span><strong>{market.replace("USDT","")} <small style={{fontWeight:400,opacity:.65}}>/ USDT</small></strong><small style={{display:"block",marginTop:5}}>{t ? "$"+money(value,value < 1 ? 5 : 2) : "Waiting for price…"}</small></span>
                <strong className={pct >= 0 ? "up" : "down"}>{t ? (pct >= 0 ? "+" : "")+pct.toFixed(2)+"%" : "—"}</strong>
              </button>;
            })}
          </div>
          {marketError && <p role="status" style={{marginTop:10}}>Selected chart status: {marketError}</p>}
        </div><h2>Explore tools</h2><div className="feature-grid"><div className="feature-card"><Bot/><h2>Trading bots</h2><p>Strategy workspace and risk controls.</p><button onClick={() => setSection("Trading bots")}>Open bots</button></div><div className="feature-card"><ShieldCheck/><h2>AI Trade Guardian</h2><p>Review risk before trade confirmation.</p><button onClick={() => setSection("AI Guardian")}>Open Guardian</button></div><div className="feature-card"><ShieldAlert/><h2>Scam Scanner</h2><p>Security analysis workspace.</p><button onClick={() => setSection("Scam Scanner")}>Open scanner</button></div></div></div></div></>}
      {section === "Rewards Hub" && <div className="feature-grid"><div className="feature-card"><Zap/><h2>Rewards Hub</h2><p>Discover future campaigns, account missions and eligible platform rewards.</p><div className="bot-setting"><span><strong>Rewards status</strong><small>Rewards provider and account eligibility are not connected.</small></span><span className="disabled-badge">NOT LIVE</span></div><button onClick={() => tell("No reward has been earned or claimed. A verified rewards service is not connected.")}>Check rewards status</button></div></div>}
      {section === "Demo Trading" && <div className="feature-grid"><div className="feature-card"><Activity/><h2>Demo Trading</h2><p>Practice trading should use simulated balances and paper orders only, separate from real funds.</p><div className="bot-setting"><span><strong>Paper-trading engine</strong><small>Simulation engine is not connected yet.</small></span><span className="disabled-badge">NOT LIVE</span></div><button onClick={() => tell("Demo trading is not running yet. No paper or real order was placed.")}>Check demo status</button></div></div>}
      {section === "More" && <div className="feature-grid"><div className="feature-card more-tools-card"><Menu/><h2>All Grandstone tools</h2><p>Each option opens its own workspace. Features marked NOT LIVE need a provider connection before they can handle real funds or transactions.</p><div className="overview-shortcuts">
        <button onClick={() => setSection("Derivatives")}><CandlestickChart/><strong>Derivatives</strong><small>Futures and leverage</small></button>
        <button onClick={() => setSection("Copy Trading")}><Activity/><strong>Copy Trading</strong><small>Follow strategies</small></button>
        <button onClick={() => setSection("Trading bots")}><Bot/><strong>Trading bots</strong><small>Automated strategies</small></button>
        <button onClick={() => setSection("Earn")}><Coins/><strong>Earn</strong><small>Yield products</small></button>
        <button onClick={() => setSection("Rewards Hub")}><Zap/><strong>Rewards Hub</strong><small>Campaigns and rewards</small></button>
        <button onClick={() => setSection("Demo Trading")}><Activity/><strong>Demo Trading</strong><small>Practice with simulated funds</small></button>
        <button onClick={() => setSection("P2P")}><ArrowLeftRight/><strong>P2P</strong><small>Peer-to-peer marketplace</small></button>
        <button onClick={() => setSection("Web3")}><Wallet/><strong>Web3</strong><small>Wallet and chains</small></button>
        <button onClick={() => setSection("AI Assistant")}><Zap/><strong>AI Assistant</strong><small>Market explanations</small></button>
        <button onClick={() => setSection("AI Guardian")}><ShieldCheck/><strong>AI Guardian</strong><small>Pre-trade risk review</small></button>
        <button onClick={() => setSection("Scam Scanner")}><ShieldAlert/><strong>Scam Scanner</strong><small>Check suspicious links</small></button>
        <button onClick={() => setSection("Portfolio Manager")}><Activity/><strong>Portfolio Manager</strong><small>Allocation and risk</small></button>
        <button onClick={() => setSection("Transaction Intelligence")}><Search/><strong>Transaction Intelligence</strong><small>Transaction analysis</small></button>
        <button onClick={() => setSection("Alerts & Automation")}><Bell/><strong>Alerts & Automation</strong><small>Price and security alerts</small></button>
      </div></div></div>}
      {section === "Assets" && <div className="feature-grid">
        <div className="feature-card" style={{gridColumn:"1 / -1"}}>
          <h2>Grandstone Crypto Assets</h2>
          <p>Supported coins and live market prices. Wallet balances and deposit addresses will appear after Grandstone's own custody and account ledger are implemented and verified.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginTop:16}}>
            {[
              ["BTC","Bitcoin","BTCUSDT","₿"],["ETH","Ethereum","ETHUSDT","◆"],["SOL","Solana","SOLUSDT","◎"],["BNB","BNB","BNBUSDT","◆"],
              ["XRP","XRP","XRPUSDT","✕"],["DOGE","Dogecoin","DOGEUSDT","Ð"],["ADA","Cardano","ADAUSDT","₳"],["AVAX","Avalanche","AVAXUSDT","▲"],
              ["LINK","Chainlink","LINKUSDT","⬡"],["DOT","Polkadot","DOTUSDT","●"],["TRX","TRON","TRXUSDT","▲"],["LTC","Litecoin","LTCUSDT","Ł"],
              ["BCH","Bitcoin Cash","BCHUSDT","Ƀ"],["SUI","Sui","SUIUSDT","S"],["TON","Toncoin","TONUSDT","💎"],["SHIB","Shiba Inu","SHIBUSDT","🐕"],
              ["PEPE","Pepe","PEPEUSDT","🐸"],["NEAR","NEAR Protocol","NEARUSDT","N"],["APT","Aptos","APTUSDT","A"],["ETC","Ethereum Classic","ETCUSDT","Ξ"]
            ].map(([symbol,name,market,mark]) => {
              const t = tickers.find(x => x.symbol === market);
              const value = t ? Number(t.lastPrice) : 0;
              return <button type="button" key={symbol} onClick={() => { setPair(market); setPrice(""); setSection("Trade"); }} className="bot-setting" style={{display:"grid",gridTemplateColumns:"38px minmax(0,1fr)",alignItems:"center",gap:10,padding:12,border:"1px solid var(--border, #2b3442)",borderRadius:12,textAlign:"left",cursor:"pointer",width:"100%"}} title={"Open live chart and trading for "+symbol}>
                <div style={{width:36,height:36,borderRadius:18,display:"grid",placeItems:"center",fontWeight:800,background:"rgba(148,163,184,.14)"}}>{mark}</div>
                <div style={{minWidth:0}}>
                  <strong>{symbol} <span style={{fontWeight:400,opacity:.7}}>{name}</span></strong>
                  <small style={{display:"block",marginTop:4}}>{t ? "$"+money(value,value < 1 ? 5 : 2)+" · "+Number(t.priceChangePercent).toFixed(2)+"%" : "Price loading / pair unavailable"}</small>
                  <small style={{display:"block",marginTop:3,opacity:.7}}>Wallet balance: not initialized</small>
                </div>
              </button>;
            })}
          </div>
        </div><div className="feature-card"><ShieldCheck/><h2>Grandstone wallet infrastructure</h2><p>Grandstone will issue its own deposit addresses per customer and supported network. Addresses must be generated and stored by a secure custody/key-management service, not fabricated in the browser.</p><div className="bot-setting"><span><strong>Deposit wallet service</strong><small>Secure address generation and deposit monitoring are not configured yet.</small></span><span className="disabled-badge">NOT LIVE</span></div></div></div>}
      {section === "Deposit" && <div className="feature-grid"><div className="feature-card" style={{gridColumn:"1 / -1"}}>
        <div className="feature-title"><span className="eyebrow">GRANDSTONE WALLET</span><h1>Deposit crypto</h1><p>Create or retrieve your permanent Grandstone EVM wallet address. The same address is reused for your account.</p></div>
        <label className="field-label">Select cryptocurrency<select value={depositCoin} onChange={e => {setDepositCoin(e.target.value);setDepositAddress("");setDepositNetwork(e.target.value === "BNB" ? "BNB Smart Chain (BEP-20)" : "Ethereum (ERC-20)");}} style={{display:"block",width:"100%",marginTop:8,padding:12,borderRadius:10}}>{["ETH","USDT","USDC","BNB"].map(coin => <option key={coin} value={coin}>{coin}</option>)}</select></label>
        <label className="field-label" style={{display:"block",marginTop:14}}>Network<select value={depositNetwork} onChange={e => setDepositNetwork(e.target.value)} style={{display:"block",width:"100%",marginTop:8,padding:12,borderRadius:10}}>{(depositCoin === "BNB" ? ["BNB Smart Chain (BEP-20)"] : ["Ethereum (ERC-20)","Arbitrum","Optimism","Base","Polygon"]).map(network => <option key={network} value={network}>{network}</option>)}</select></label>
        <div className="bot-setting" style={{marginTop:18}}><span><strong>Deposit address</strong><small>{depositAddress ? "Permanent address assigned to your account" : "No address loaded yet"}</small></span><span className="disabled-badge">{depositAddress ? "ADDRESS READY" : "NOT LOADED"}</span></div>
        {depositAddress && <div style={{marginTop:12,padding:14,borderRadius:12,background:"#071b12",border:"1px solid rgba(32,245,155,.35)",overflowWrap:"anywhere"}}><code style={{fontSize:13,color:"#6dffb8",wordBreak:"break-all"}}>{depositAddress}</code><button style={{display:"block",marginTop:12}} onClick={() => { void navigator.clipboard.writeText(depositAddress).then(() => tell("Deposit address copied."), () => tell("Select and copy the address manually.")); }}>Copy address</button></div>}
        {depositError && <p role="alert" style={{marginTop:12,color:"#ff9b9b"}}>{depositError}</p>}
        <p style={{marginTop:12}}>Important: this is a persistent EVM wallet address generated by Privy. Deposit monitoring and automatic balance crediting are not connected yet, so do not send funds until Grandstone confirms monitoring is active. Only use the selected EVM network.</p>
        <button disabled={depositLoading} onClick={() => void generateDepositAddress()}>{depositLoading ? "Preparing secure wallet…" : depositAddress ? "Refresh saved address" : "Generate deposit address"}</button>
      </div></div>}
      {section === "AI Guardian" && <div className="feature-card"><ShieldCheck/><h2>Grandstone AI Trade Guardian</h2><p>Review volatility, order size, concentration, suspicious assets and your strategy rules before confirmation.</p><div className="bot-setting"><span><strong>Pre-trade review</strong><small>Risk rules must be enforced server-side before live orders.</small></span><button className={guardianEnabled ? "toggle on" : "toggle"} onClick={() => setGuardianEnabled(!guardianEnabled)}><i/></button></div><div className="guardian-rule"><ShieldAlert size={18}/><span>When a trade appears risky, Guardian should show the reason and require your Yes/No decision. Hard security and compliance blocks cannot be overridden.</span></div></div>}
      {section === "Trading bots" && <div className="feature-grid"><div className="feature-card"><Bot/><h2>Strategy bot workspace</h2><p>Plan grid, DCA and rule-based strategies with entry conditions, position sizing, take-profit, stop-loss and max-daily-loss limits.</p><div className="bot-setting"><span><strong>Backtesting & paper trading</strong><small>Simulation UI planned; verified historical-data engine not connected.</small></span><span className="disabled-badge">NOT LIVE</span></div><button onClick={() => tell("Bot execution is disabled until a supported exchange account, server-side risk checks and user authorization are integrated.")}>Review execution status</button></div><div className="feature-card"><Activity/><h2>Risk controls</h2><p>Set per-strategy exposure caps, cooldowns, daily loss limits and Guardian approval before live execution.</p><div className="guardian-rule"><ShieldAlert size={18}/><span>No bot should place real orders until secure provider integration and risk checks pass.</span></div></div></div>}
      {section === "AI Assistant" && <div className="feature-grid"><div className="feature-card"><Zap/><h2>Grandstone AI Assistant</h2><p>Designed to explain market movements, compare assets, summarize your portfolio and help you understand trading concepts.</p><button onClick={() => tell("The AI assistant needs its server-side model endpoint and authenticated user context connected before it can answer from live account data.")}>Check AI connection</button></div><div className="feature-card"><ShieldCheck/><h2>Trade explanations</h2><p>AI guidance should explain assumptions and risks. It must not promise returns or execute trades without explicit authorization.</p></div></div>}
      {section === "Scam Scanner" && <div className="feature-grid"><div className="feature-card"><ShieldAlert/><h2>Crypto scam scanner</h2><p>Planned checks: suspicious token and contract signals, malicious URLs, impersonation, wallet-drainer warnings and known-risk indicators.</p><label className="field-label">Token contract or website URL<input className="scanner-input" placeholder="Paste a public contract address or URL"/></label><button onClick={() => tell("Scam scanning is not connected to a verified threat-intelligence provider yet. Do not treat this screen as a security verdict.")}>Check scanner connection</button></div><div className="feature-card"><ShieldCheck/><h2>Safety first</h2><p>A scan must show sources, confidence and limitations. Never enter a seed phrase or private key into a scanner.</p></div></div>}
      {section === "Portfolio Manager" && <div className="feature-grid"><div className="feature-card"><Activity/><h2>AI portfolio manager</h2><p>Planned analysis includes allocation, concentration, volatility, drawdown, asset correlations and risk-aware rebalancing suggestions.</p><button onClick={() => tell("Portfolio analysis needs verified connected balances and a configured analysis service.")}>Check portfolio connection</button></div><div className="feature-card"><Wallet/><h2>Connected assets</h2><p>No balances are shown until a wallet or exchange account is securely connected and verified.</p></div></div>}
      {section === "Transaction Intelligence" && <div className="feature-grid"><div className="feature-card"><Search/><h2>Transaction intelligence</h2><p>Designed to explain transaction status, network fees, confirmations, token approvals and unusual transfer patterns.</p><button onClick={() => tell("Blockchain explorer and risk-data integrations are not connected yet.")}>Check data connections</button></div><div className="feature-card"><ShieldAlert/><h2>Address risk</h2><p>Risk signals should be sourced and explained before you sign or send funds.</p></div></div>}
      {section === "Alerts & Automation" && <div className="feature-grid"><div className="feature-card"><Bell/><h2>Smart alerts</h2><p>Plan price, volatility, portfolio drawdown, order status and security alerts with user-defined thresholds.</p><button onClick={() => tell("Persistent alerts need account storage and a notification delivery service.")}>Check alert service</button></div><div className="feature-card"><Zap/><h2>Automation rules</h2><p>Automation should require explicit opt-in, clear limits, logs and a one-step disable control.</p></div></div>}
      {["Convert","Derivatives","Copy Trading","Earn","P2P","Web3"].includes(section) && <div className="feature-grid"><div className="feature-card"><Activity/><h2>{section} workspace</h2><p>{({"Convert":"Asset conversion quotes, fee disclosure and confirmation before conversion.","Derivatives":"Perpetuals and other derivatives require leverage limits, liquidation estimates and a supported exchange provider.","Copy Trading":"Strategy discovery, transparent performance history, risk labels and user-controlled allocation.","Earn":"Yield products need provider verification, clear lock-up terms and risk disclosures.","P2P":"Peer-to-peer listings need verified counterparties, escrow, dispute handling and compliance checks.","Web3":"A self-custody Web3 gateway needs safe signing, chain selection and transaction simulation."} as Record<string,string>)[section]}</p><div className="bot-setting"><span><strong>Integration status</strong><small>Provider and secure transaction flow not connected</small></span><span className="disabled-badge">NOT LIVE</span></div><button onClick={() => tell(section+" is currently a planned workspace. No transaction, investment or order can be placed from this section.")}>View integration status</button></div><div className="feature-card"><ShieldCheck/><h2>Security requirements</h2><p>Real operations require verified providers, authentication, transaction authorization, risk controls and an auditable activity log.</p></div></div>}
    </section>}
    <footer className="exchange-footer"><span>© 2026 GRANDSTONE WALLET</span><span><i className={live ? "live-dot" : "offline-dot"}/>{live ? "Public market data connected" : "Market feed unavailable"} · private trading not connected</span></footer>
  </main>;
}


export default function Home() {
  // Keep sign-in before the dashboard; remove only the mandatory MFA gate.
  return <CustomerGate><WalletDashboard /></CustomerGate>;
}
