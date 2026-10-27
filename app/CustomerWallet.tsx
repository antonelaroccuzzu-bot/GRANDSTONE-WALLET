"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useState } from "react";

export default function CustomerWallet() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [copied, setCopied] = useState(false);
  const address = wallets.find(wallet => wallet.walletClientType === "privy")?.address || wallets[0]?.address;

  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return <button className="connect-button" onClick={() => alert("Customer sign-in is not configured yet. Add NEXT_PUBLIC_PRIVY_APP_ID to Vercel, then redeploy.")}>Account setup</button>;
  }

  if (!ready) return <button className="connect-button" disabled>Loading account…</button>;

  if (!authenticated) {
    return <button className="connect-button" onClick={login}>Sign in / Create account</button>;
  }

  return (
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <span style={{fontSize:11,color:"#9bcbb0"}}>{user?.email?.address || user?.phone?.number || (user?.wallet?.address ? user.wallet.address.slice(0,6)+"…"+user.wallet.address.slice(-4) : "Signed in")}</span>
      {address ? (
        <button className="connect-button" title={address} onClick={async () => {
          try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
          catch { setCopied(false); }
        }}>{copied ? "Address copied" : address.slice(0,6)+"…"+address.slice(-4)}</button>
      ) : <span style={{fontSize:10,color:"#f0c674"}}>Wallet initializing…</span>}
      <button className="header-icon" onClick={logout} aria-label="Sign out">Sign out</button>
    </div>
  );
}
