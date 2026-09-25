'use client';

/* Tienda: se compra con teclas* (la moneda que se gana jugando) y solo hay cosas estéticas.
   Comprar y equipar lo validan las funciones de la base; acá se muestra y se pide. */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { useShop } from '@/lib/shop/client';
import { EFFECT, RARITY_NAMES, SLOTS, type ShopItem, type Slot } from '@/lib/shop/catalog';
import { applyTheme, PREMIUM, readTheme } from '@/lib/theme';
import { getSupabase } from '@/lib/supabase/client';
import Avatar from '@/components/shop/Avatar';
import Badge from '@/components/shop/Badge';
import { celebrate } from '@/lib/shop/celebrate';
import { play as playPack } from '@/lib/shop/sounds';
import { FONTS } from '@/lib/shop/fonts';
import { FONT_FAMILIES } from '@/lib/theme';

/* el sonido del test se guarda en su configuración (tecla:cfg) */
const testSound = () => { try { return JSON.parse(localStorage.getItem('tecla:cfg') || '{}').sound || 'off'; } catch { return 'off'; } };
const setTestSound = (v: string) => { try { const c = JSON.parse(localStorage.getItem('tecla:cfg') || '{}'); localStorage.setItem('tecla:cfg', JSON.stringify({ ...c, sound: v })); } catch {} };

const SKIN_COLORS: Record<string, string> = { rojo: '#F0735F', fantasma: '#9FB3C8', dorado: '#D9A21B', arcoiris: 'url(#rb)' };
const EARN = [
  ['test', 'hasta 9', '75% de precisión o más; más rápido, más teclas*'],
  ['arcade', 'hasta 10', 'según tu puntaje'],
  ['competir', '3 u 8', 'ganar paga más'],
  ['estudiar', 'hasta 6', 'según tus aciertos'],
];

/** Tipografía: se descarga al mostrarse la tarjeta. */
function FontPreview({ fx }: { fx: string }) {
  useEffect(() => { FONTS[fx]?.load(); }, [fx]);
  return <div className="shop-prev font-prev" data-font-prev={fx} style={{ fontFamily: FONT_FAMILIES[fx] + ',var(--mono)' }}>tecla* <span>áñ 123</span></div>;
}

/** Efecto del arcade: una capa de PixiJS solo mientras se prueba. */
function FxPreview({ fx }: { fx: string }) {
  const ref = useRef<HTMLDivElement>(null), cvRef = useRef<HTMLSpanElement>(null), live = useRef<{ fx: import('@/lib/shop/pixifx').PixiFx | null; t: number }>({ fx: null, t: 0 });
  useEffect(() => () => { clearTimeout(live.current.t); live.current.fx?.destroy(); }, []);
  const test = async () => {
    const el = ref.current, under = cvRef.current; if (!el || !under) return;
    const L = live.current; clearTimeout(L.t);
    if (!L.fx) { const { PixiFx } = await import('@/lib/shop/pixifx'); L.fx = await PixiFx.attach(el, under, fx); }
    const w = el.clientWidth, h = el.clientHeight, acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#34A3F0';
    L.fx?.burst(w / 2, h / 2, 14, acc); setTimeout(() => L.fx?.burst(w * .28, h * .4, 8, '#F2B13C'), 220); setTimeout(() => L.fx?.burst(w * .72, h * .6, 8, '#F0607A'), 380);
    L.t = window.setTimeout(() => { L.fx?.destroy(); L.fx = null; }, 2500);
  };
  return <div className="shop-prev fx-prev" ref={ref}><span ref={cvRef} className="fx-word">boom</span><button className="try" type="button" onClick={test}>▶ probar</button></div>;
}

