import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EFFECT, SLOTS } from '@/lib/shop/catalog';
import { PREMIUM } from '@/lib/theme';

// el catálogo vive en la migración (la base decide precios); la página tiene que saber dibujar cada objeto
const sql = readFileSync(resolve(process.cwd(), '../backend/supabase/migrations/20260926120000_shop.sql'), 'utf8');
const items = [...sql.matchAll(/\('([a-z0-9-]+)',\s*'(cursor|acento|marco|titulo|runner)',\s*'([^']+)',\s*(\d+),\s*'(comun|rara|epica)'/g)]
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
