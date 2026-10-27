import { ArrowDownLeft, ArrowUpRight, Bot, ChartNoAxesCombined, ShieldCheck, Wallet } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Security first", detail: "Protected account design and clear transaction controls." },
  { icon: ChartNoAxesCombined, title: "Market workspace", detail: "A foundation for charts, market data, and order management." },
  { icon: Bot, title: "AI Trade Guardian", detail: "Risk explanations and strategy checks before an order proceeds." },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark">G</span><span>GRANDSTONE<small>WALLET</small></span></a>
        <div className="nav-label">WORKSPACE</div>
        <a className="nav-item active" href="#"><Wallet size={18} /> Overview</a>
        <a className="nav-item" href="#markets"><ChartNoAxesCombined size={18} /> Markets</a>
        <a className="nav-item" href="#guardian"><ShieldCheck size={18} /> Trade Guardian</a>
        <div className="sidebar-bottom"><span className="status-dot" /> Platform foundation <small>Setup in progress</small></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div><span className="eyebrow">FINANCIAL WORKSPACE</span><h1>Good day.</h1></div><div className="profile"><span className="profile-avatar">G</span><span>Personal workspace<small>Account setup pending</small></span></div></header>
        <section className="welcome-card">
          <div className="welcome-copy"><span className="pill"><span className="status-dot" /> FOUNDATION PHASE</span><h2>Your financial world,<br /><em>under one roof.</em></h2><p>Grandstone is being built as a secure home for digital assets, market insights, and AI-assisted trading decisions.</p><a className="primary-link" href="#features">Explore the platform <ArrowUpRight size={16} /></a></div>
          <div className="orb-wrap"><div className="orb"><div className="orb-inner">G</div></div><span className="orb-caption">SECURE BY DESIGN</span></div>
        </section>

        <section className="metrics" aria-label="Account summary">
          <article className="metric-card"><div className="metric-heading">Total balance <Wallet size={18} /></div><div className="metric-value">— — —</div><div className="metric-note">Connect a supported account to display balances</div></article>
          <article className="metric-card"><div className="metric-heading">Market movement <ChartNoAxesCombined size={18} /></div><div className="metric-value">Not connected</div><div className="metric-note">Live market data will appear after provider setup</div></article>
          <article className="metric-card"><div className="metric-heading">Security status <ShieldCheck size={18} /></div><div className="metric-value">Setup required</div><div className="metric-note">No wallet or exchange is connected</div></article>
        </section>

        <section className="section-block" id="features"><div className="section-heading"><div><span className="eyebrow">BUILT FOR CONTROL</span><h2>One platform. Clear decisions.</h2></div><span className="section-count">01 / FOUNDATION</span></div><div className="feature-grid">{features.map(({ icon: Icon, title, detail }) => <article className="feature-card" key={title}><span className="feature-icon"><Icon size={20} /></span><h3>{title}</h3><p>{detail}</p><ArrowUpRight className="feature-arrow" size={17} /></article>)}</div></section>

        <section className="section-block guardian-block" id="guardian"><div className="guardian-icon"><ShieldCheck size={22} /></div><div><span className="eyebrow">GRANDSTONE AI</span><h2>Trade Guardian</h2><p>Before a trade is enabled, Guardian will check it against your chosen strategy and risk limits, explain potential concerns, and ask whether you want to continue. Hard security limits cannot be bypassed.</p></div><span className="coming-soon">IN DEVELOPMENT</span></section>
        <footer>GRANDSTONE WALLET <span>Independent build · No live trading enabled</span></footer>
      </section>
    </main>
  );
}
