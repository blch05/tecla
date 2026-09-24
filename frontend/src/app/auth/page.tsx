'use client';

/* Vuelta del link del email (o de Google). Soporta las tres formas en que Supabase puede volver:
   - #access_token=… (flujo implícito: lo procesa el cliente solo)
   - ?code=…         (flujo PKCE: solo funciona en el mismo navegador donde se pidió el link)
   - ?token_hash=…&type=… (plantilla de email con {{ .TokenHash }}: funciona en cualquier dispositivo) */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { authMessage, urlAuthError } from '@/lib/authErrors';

export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setError('Falta conectar Supabase.'); return; }
    let done = false;
    const ok = () => { if (done) return; done = true; window.location.replace('/perfil'); };
    // antes de mostrar un error, confirmar que no quedó una sesión abierta igual (el cliente también procesa la URL)
    const fail = async (m: string | null | undefined) => {
      if (done) return;
      const { data } = await sb.auth.getSession();
      if (data.session) return ok();
      done = true; setError(authMessage(m));
    };

    const urlErr = urlAuthError(window.location.href);
    if (urlErr) { fail(urlErr); return; }

    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (session) ok(); });
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const tokenHash = q.get('token_hash'), type = q.get('type'), code = q.get('code');
      if (tokenHash) {
        const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: (type as 'email' | 'magiclink' | 'signup') || 'email' });
        if (error) return fail(error.message);
      } else if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) return fail(error.message);
      }
      const { data } = await sb.auth.getSession();
      if (data.session) return ok();
      // el hash lo procesa el cliente en segundo plano: le damos unos segundos
      setTimeout(async () => { const { data } = await sb.auth.getSession(); if (data.session) ok(); else fail('El link no trajo una sesión. Pedí uno nuevo.'); }, 4000);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <section className="view">
      <div className="panel login">
        <span className="eyebrow">* — cuenta</span>
        {!error ? (
          <>
            <h1>Entrando…</h1>
            <p className="sub">Un segundo, estamos abriendo tu sesión.</p>
          </>
        ) : (
          <>
            <h1>No pudimos entrar</h1>
            <p className="msg err">{error}</p>
            <Link className="btn primary" href="/login">volver a intentar</Link>
          </>
        )}
      </div>
    </section>
  );
}
