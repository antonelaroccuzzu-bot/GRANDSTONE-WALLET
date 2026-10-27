"use client";

import { useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Bell, ChevronDown, CircleHelp, CreditCard,
  Eye, EyeOff, LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck,
  Wallet, ArrowLeftRight, ChartNoAxesCombined, Coins, Send, Download, Bot,
  MoreHorizontal, Clock3, ExternalLink
} from "lucide-react";

const assets = [
  { name: "Bitcoin", ticker: "BTC", amount: "0.0842 BTC", value: "$5,612.48", change: "+2.4%", symbol: "₿", style: "bitcoin" },
  { name: "Ethereum", ticker: "ETH", amount: "1.42 ETH", value: "$4,280.16", change: "+1.8%", symbol: "Ξ", style: "ethereum" },
  { name: "USD Coin", ticker: "USDC", amount: "850.00 USDC", value: "$850.00", change: "0.0%", symbol: "$", style: "usdc" },
];

const transactions = [
  { title: "Received Bitcoin", subtitle: "Demo transaction · Oct 26, 2026", amount: "+0.012 BTC", value: "+$800.40", kind: "in", icon: ArrowDownLeft },
  { title: "USDC transfer", subtitle: "Demo transaction · Oct 24, 2026", amount: "−120.00 USDC", value: "−$120.00", kind: "out", icon: ArrowUpRight },
  { title: "Bought Ethereum", subtitle: "Demo transaction · Oct 22, 2026", amount: "+0.15 ETH", value: "+$452.10", kind: "in", icon: ArrowLeftRight },
];