function Preview({ item, name, seed }: { item: ShopItem; name: string; seed: string }) {
  const fx = EFFECT[item.id];
  if (item.slot === 'fuente') return <FontPreview fx={fx} />;
  if (item.slot === 'efecto') return <FxPreview fx={fx} />;
  if (item.slot === 'avatar') return <div className="shop-prev"><Avatar name={name} seed={seed} style={fx} /></div>;
  if (item.slot === 'insignia') return <div className="shop-prev"><Badge fx={fx} size={46} /></div>;
  if (item.slot === 'sonido') return <div className="shop-prev"><button className="try" type="button" onClick={() => { ['key', 'key', 'key', 'space', 'key', 'key', 'err'].forEach((w, i) => setTimeout(() => playPack(fx, w as 'key'), i * 130)); setTimeout(() => playPack(fx, 'end'), 1100); }}>▶ escuchar</button></div>;
  if (item.slot === 'festejo') return <div className="shop-prev"><button className="try" type="button" onClick={() => celebrate('record', fx)}>▶ probar</button></div>;
  if (item.slot === 'fondo') return <div className="shop-prev bg-prev" data-bg={fx}><button className="try" type="button" onClick={() => window.dispatchEvent(new CustomEvent('tecla:bg-preview', { detail: fx }))}>▶ probar 8 s</button></div>;
  if (item.slot === 'cursor') return <div className="shop-prev" data-caret-prev={fx}><span className="caret-demo">te<span className="caret" style={{ position: 'relative', display: 'inline-block', verticalAlign: 'top' }} />cla</span></div>;
  if (item.slot === 'acento') { const p = PREMIUM.find(a => a.item === item.id); return <div className="shop-prev"><span className="sw-big" style={{ background: p?.color }} /></div>; }
  if (item.slot === 'marco') return <div className="shop-prev"><div className="avatar" data-frame={fx}><span>{name[0]?.toUpperCase() || 'V'}</span></div></div>;
  if (item.slot === 'titulo') return <div className="shop-prev"><span className="ptitle">{item.name}</span></div>;
  const c = SKIN_COLORS[fx] || 'var(--accent)';
  return (
    <div className="shop-prev" style={{ opacity: fx === 'fantasma' ? 0.6 : 1 }}>
      <svg width="40" height="50" viewBox="0 0 40 50" aria-hidden="true">
        <defs><linearGradient id="rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F0735F" /><stop offset=".5" stopColor="#1DB386" /><stop offset="1" stopColor="#8A7BF4" /></linearGradient></defs>
        <g stroke={c} strokeWidth="3" strokeLinecap="round" fill="none"><circle cx="20" cy="9" r="6" fill={c} /><path d="M20 16v16M20 32l-8 14M20 32l8 14M20 21l-9 7M20 21l9-5" /></g>
      </svg>
    </div>
  );
}

