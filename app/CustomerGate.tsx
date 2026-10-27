"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase/client";

export default function CustomerGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive) return;
      setUser(error ? null : data.user);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ?? null);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (registering) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session && data.user) {
          setUser(data.user);
          setMessage("Your Grandstone account is ready.");
        } else {
          setRegistering(false);
          setMessage("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setUser(data.user);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not complete your request.");
    } finally { setBusy(false); }
  }

  if (!ready) return <main style={shell}><section style={panel}><Brand/><p>Checking your secure session…</p></section></main>;
  if (user) return <>{children}</>;
  return <main style={shell}>
    <section style={panel}>
      <Brand/>
      <p style={{color:"#9caec2",fontSize:14,margin:"8px 0 22px"}}>Sign in to access your private wallet dashboard.</p>
      {!supabase && <p role="alert" style={errorStyle}>Account setup is not complete. The Supabase Project URL and Publishable Key must be added to Vercel.</p>}
      <form onSubmit={submit} style={{display:"grid",gap:12}}>
        <label style={labelStyle}>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={fieldStyle}/></label>
        <label style={labelStyle}>Password<input type="password" autoComplete={registering?"new-password":"current-password"} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" style={fieldStyle}/></label>
        <button type="submit" disabled={!supabase||busy} style={primary}>{busy?"Please wait…":registering?"Create account":"Sign in"}</button>
      </form>
      <button type="button" onClick={()=>{setRegistering(v=>!v);setMessage("");}} style={switchButton}>{registering?"Already have an account? Sign in":"New to Grandstone? Create an account"}</button>
      {message && <p role="status" style={messageStyle}>{message}</p>}
      <p style={{color:"#6f839b",fontSize:11,lineHeight:1.5,marginTop:22}}>Your account is for Grandstone Wallet. Never share your password, recovery codes, or private keys.</p>
    </section>
  </main>;
}

function Brand() {
  return <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}>
    <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#d7b56d,#8b6b32)",display:"grid",placeItems:"center",color:"#10151e",fontWeight:900,fontSize:22}}>G</div>
    <div style={{textAlign:"left"}}><div style={{fontWeight:850,letterSpacing:2,color:"#f5f7fb",fontSize:18}}>GRANDSTONE</div><div style={{fontSize:10,letterSpacing:3,color:"#c8a967"}}>WALLET & EXCHANGE</div></div>
  </div>;
}

const shell: React.CSSProperties = {minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"radial-gradient(ellipse at top,#17283a 0%,#080d14 55%,#06090e 100%)",color:"#f5f7fb",fontFamily:"Arial, sans-serif"};
const panel: React.CSSProperties = {width:"100%",maxWidth:420,boxSizing:"border-box",padding:"34px 28px",border:"1px solid #29394b",borderRadius:20,background:"#0d141e",boxShadow:"0 24px 80px #0007"};
const labelStyle: React.CSSProperties = {display:"grid",gap:7,color:"#c4d0df",fontSize:12,fontWeight:600};
const fieldStyle: React.CSSProperties = {width:"100%",boxSizing:"border-box",padding:"13px 12px",borderRadius:9,border:"1px solid #33465c",background:"#080e16",color:"#fff",fontSize:14,outline:"none"};
const primary: React.CSSProperties = {border:0,borderRadius:9,padding:14,background:"linear-gradient(100deg,#d7b56d,#b88c43)",color:"#10151e",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:4};
const switchButton: React.CSSProperties = {width:"100%",border:0,background:"transparent",color:"#d8bd83",fontSize:13,padding:14,cursor:"pointer"};
const messageStyle: React.CSSProperties = {fontSize:12,lineHeight:1.5,color:"#d7e2ef",overflowWrap:"anywhere"};
const errorStyle: React.CSSProperties = {fontSize:12,lineHeight:1.5,color:"#f3b8b8",background:"#361d24",borderRadius:8,padding:10};
