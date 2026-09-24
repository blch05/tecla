/* Tienda: cómo se ve cada objeto. El precio y si existe los decide la base (shop_items);
   acá solo está lo visual, indexado por id. Todo es estético: nada da ventaja. */

export type Slot = 'cursor' | 'acento' | 'marco' | 'titulo' | 'runner';
export type Rarity = 'comun' | 'rara' | 'epica';
export interface ShopItem { id: string; slot: Slot; name: string; price: number; rarity: Rarity; sort: number }

export const SLOTS: { id: Slot; name: string; where: string }[] = [
  { id: 'cursor', name: 'cursores', where: 'el cursor de la caja de tipeo' },
  { id: 'acento', name: 'colores', where: 'el color de acento de toda la página (se elige en el tema)' },
  { id: 'marco', name: 'marcos', where: 'el borde de tu avatar en el perfil (lo ven los demás)' },
  { id: 'titulo', name: 'títulos', where: 'el título bajo tu nombre en el perfil (lo ven los demás)' },
  { id: 'runner', name: 'runner', where: 'tu corredor en el runner' },
];
export const RARITY_NAMES: Record<Rarity, string> = { comun: 'común', rara: 'rara', epica: 'épica' };

/* los colores de acento que se compran están en lib/theme (PREMIUM) */

/** El valor que se aplica en la página para cada objeto equipado (atributos en <html> o en el avatar). */
export const EFFECT: Record<string, string> = {
  'cursor-grueso': 'grueso', 'cursor-bloque': 'bloque', 'cursor-subrayado': 'subrayado', 'cursor-arcoiris': 'arcoiris',
  'marco-punteado': 'punteado', 'marco-doble': 'doble', 'marco-neon': 'neon', 'marco-arcoiris': 'arcoiris',
  'runner-rojo': 'rojo', 'runner-fantasma': 'fantasma', 'runner-dorado': 'dorado', 'runner-arcoiris': 'arcoiris',
};

/** Texto de los títulos (el nombre del objeto es el título). */
export const titleOf = (items: ShopItem[], id?: string | null) => (id ? items.find(i => i.id === id)?.name ?? null : null);
