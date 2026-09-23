'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const sb = getSupabase();
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/perfil` : undefined;

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

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setState('error'); setError('Escribí un email válido.'); return; }
    setState('sending');
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) { setState('error'); setError(error.message); } else setState('sent');
  };

  const google = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) { setState('error'); setError(error.message); }
  };

  return (
    <section className="view">
      <form className="panel login" onSubmit={sendLink}>
        <span className="eyebrow">* — cuenta</span>
        <h1>Entrá a tecla*</h1>
        <p className="sub">Con tu cuenta, tu historial, tus récords y tu lugar en el ranking diario te siguen a cualquier dispositivo.</p>
        <button className="btn" type="button" onClick={google}>continuar con Google</button>
        <div className="or">o con un link por email</div>
        <input type="email" id="login-email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        <button className="btn primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'enviando…' : 'enviarme el link'}</button>
        {state === 'sent' && <p className="msg">Listo: revisá tu email y tocá el link para entrar.</p>}
        {state === 'error' && <p className="msg err">{error}</p>}
      </form>
    </section>
  );
}
