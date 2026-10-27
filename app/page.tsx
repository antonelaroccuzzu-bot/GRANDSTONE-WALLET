"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Bot, CandlestickChart, ChevronDown, Clock3, Coins, LayoutDashboard, Menu, Search, Settings, ShieldAlert, ShieldCheck, Wallet, X, Zap } from "lucide-react";

type Ticker = { symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string; highPrice: string; lowPrice: string };
type Candle = [number, string, string, string, string, string, number, string, number, string, string, string];
type Book = { bids: [string, string][]; asks: [string, string][] };
type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global { interface Window { ethereum?: Eip1193Provider } }
const chainNames: Record<string, string> = { "0x1": "Ethereum", "0x89": "Polygon", "0xa4b1": "Arbitrum", "0xa": "Optimism", "0x2105": "Base", "0x38": "BNB Chain" };
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
  const [guardianEnabled, setGuardianEnabled] = useState(true);\n  const [walletAddress, setWalletAddress] = useState("");\n  const [walletBalance, setWalletBalance] = useState("");\n  const [walletChain, setWalletChain] = useState("");\n  const [walletBusy, setWalletBusy] = useState(false);
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
  const connectWallet = async () => {
    if (!window.ethereum) {
      tell("No browser wallet was detected. Open Grandstone inside a supported wallet browser or install a compatible EVM wallet. Never enter a recovery phrase into Grandstone.");
      return;
    }
    setWalletBusy(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts?.length) throw new Error("Wallet did not return an account.");
      const address = accounts[0];
      const chainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
      const balanceHex = await window.ethereum.request({ method: "eth_getBalance", params: [address, "latest"] }) as string;
      const balance = Number(BigInt(balanceHex)) / 1e18;
      setWalletAddress(address);
      setWalletBalance(balance.toLocaleString("en-US", { maximumFractionDigits: 6 }));
      setWalletChain(chainNames[chainId] || ("Chain " + chainId));
      tell("Wallet connected for public address and balance reads. Transactions still require a separate review and explicit approval in your wallet.");
    } catch (error) {
      tell(error instanceof Error ? "Wallet connection failed: " + error.message : "Wallet connection failed. No transaction was sent.");
    } finally {
      setWalletBusy(false);
    }
  };
  const disconnectWalletView = () => {
    setWalletAddress("");
    setWalletBalance("");
    setWalletChain("");
    tell("Grandstone cleared the displayed wallet session. To revoke wallet-site permissions, use your wallet's connected-apps settings.");
  };
  const submitOrder = () => tell("Order not sent. Public market data is live, but private exchange authentication, order signing and server-side risk checks are not connected. No trade was placed.");

  return <main className="exchange-app">
    <header className="exchange-topbar">
      <button className="exchange-brand" onClick={() => setSection("Overview")}><span className="brand-mark"><Coins size={21}/></span><span>GRANDSTONE<small>WALLET & EXCHANGE</small></span></button>
      <nav className="desktop-nav">{nav.map(n => <button key={n.label} className={section === n.label ? "nav-item active" : "nav-item"} onClick={() => setSection(n.label)}>{n.label}</button>)}</nav>
      <div className="header-tools"><span className={live ? "feed-status online" : "feed-status"}><i/>{live ? "Live market" : "Market offline"}</span><button className="header-icon" aria-label="Notifications" onClick={() => tell("Notifications require an authenticated account.")}><Bell size={18}/></button><button className="connect-button" onClick={walletAddress ? disconnectWalletView : connectWallet} disabled={walletBusy}><Wallet size={16}/> {walletBusy ? "Connecting…" : walletAddress ? walletAddress.slice(0,6) + "…" + walletAddress.slice(-4) : "Connect wallet"}</button><button className="mobile-menu-button" aria-label="Menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu/></button></div>
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
      {section === "Overview" && <div className="overview-dashboard"><div className="feature-card overview-assets"><span>Total Assets</span><strong className="overview-total">$0.00 <small>USD</small></strong><p>Connect an account to show verified balances. No funds are connected.</p><div className="overview-tabs"><button className="selected">All</button><button onClick={() => setSection("Markets")}>Stocks</button><button onClick={() => setSection("Markets")}>Macro</button><button onClick={() => setSection("Assets")}>Crypto</button><button onClick={() => setSection("Earn")}>Earn</button></div><div className="overview-pnl"><span>Today’s P&amp;L</span><strong>— USD (—%)</strong></div></div><h2>Quick access</h2><div className="overview-shortcuts"><button onClick={() => setSection("Assets")}><ArrowDownLeft/><strong>Deposit</strong></button><button onClick={() => setSection("Assets")}><ArrowUpRight/><strong>Withdraw</strong></button><button onClick={() => setSection("Convert")}><ArrowLeftRight/><strong>Convert</strong></button><button onClick={() => setSection("Trade")}><CandlestickChart/><strong>Trade</strong></button><button onClick={() => setSection("Earn")}><Coins/><strong>Bybit Earn</strong></button><button onClick={() => setSection("Rewards Hub")}><Zap/><strong>Rewards Hub</strong></button><button onClick={() => setSection("Demo Trading")}><Activity/><strong>Demo Trading</strong></button><button onClick={() => setSection("More")}><Menu/><strong>More</strong></button></div><h2>Explore tools</h2><div className="feature-grid"><div className="feature-card"><Bot/><h2>Trading bots</h2><p>Strategy workspace and risk controls.</p><button onClick={() => setSection("Trading bots")}>Open bots</button></div><div className="feature-card"><ShieldCheck/><h2>AI Trade Guardian</h2><p>Review risk before trade confirmation.</p><button onClick={() => setSection("AI Guardian")}>Open Guardian</button></div><div className="feature-card"><ShieldAlert/><h2>Scam Scanner</h2><p>Security analysis workspace.</p><button onClick={() => setSection("Scam Scanner")}>Open scanner</button></div></div></div>}
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
      {section === "Assets" && <div className="feature-grid"><div className="feature-card"><Wallet/><h2>Self-custody wallet</h2><p>Connect a wallet you control. Grandstone never asks for your recovery phrase or private key.</p>{walletAddress ? <><div className="bot-setting"><span><strong>Connected address</strong><small>{walletAddress}</small></span><span className="disabled-badge">CONNECTED</span></div><div className="bot-setting"><span><strong>Network</strong><small>{walletChain}</small></span><span><strong>{walletBalance}</strong><small>Native coin balance</small></span></div><button onClick={connectWallet}>Refresh wallet balance</button><button onClick={disconnectWalletView}>Disconnect display</button></> : <button onClick={connectWallet} disabled={walletBusy}>{walletBusy ? "Connecting…" : "Connect existing wallet"}</button>}</div><div className="feature-card"><ShieldCheck/><h2>Transaction status</h2><p>Wallet connection enables address and native balance reads only. Sending, swaps, token balances, and transaction history need chain-specific integrations and a confirmation screen before any transaction is signed.</p><div className="bot-setting"><span><strong>Signing authority</strong><small>Your wallet handles transaction approvals.</small></span><span className="disabled-badge">SELF-CUSTODY</span></div></div></div>}
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
