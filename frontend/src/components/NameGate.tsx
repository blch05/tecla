'use client';

/* La primera vez que alguien entra con su cuenta, le pedimos cómo quiere que lo vean.
   El nombre se puede repetir: lo que identifica a cada uno es su usuario (@usuario, único).
   Se marca en los metadatos de la cuenta (name_chosen) para no volver a preguntar. */
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { History } from '@/lib/tecla/history';
import { useSession } from '@/lib/useHistory';

export default function NameGate() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const user = useSession(s => (s.mode === 'cloud' ? s.user : null));

  // con cuenta y sin nombre elegido todavía: preguntar
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) { setOpen(false); return; }
    let alive = true;
    sb.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return;
      if (data.user.user_metadata?.name_chosen) { setOpen(false); return; }
      setName(n => n || user.name || ''); setHandle(user.username || null); setOpen(true);
    });
    return () => { alive = false; };
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { setErr('Escribí un nombre.'); return; }
    if (n.length > 40) { setErr('Máximo 40 caracteres.'); return; }
    setSaving(true); setErr('');
    const e1 = await History.updateProfile({ display_name: n });
    if (e1) { setErr(e1); setSaving(false); return; }
    const sb = getSupabase();
    await sb?.auth.updateUser({ data: { name_chosen: true } });
    try { localStorage.setItem('tecla:nick', n.slice(0, 24)); } catch {}
    setSaving(false); setOpen(false);
  };

  if (!open) return null;
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="ng-title">
      <form className="modal panel" onSubmit={save}>
        <span className="eyebrow">* — bienvenida</span>
        <h2 id="ng-title">¿Cómo querés que te vean?</h2>
        <p className="sub">Es el nombre que aparece en las salas, el ranking y tu perfil. Puede repetirse con el de otra persona{handle ? <>: a vos te identifica tu usuario <b>@{handle}</b></> : ''}.</p>
        <input className="live-nick big-input" value={name} autoFocus maxLength={40} onChange={e => setName(e.target.value)} onKeyDown={e => e.stopPropagation()} placeholder="tu nombre" />
        {err && <p className="msg err">{err}</p>}
        <button className="btn primary big" type="submit" disabled={saving}>{saving ? 'guardando…' : 'listo'}</button>
        <p className="hint" style={{ textAlign: 'left' }}>Lo podés cambiar cuando quieras desde tu perfil.</p>
      </form>
    </div>
  );
}
