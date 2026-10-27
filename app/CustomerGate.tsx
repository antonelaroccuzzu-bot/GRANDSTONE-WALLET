"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase/client";

type TotpSetup = { id: string; qr: string; secret: string };
type PendingChallenge = { factorId: string; challengeId: string };

export default function CustomerGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [factorsReady, setFactorsReady] = useState(false);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive) return;
      setUser(error ? null : data.user);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) {
        setUser(session?.user ?? null);
        if (!session?.user) { setVerified(false); setSetup(null); setChallenge(null); setFactorsReady(false); }
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    async function prepareMfa() {
      if (!supabase || !user) { setFactorsReady(false); return; }
      setFactorsReady(false); setVerified(false); setMessage(""); setCode("");
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (!alive) return;
        const active = (data.totp || []).find(factor => factor.status === "verified");
        if (active) {
          const { data: c, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: active.id });
          if (challengeError) throw challengeError;
          if (!alive) return;
          setChallenge({ factorId: active.id, challengeId: c.id });
          setSetup(null);
        } else {
          const pending = (data.totp || []).find(factor => factor.status === "unverified");
          if (pending) {
            const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: pending.id });
            if (unenrollError) throw unenrollError;
          }
          const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Grandstone Authenticator" });
          if (enrollError) throw enrollError;
          if (!alive) return;
          setSetup({ id: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
        }
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : "Could not prepare authenticator security.");
      } finally { if (alive) setFactorsReady(true); }
    }
    prepareMfa();
    return () => { alive = false; };
  }, [user?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      if (registering) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session && data.user) {
          setUser(data.user);
          setMessage("Account created. Next, set up your authenticator.");
        } else {
          setRegistering(false);
          setMessage("Check your email to confirm your account, then sign in to set up your authenticator.");
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

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !code.trim()) return;
    setBusy(true); setMessage("");
    try {
      if (setup) {
        const { data: c, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: setup.id });
        if (challengeError) throw challengeError;
        const { error } = await supabase.auth.mfa.verify({ factorId: setup.id, challengeId: c.id, code: code.trim() });
        if (error) throw error;
        setSetup(null); setChallenge(null); setVerified(true);
        setMessage("Authenticator verified. Your wallet is unlocked.");
      } else if (challenge) {
        const { error } = await supabase.auth.mfa.verify({ factorId: challenge.factorId, challengeId: challenge.challengeId, code: code.trim() });
        if (error) throw error;
        setVerified(true); setMessage("");
      }
      setCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That code could not be verified. Try the latest code.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null); setVerified(false); setSetup(null); setChallenge(null);
  }

  if (!ready) return <main style={shell}><section style={panel}><Brand/><p>Checking your secure session…</p></section></main>;
  if (!user) return <main style={shell}>
    <section style={panel}>
      <Brand/>
      <p style={intro}>Sign in or create an account to access your private wallet.</p>
      {!supabase && <p role="alert" style={errorStyle}>Account setup is incomplete. Add the Supabase Project URL and Publishable Key to Vercel.</p>}
      <form onSubmit={submit} style={{display:"grid",gap:12}}>
        <label style={labelStyle}>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={fieldStyle}/></label>
        <label style={labelStyle}>Password<input type="password" autoComplete={registering?"new-password":"current-password"} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" style={fieldStyle}/></label>
        <button type="submit" disabled={!supabase||busy} style={primary}>{busy?"Please wait…":registering?"Create account":"Sign in"}</button>
      </form>
      <button type="button" onClick={()=>{setRegistering(v=>!v);setMessage("");}} style={switchButton}>{registering?"Already have an account? Sign in":"New to Grandstone? Create an account"}</button>
      {message && <p role="status" style={messageStyle}>{message}</p>}
      <p style={finePrint}>Account security is required. After email/password, you’ll set up an authenticator app that generates a one-time code.</p>
      <CreatorInfo/>
    </section>
  </main>;

  if (!factorsReady) return <main style={shell}><section style={panel}><Brand/><p>Preparing your account security…</p></section></main>;
  if (!verified) return <main style={shell}>
    <section style={panel}>
      <Brand/>
      {setup ? <>
        <h2 style={heading}>Set up two-factor authentication</h2>
        <p style={intro}>Open Google Authenticator, Microsoft Authenticator, or another TOTP app. Scan this QR code, or enter the setup key manually.</p>
        <div style={qrBox}><img src={setup.qr} alt="Authenticator setup QR code" style={{width:200,height:200,maxWidth:"100%",imageRendering:"auto"}}/></div>
        <p style={labelStyle}>Manual setup key</p>
        <code style={secret}>{setup.secret}</code>
        <p style={finePrint}>Keep this setup key private. Anyone who has it may generate your authentication codes.</p>
      </> : <>
        <h2 style={heading}>Verify your authenticator</h2>
        <p style={intro}>Enter the current six-digit code from your authenticator app to unlock your wallet.</p>
      </>}
      <form onSubmit={verifyCode} style={{display:"grid",gap:12}}>
        <label style={labelStyle}>6-digit authentication code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" style={{...fieldStyle,textAlign:"center",letterSpacing:8,fontSize:20}}/></label>
        <button type="submit" disabled={busy||code.length!==6} style={primary}>{busy?"Verifying…":setup?"Verify and secure wallet":"Verify and unlock wallet"}</button>
      </form>
      {message && <p role="alert" style={messageStyle}>{message}</p>}
      <button type="button" onClick={signOut} style={switchButton}>Sign out</button>
      <CreatorInfo/>
    </section>
  </main>;

  return <>{children}</>;
}

