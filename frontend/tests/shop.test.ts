import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EFFECT, SLOTS } from '@/lib/shop/catalog';
import { PREMIUM } from '@/lib/theme';

// el catálogo vive en la migración (la base decide precios); la página tiene que saber dibujar cada objeto
const mig = (f: string) => readFileSync(resolve(process.cwd(), '../backend/supabase/migrations/' + f), 'utf8');
const sql = mig('20260926120000_shop.sql') + mig('20260927120000_shop_more.sql');
const items = [...sql.matchAll(/\('([a-z0-9-]+)',\s*'(\w+)',\s*'([^']+)',\s*(\d+),\s*'(comun|rara|epica)'/g)]
  .map(m => ({ id: m[1], slot: m[2], name: m[3], price: +m[4], rarity: m[5] }));

describe('catálogo de la tienda', () => {
  it('la migración trae objetos de todas las categorías', () => {
    expect(items.length).toBeGreaterThanOrEqual(15);
    for (const s of SLOTS) expect(items.some(i => i.slot === s.id)).toBe(true);
  });
  it('cada objeto tiene cómo verse en la página', () => {
    for (const it of items) {
      if (it.slot === 'acento') expect(PREMIUM.some(p => p.item === it.id)).toBe(true);
      else if (it.slot !== 'titulo') expect(EFFECT[it.id], it.id).toBeTruthy();
    }
  });
  it('ids únicos, precios positivos y las épicas son las más caras de su categoría', () => {
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
    for (const it of items) expect(it.price).toBeGreaterThan(0);
    for (const s of SLOTS) {
      const of = items.filter(i => i.slot === s.id), epic = of.filter(i => i.rarity === 'epica');
      for (const e of epic) for (const o of of.filter(i => i.rarity !== 'epica')) expect(e.price).toBeGreaterThan(o.price);
    }
  });
  it('todos los colores que se compran están en el catálogo', () => {
    for (const p of PREMIUM) expect(items.some(i => i.id === p.item)).toBe(true);
  });
});

describe('tienda: segunda tanda', () => {
  it('los lugares que acepta la base son los mismos que conoce la página', () => {
    const more = mig('20260927120000_shop_more.sql');
    const lists = [...more.matchAll(/slot (?:not )?in\s*\(([^)]+)\)/g)].map(m => [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]).sort())
      .filter(l => l.length > 4); // la de public_cosmetics es a propósito un subconjunto: solo lo que ven los demás
    expect(lists.length).toBeGreaterThanOrEqual(3);
    for (const l of lists) expect(l).toEqual(SLOTS.map(s => s.id).sort());
  });
  it('cada paquete de sonido tiene su archivo y cada efecto sabe dibujarse', async () => {
    const { existsSync } = await import('node:fs');
    const { PACKS } = await import('@/lib/shop/sounds');
    const { BADGE_IDS } = await import('@/lib/shop/badges');
    const { FONTS } = await import('@/lib/shop/fonts');
    const { FONT_FAMILIES } = await import('@/lib/theme');
    for (const it of items) {
      const fx = EFFECT[it.id];
      if (it.slot === 'sonido') { expect(PACKS[fx], it.id).toBeTruthy(); expect(existsSync(resolve(process.cwd(), `public/sounds/${fx}.wav`))).toBe(true); }
      if (it.slot === 'insignia') expect(BADGE_IDS).toContain(fx);
      if (it.slot === 'fuente') { expect(FONTS[fx], it.id).toBeTruthy(); expect(FONT_FAMILIES[fx]).toBeTruthy(); }
    }
  });
});

describe('paletas generadas (culori)', () => {
  it('arma colores hex válidos y fondos claros en modo claro', async () => {
    const { palette } = await import('@/lib/shop/palette');
    const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return (r + g + b) / 3; };
    for (const p of PREMIUM.filter(x => x.gen)) {
      const v = palette(p.color, 'light');
      for (const k of ['--accent', '--accent-2', '--soft', '--dim', '--line', '--pat']) expect(v[k], p.key + k).toMatch(/^#[0-9a-f]{6}$/i);
      expect(lum(v['--soft'])).toBeGreaterThan(240);
      expect(lum(v['--accent-2'])).toBeGreaterThan(lum(v['--accent']));
      const d = palette(p.color, 'dark');
      expect(Object.keys(d).sort()).toEqual(['--accent', '--accent-2']);
    }
  });
});

describe('insignias (Lottie)', () => {
  it('cada animación tiene capas, dura 2 s y los cuadros clave están en orden', async () => {
    const { badgeAnim, BADGE_IDS } = await import('@/lib/shop/badges');
    for (const id of BADGE_IDS) {
      const a = badgeAnim(id) as { fr: number; op: number; layers: { ks: Record<string, { a: number; k: { t: number }[] }>; shapes: unknown[] }[] };
      expect(a.op / a.fr).toBe(2);
      expect(a.layers.length).toBeGreaterThan(0);
      for (const l of a.layers) {
        expect(l.shapes.length).toBeGreaterThan(0);
        for (const p of Object.values(l.ks)) if (p.a) { const ts = p.k.map(k => k.t); expect(ts).toEqual([...ts].sort((x, y) => x - y)); expect(ts.at(-1)).toBeLessThanOrEqual(a.op); }
      }
    }
    expect(badgeAnim('no-existe')).toBeNull();
  });
});
