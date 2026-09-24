'use client';

/* Tienda del lado del navegador: saldo, catálogo, inventario y lo equipado.
   Todo lo que cambia saldo o inventario pasa por funciones de la base (buy_item, equip_item);
   acá solo se lee, se pide y se aplica lo equipado a la página. */
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { EFFECT, type ShopItem, type Slot } from '@/lib/shop/catalog';

export interface ShopState { balance: number; earnedToday: number; cap: number; owned: string[]; equipped: Partial<Record<Slot, string>> }
type Listener = () => void;
const COS_KEY = 'tecla:cos'; // lo equipado, para aplicarlo antes de pintar (ver THEME_BOOT)

export const Shop = {
  state: null as ShopState | null,
  items: null as ShopItem[] | null,
  signedIn: false,
  missing: false, // la migración de la tienda todavía no está aplicada
  listeners: new Set<Listener>(),
  started: false,

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; },
  changed() { this.listeners.forEach(fn => fn()); },

  init() {
    if (this.started || typeof window === 'undefined') return; this.started = true;
    if (process.env.NODE_ENV !== 'production') (window as any).__teclaShop = this; // depuración en desarrollo
    import('@/lib/tecla/history').then(({ History }) => {
      const sync = () => {
        const on = !!History.user && History.mode === 'cloud';
        if (on === this.signedIn) return;
        this.signedIn = on;
        if (on) this.load(); else { this.state = null; this.apply(); this.changed(); }
      };
      History.subscribe(sync); sync();
    });
    // al guardarse partidas, la base acredita teclas*: avisar cuánto se ganó
    window.addEventListener('tecla:runs-saved', async () => {
      if (!this.signedIn) return;
      const before = this.state?.balance ?? null;
      await this.load();
      const after = this.state?.balance ?? null;
      if (before != null && after != null && after > before) {
        const { toast } = await import('@/lib/tecla/utils');
        toast(`+${after - before} teclas*`);
      }
    });
    this.loadItems();
  },

  async loadItems() {
    const sb = getSupabase(); if (!sb) return;
    const { data, error } = await sb.from('shop_items').select('id, slot, name, price, rarity, sort').eq('active', true).order('sort');
    if (error) { this.missing = true; this.changed(); return; }
    this.items = (data as ShopItem[]) || []; this.changed();
  },

  async load() {
    const sb = getSupabase(); if (!sb) return;
    const { data, error } = await sb.rpc('shop_state');
    if (error) { this.missing = /shop_state|function/.test(error.message); this.changed(); return; }
    const d = (data || {}) as { balance?: number; earned_today?: number; cap?: number; owned?: string[]; equipped?: Record<string, string> };
    this.state = { balance: d.balance ?? 0, earnedToday: d.earned_today ?? 0, cap: d.cap ?? 250, owned: d.owned ?? [], equipped: (d.equipped ?? {}) as ShopState['equipped'] };
    this.apply(); this.changed();
  },

  owns(id: string) { return !!this.state?.owned.includes(id); },

  async buy(id: string): Promise<string | null> {
    const sb = getSupabase(); if (!sb) return 'Falta conectar Supabase.';
    const { data, error } = await sb.rpc('buy_item', { p_item: id });
    if (error) return error.message;
    const r = data as { ok: boolean; error?: string };
    await this.load();
    return r.ok ? null : r.error || 'No se pudo comprar.';
  },

  async equip(slot: Slot, id: string | null): Promise<string | null> {
    const sb = getSupabase(); if (!sb) return 'Falta conectar Supabase.';
    const { data, error } = await sb.rpc('equip_item', { p_slot: slot, p_item: id });
    if (error) return error.message;
    const r = data as { ok: boolean; error?: string };
    await this.load();
    return r.ok ? null : r.error || 'No se pudo equipar.';
  },

  /** Aplica lo equipado a la página (y lo guarda para el próximo arranque). */
  apply() {
    if (typeof document === 'undefined') return;
    const eq = this.state?.equipped || {};
    const cos = { caret: EFFECT[eq.cursor || ''] || '', runner: EFFECT[eq.runner || ''] || '' };
    const d = document.documentElement;
    if (cos.caret) d.dataset.caret = cos.caret; else delete d.dataset.caret;
    try { if (this.state) localStorage.setItem(COS_KEY, JSON.stringify(cos)); else localStorage.removeItem(COS_KEY); } catch {}
  },
};

/** Aspecto del corredor equipado (lo lee el canvas del runner). */
export function runnerSkin(): string {
  try { return JSON.parse(localStorage.getItem(COS_KEY) || '{}').runner || ''; } catch { return ''; }
}

/** La tienda como hook de React. */
export function useShop() {
  const [, bump] = useState(0);
  useEffect(() => { Shop.init(); return Shop.subscribe(() => bump(x => x + 1)); }, []);
  return Shop;
}