export default function ShopView() {
  const shop = useShop();
  const [slot, setSlot] = useState<'todo' | Slot>('todo');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [log, setLog] = useState<{ amount: number; reason: string; created_at: string }[] | null>(null);
  const [name, setName] = useState('vos');
  const [seed, setSeed] = useState('vos');
  const [sound, setSound] = useState('off');
  useEffect(() => setSound(testSound()), []);
  const st = shop.state, items = shop.items || [];

  // movimientos recientes y nombre (para la vista previa del marco)
  useEffect(() => {
    import('@/lib/tecla/history').then(({ History }) => { const u = History.user; setName(u?.name || 'vos'); setSeed(u?.username || u?.id || 'vos'); });
    const sb = getSupabase(); if (!sb || !shop.signedIn) return;
    sb.from('coin_log').select('amount, reason, created_at').order('created_at', { ascending: false }).limit(12).then(({ data }) => setLog(data || []));
  }, [shop.signedIn, st?.balance]);

  const shown = useMemo(() => items.filter(i => slot === 'todo' || i.slot === slot), [items, slot]);
  const theme = typeof window !== 'undefined' ? readTheme() : null;

  const buy = async (it: ShopItem) => {
    setBusy(it.id); setMsg('');
    const err = await shop.buy(it.id);
    setBusy(null); setMsg(err ? err : `* compraste ${it.name}`);
  };
  const equip = async (it: ShopItem, on: boolean) => {
    setBusy(it.id); setMsg('');
    if (it.slot === 'acento') {
      // los colores se usan desde el tema (también en este navegador)
      const p = PREMIUM.find(a => a.item === it.id);
      applyTheme({ ...readTheme(), accent: on && p ? p.key : 'celeste' });
    }
    if (it.slot === 'sonido') { const v = on ? EFFECT[it.id] : 'off'; setTestSound(v); setSound(v); }
    const err = await shop.equip(it.slot, on ? it.id : null);
    setBusy(null); if (err) setMsg(err);
  };

  const header = (
    <PageHeader eyebrow="* — solo estética, se paga con teclas*" title="tienda">
      {st && <span className="wallet" title="tus teclas*">✱ <b>{st.balance.toLocaleString('es')}</b> teclas*</span>}
      <Tabs items={[{ id: 'todo', label: 'todo' }, ...SLOTS.map(s => ({ id: s.id, label: s.name }))]} value={slot} onChange={id => setSlot(id as 'todo' | Slot)} label="categorías" />
    </PageHeader>
  );

  if (shop.missing) return <>{header}<div className="panel"><p className="sub">La tienda todavía no está activada en la base de datos (falta aplicar la migración de la tienda).</p></div></>;

  return (
    <>
      {header}
      <div className="shop-body">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          {slot !== 'todo' && <p className="sub" style={{ margin: 0 }}>{SLOTS.find(s => s.id === slot)?.where}</p>}
          {msg && <p className={'msg' + (msg.startsWith('*') ? '' : ' err')}>{msg}</p>}
          {!items.length && <p className="hint">cargando la tienda…</p>}
          <div className="shop-grid">
            {shown.map(it => {
              const owned = !!st?.owned.includes(it.id);
              const on = it.slot === 'acento' ? owned && PREMIUM.find(a => a.item === it.id)?.key === theme?.accent
                : it.slot === 'sonido' ? owned && sound === EFFECT[it.id] : st?.equipped[it.slot] === it.id;
              const short = !!st && st.balance < it.price;
              return (
                <div key={it.id} className={'shop-card' + (owned ? ' owned' : '') + (on ? ' on' : '')}>
                  <span className={'rar ' + it.rarity}>{RARITY_NAMES[it.rarity]}</span>
                  <Preview item={it} name={name} seed={seed} />
                  <b>{it.name}</b>
                  <div className="row">
                    {owned ? <span className="hint">{on ? 'en uso' : 'es tuyo'}</span> : <span className="price">✱ {it.price}</span>}
                    {!st ? null
                      : owned ? <button className={'btn' + (on ? ' ghost' : ' primary')} type="button" disabled={busy === it.id} onClick={() => equip(it, !on)}>{on ? 'sacar' : it.slot === 'acento' || it.slot === 'sonido' ? 'usar' : 'equipar'}</button>
                        : <button className="btn primary" type="button" disabled={busy === it.id || short} title={short ? `te faltan ${it.price - st.balance}` : ''} onClick={() => buy(it)}>{busy === it.id ? '…' : short ? `faltan ${it.price - st.balance}` : 'comprar'}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="panel shop-side">
          {!shop.signedIn ? (
            <>
              <span className="eyebrow">teclas*</span>
              <p className="sub">Las teclas* se ganan jugando con tu cuenta y se guardan en ella.</p>
              <Link className="btn primary" href="/login">entrar para ganar teclas*</Link>
            </>
          ) : st && (
            <>
              <span className="eyebrow">hoy</span>
              <p className="sub" style={{ margin: 0 }}>ganaste {st.earnedToday} de {st.cap} teclas* posibles</p>
              <div className="progress"><i style={{ width: `${Math.min(100, st.earnedToday / st.cap * 100)}%` }} /></div>
            </>
          )}
          <span className="eyebrow">cómo se ganan</span>
          <div className="shop-log">
            {EARN.map(([k, v, d]) => <div key={k}><span><b>{k}</b> · <span className="hint">{d}</span></span><span>{v}</span></div>)}
            <div><span><b>bonus</b> · <span className="hint">primera partida del día</span></span><span>+10</span></div>
          </div>
          <p className="hint" style={{ textAlign: 'left', margin: 0 }}>Como mucho 250 por día, y las partidas tienen que estar separadas por al menos 15 segundos.</p>
          {log && log.length > 0 && (
            <>
              <span className="eyebrow">últimos movimientos</span>
              <div className="shop-log">{log.map((l, i) => <div key={i}><span>{l.reason}</span><span className={l.amount > 0 ? 'plus' : 'minus'}>{l.amount > 0 ? '+' : ''}{l.amount}</span></div>)}</div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
