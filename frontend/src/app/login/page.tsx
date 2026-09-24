'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { authMessage } from '@/lib/authErrors';

type State = 'idle' | 'sending' | 'sent' | 'verifying' | 'error';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [google, setGoogle] = useState(false);
  const [signedIn, setSignedIn] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sb = getSupabase();

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSignedIn(data.session?.user.email ?? null));
    // mostrar Google solo si está activado en Supabase (si no, el botón solo daba error)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } }).then(r => r.json()).then(s => setGoogle(!!s?.external?.google)).catch(() => {});
  }, [sb]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!sb) {
    return (
      <section className="view">
        <div className="panel login">
          <span className="eyebrow">* — cuenta</span>
          <h1>Todavía no hay cuentas</h1>
          <p className="sub">
            Falta conectar Supabase. Copiá <code>.env.example</code> como <code>.env.local</code> en la carpeta
            <code> frontend</code>, completá la URL y la clave pública de tu proyecto y reiniciá <code>npm run dev</code>.
            Mientras tanto, tu progreso se guarda en este navegador.
          </p>
        </div>
      </section>
    );
  }

  const redirectTo = () => `${window.location.origin}/auth`;
  const fail = (m: string) => { setState('error'); setError(authMessage(m)); };

  const sendLink = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setState('error'); setError('Escribí un email válido.'); return; }
    setState('sending'); setError('');
    const { error } = await sb.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    if (error) return fail(error.message);
    setState('sent'); setCooldown(60);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setError('El código tiene 6 dígitos (o más).'); return; }
    setState('verifying'); setError('');
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
    if (error) { setState('sent'); setError(authMessage(error.message)); return; }
    window.location.replace('/perfil');
  };

  const withGoogle = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    if (error) fail(error.message);
  };

  const logout = async () => { await sb.auth.signOut(); setSignedIn(null); };

  if (signedIn) {
    return (
      <section className="view">
        <div className="panel login">
          <span className="eyebrow">* — cuenta</span>
          <h1>Ya estás adentro</h1>
          <p className="sub">Entraste como <b>{signedIn}</b>.</p>
          <Link className="btn primary" href="/perfil">ir a mi perfil</Link>
          <button className="btn ghost" type="button" onClick={logout}>cerrar sesión</button>
        </div>
      </section>
    );
  }

  const sent = state === 'sent' || state === 'verifying';

  return (
    <section className="view">
      {!sent ? (
        <form className="panel login" onSubmit={sendLink}>
          <span className="eyebrow">* — cuenta</span>
          <h1>Entrá a tecla*</h1>
          <p className="sub">Con tu cuenta, tu historial, tus récords y tu lugar en el ranking te siguen a cualquier dispositivo. No hace falta contraseña.</p>
          {google && <><button className="btn" type="button" onClick={withGoogle}>continuar con Google</button><div className="or">o con tu email</div></>}
          <input type="email" id="login-email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required
            onKeyDown={e => e.stopPropagation()} />
          <button className="btn primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'enviando…' : 'enviarme el link'}</button>
          {state === 'error' && <p className="msg err">{error}</p>}
        </form>
      ) : (
        <form className="panel login" onSubmit={verifyCode}>
          <span className="eyebrow">* — revisá tu email</span>
          <h1>Te mandamos un link</h1>
          <p className="sub">Lo mandamos a <b>{email.trim().toLowerCase()}</b>. Tocá el link del email para entrar. Si no aparece, revisá el spam o promociones.</p>
          <p className="hint" style={{ textAlign: 'left' }}>Si el email trae un código, podés escribirlo acá (sirve aunque lo abras en otro dispositivo):</p>
          <input className="otp-input" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={10} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.stopPropagation()} />
          <button className="btn primary" type="submit" disabled={state === 'verifying'}>{state === 'verifying' ? 'verificando…' : 'entrar con el código'}</button>
          {error && <p className="msg err">{error}</p>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost" type="button" onClick={() => { setState('idle'); setCode(''); setError(''); }}>cambiar email</button>
            <button className="btn ghost" type="button" disabled={cooldown > 0} onClick={sendLink}>{cooldown > 0 ? `reenviar en ${cooldown} s` : 'reenviar el link'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
