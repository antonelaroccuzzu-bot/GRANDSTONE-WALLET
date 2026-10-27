"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase/client";

export default function CustomerWallet() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) {
        setUser(data.user);
        setReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session) {
          setUser(data.user);
          setMessage("Grandstone account created.");
        } else {
          setMessage("Check your email to confirm your Grandstone account, then sign in.");
          setIsRegistering(false);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setUser(data.user);
        setMessage("Signed in to Grandstone.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete account request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setMessage(error ? error.message : "You have signed out.");
    if (!error) setUser(null);
  }

  if (!ready) return <button className="connect-button customer-auth-button" disabled>Loading account…</button>;

  if (!supabase) {
    return <button className="connect-button customer-auth-button" onClick={() => alert("Grandstone account setup needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the deployment environment.")}>Account setup</button>;
  }

  if (user) {
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"#9bcbb0"}}>{user.email || "Grandstone customer"}</span>
        <button className="header-icon" onClick={handleSignOut} aria-label="Sign out">Sign out</button>
      </div>
    );
  }

  return (
    <div style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
      <details>
        <summary className="connect-button customer-auth-button" style={{cursor:"pointer",listStyle:"none"}}>Sign in / Create account</summary>
        <form onSubmit={handleSubmit} style={{position:"absolute",right:0,top:"calc(100% + 10px)",zIndex:1000,width:280,padding:16,background:"#101722",border:"1px solid #29384a",borderRadius:12,display:"grid",gap:10,boxShadow:"0 12px 40px #0008"}}>
          <strong style={{color:"#fff"}}>{isRegistering ? "Create your Grandstone account" : "Sign in to Grandstone"}</strong>
          <input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #344357",background:"#0b111a",color:"#fff"}} />
          <input type="password" autoComplete={isRegistering ? "new-password" : "current-password"} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (at least 6 characters)" style={{width:"100%",padding:10,borderRadius:8,border:"1px solid #344357",background:"#0b111a",color:"#fff"}} />
          <button type="submit" className="connect-button" disabled={busy}>{busy ? "Please wait…" : isRegistering ? "Create account" : "Sign in"}</button>
          <button type="button" className="header-icon" onClick={()=>{setIsRegistering(v=>!v);setMessage("");}}>{isRegistering ? "Already have an account? Sign in" : "New to Grandstone? Create account"}</button>
          {message && <p role="status" style={{fontSize:12,color:"#cbd5e1",margin:0,overflowWrap:"anywhere"}}>{message}</p>}
        </form>
      </details>
    </div>
  );
}