function Brand() {
  return <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}>
    <div style={{width:44,height:44,borderRadius:14,background:"#20f59b",display:"grid",placeItems:"center",color:"#04150f",fontWeight:900,fontSize:22}}>G</div>
    <div style={{textAlign:"left"}}><div style={{fontWeight:850,letterSpacing:2,color:"#effff6",fontSize:18}}>GRANDSTONE</div><div style={{fontSize:10,letterSpacing:3,color:"#9bcbb0"}}>WALLET & EXCHANGE</div></div>
  </div>;
}

function CreatorInfo() {
  return <aside style={creatorBox}><div style={{color:"#20f59b",fontSize:10,fontWeight:800,letterSpacing:2}}>ABOUT THE CREATOR</div><p style={{margin:"8px 0 5px",fontWeight:700,color:"#effff6"}}>Asogwo Victor Odinaka</p><p style={{margin:0,color:"#9bcbb0",fontSize:12,lineHeight:1.6}}>Founder and builder of Grandstone Wallet, focused on creating digital wallet and technology experiences with a strong emphasis on clear design and account security.</p></aside>;
}

const shell: React.CSSProperties = {minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"#04150f",color:"#effff6",fontFamily:"Inter,Arial,sans-serif"};
const panel: React.CSSProperties = {width:"100%",maxWidth:440,boxSizing:"border-box",padding:"30px 26px",border:"1px solid rgba(65,255,159,.2)",borderRadius:18,background:"rgba(8,35,24,.96)",boxShadow:"0 24px 80px #0007"};
const intro: React.CSSProperties = {color:"#9bcbb0",fontSize:13,lineHeight:1.6,margin:"12px 0 22px",textAlign:"center"};
const heading: React.CSSProperties = {fontSize:18,textAlign:"center",margin:"22px 0 0",color:"#effff6"};
const labelStyle: React.CSSProperties = {display:"grid",gap:7,color:"#cde6d8",fontSize:12,fontWeight:600};
const fieldStyle: React.CSSProperties = {width:"100%",boxSizing:"border-box",padding:"13px 12px",borderRadius:9,border:"1px solid rgba(65,255,159,.25)",background:"#04150f",color:"#effff6",fontSize:14,outline:"none"};
const primary: React.CSSProperties = {border:0,borderRadius:9,padding:14,background:"#20f59b",color:"#04150f",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:4};
const switchButton: React.CSSProperties = {width:"100%",border:0,background:"transparent",color:"#20f59b",fontSize:13,padding:14,cursor:"pointer"};
const messageStyle: React.CSSProperties = {fontSize:12,lineHeight:1.5,color:"#d7e2ef",overflowWrap:"anywhere"};
const errorStyle: React.CSSProperties = {fontSize:12,lineHeight:1.5,color:"#ff9eac",background:"#2b151b",borderRadius:8,padding:10};
const finePrint: React.CSSProperties = {color:"#6f9d85",fontSize:11,lineHeight:1.6,marginTop:18};
const qrBox: React.CSSProperties = {display:"grid",placeItems:"center",padding:14,margin:"16px auto",width:"fit-content",background:"#fff",borderRadius:12};
const secret: React.CSSProperties = {display:"block",padding:12,margin:"8px 0",borderRadius:8,background:"#04150f",border:"1px solid rgba(65,255,159,.25)",color:"#20f59b",fontSize:12,overflowWrap:"anywhere",wordBreak:"break-all",textAlign:"center"};
const creatorBox: React.CSSProperties = {marginTop:24,paddingTop:18,borderTop:"1px solid rgba(65,255,159,.15)"};