export default function Home() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [notice, setNotice] = useState("");
  const showAction = (action: string) => setNotice(action + " is not connected yet. Connect a verified wallet or provider to enable real transactions.");

  return (
    <main className="wallet-app">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-icon"><Wallet size={22} /></span><span>GRANDSTONE<small>WALLET</small></span></a>
        <div className="side-label">MENU</div>
        <a className="side-link selected" href="#"><LayoutDashboard size={18} /> Overview</a>
        <a className="side-link" href="#assets"><Coins size={18} /> My assets</a>
        <a className="side-link" href="#transactions"><ArrowLeftRight size={18} /> Transactions</a>
        <a className="side-link" href="#markets"><ChartNoAxesCombined size={18} /> Markets</a>
        <div className="side-label tools-label">TOOLS</div>
        <a className="side-link" href="#guardian"><Bot size={18} /> AI Trade Guardian <span className="new-tag">AI</span></a>
        <a className="side-link" href="#security"><ShieldCheck size={18} /> Security</a>
        <div className="sidebar-spacer" />
        <div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Wallet setup and security guidance.</p><button onClick={() => showAction("Help center")}>Get support <ExternalLink size={13}/></button></div>
        <a className="side-link bottom-link" href="#settings"><Settings size={18} /> Settings</a>
        <div className="side-profile"><div className="avatar">G</div><div className="profile-text"><strong>My wallet</strong><span>Personal account · Demo</span></div><MoreHorizontal size={18}/></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-icon"><Wallet size={20}/></span> GRANDSTONE</div>
          <div className="breadcrumbs">Wallet <span>/</span> <strong>Overview</strong></div>
          <div className="top-actions"><button className="icon-button search-button" aria-label="Search" onClick={() => showAction("Search")}><Search size={18}/></button><button className="icon-button" aria-label="Notifications" onClick={() => showAction("Notifications")}><Bell size={18}/><i/></button><div className="top-avatar">G</div><button className="account-switch" onClick={() => showAction("Account switcher")}>Personal <ChevronDown size={15}/></button></div>
        </header>

        <div className="page-intro"><div><p className="overline">TUESDAY, OCTOBER 27, 2026</p><h1>Your wallet overview</h1><p className="intro-copy">Manage your digital assets from one secure place.</p></div><button className="outline-button" onClick={() => showAction("Wallet connection")}><Plus size={17}/> Connect wallet</button></div>

        {notice && <div className="notice" role="status"><ShieldCheck size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

        <section className="dashboard-grid">
          <div className="balance-card">
            <div className="balance-top"><span><span className="balance-dot"/> TOTAL PORTFOLIO VALUE</span><button onClick={() => setBalanceVisible(!balanceVisible)} aria-label="Toggle balance">{balanceVisible ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div>
            <div className="balance-amount">{balanceVisible ? "$10,742.64" : "••••••••"}</div>
            <div className="balance-change"><span>↗ 2.16%</span> <span>past 24 hours · demo estimate</span></div>
            <div className="balance-rule"/>
            <div className="balance-footer"><div><span>Wallet status</span><strong><i className="status-pip"/> Not connected</strong></div><div className="balance-watermark"><Wallet size={72}/></div></div>
          </div>
          <div className="quick-card"><div className="card-heading"><h2>Quick actions</h2><span>WALLET</span></div><div className="action-grid">
            <button className="action-item" onClick={() => showAction("Send")}><span className="action-icon send"><Send size={19}/></span><strong>Send</strong><small>Transfer assets</small></button>
            <button className="action-item" onClick={() => showAction("Receive")}><span className="action-icon receive"><Download size={19}/></span><strong>Receive</strong><small>Get assets</small></button>
            <button className="action-item" onClick={() => showAction("Buy crypto")}><span className="action-icon buy"><Plus size={20}/></span><strong>Buy</strong><small>Purchase crypto</small></button>
            <button className="action-item" onClick={() => showAction("Swap")}><span className="action-icon swap"><ArrowLeftRight size={19}/></span><strong>Swap</strong><small>Exchange assets</small></button>
          </div></div>
        </section>

        <section className="lower-grid">
          <div className="panel assets-panel" id="assets"><div className="panel-heading"><div><h2>Your assets</h2><p>Example portfolio · not connected to live funds</p></div><button className="text-button" onClick={() => showAction("Asset details")}>View all <ArrowUpRight size={15}/></button></div>
            <div className="asset-table"><div className="asset-row table-head"><span>ASSET</span><span>YOUR BALANCE</span><span>VALUE</span><span>24H</span></div>
              {assets.map((asset) => <div className="asset-row" key={asset.ticker}><div className="asset-name"><span className={"coin "+asset.style}>{asset.symbol}</span><span><strong>{asset.name}</strong><small>{asset.ticker}</small></span></div><div className="asset-amount">{asset.amount}</div><div className="asset-value">{asset.value}</div><div className={asset.change.startsWith("+") ? "positive" : "neutral"}>{asset.change}</div></div>)}
            </div>
            <button className="full-width-button" onClick={() => showAction("Add asset")}><Plus size={16}/> Add an asset</button>
          </div>

          <div className="panel transactions-panel" id="transactions"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest wallet movements</p></div><button className="more-button" aria-label="More activity options" onClick={() => showAction("Transaction history")}><MoreHorizontal size={19}/></button></div>
            <div className="transaction-list">{transactions.map((tx, index) => <div className="transaction-row" key={tx.title}><span className={"transaction-icon "+tx.kind}><tx.icon size={17}/></span><div className="transaction-info"><strong>{tx.title}</strong><small>{tx.subtitle}</small></div><div className="transaction-amount"><strong className={tx.kind === "in" ? "positive" : ""}>{tx.amount}</strong><small>{tx.value}</small></div></div>)}</div>
            <button className="full-width-button" onClick={() => showAction("Full transaction history")}>View transaction history <ArrowUpRight size={15}/></button>
          </div>
        </section>

        <section className="guardian-banner" id="guardian"><div className="guardian-symbol"><ShieldCheck size={24}/></div><div className="guardian-copy"><span className="overline">GRANDSTONE INTELLIGENCE</span><h2>Every move deserves a second look.</h2><p>AI Trade Guardian is planned to flag suspicious activity and explain trading risks before you proceed.</p></div><span className="building-badge">IN DEVELOPMENT</span></section>
        <footer><span>© 2026 GRANDSTONE WALLET</span><span><i className="status-pip"/> DEMO INTERFACE · NO LIVE FUNDS CONNECTED</span></footer>
      </section>
    </main>
  );
}
