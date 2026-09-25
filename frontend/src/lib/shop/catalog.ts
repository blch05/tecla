/* Tienda: cómo se ve cada objeto. El precio y si existe los decide la base (shop_items);
   acá solo está lo visual, indexado por id. Todo es estético: nada da ventaja. */

export type Slot = 'cursor' | 'acento' | 'marco' | 'titulo' | 'runner' | 'festejo' | 'sonido' | 'fuente' | 'fondo' | 'avatar' | 'insignia' | 'efecto';
export type Rarity = 'comun' | 'rara' | 'epica';
export interface ShopItem { id: string; slot: Slot; name: string; price: number; rarity: Rarity; sort: number }

export const SLOTS: { id: Slot; name: string; where: string }[] = [
  { id: 'cursor', name: 'cursores', where: 'el cursor de la caja de tipeo' },
  { id: 'acento', name: 'colores', where: 'el color de acento de toda la página (se elige en el tema)' },
  { id: 'fuente', name: 'tipografías', where: 'la letra de la caja de tipeo' },
  { id: 'sonido', name: 'sonidos', where: 'el sonido del teclado en el test (se elige con ♪)' },
  { id: 'festejo', name: 'festejos', where: 'lo que salta al terminar un test, batir un récord o ganar' },
  { id: 'fondo', name: 'fondos', where: 'un fondo animado detrás de toda la página' },
  { id: 'efecto', name: 'efectos', where: 'las explosiones al destruir palabras en el arcade' },
  { id: 'marco', name: 'marcos', where: 'el borde de tu avatar en el perfil (lo ven los demás)' },
  { id: 'avatar', name: 'avatares', where: 'tu avatar en el perfil, generado a partir de tu cuenta (lo ven los demás)' },
  { id: 'insignia', name: 'insignias', where: 'una insignia animada junto a tu nombre (la ven los demás)' },
  { id: 'titulo', name: 'títulos', where: 'el título bajo tu nombre en el perfil (lo ven los demás)' },
  { id: 'runner', name: 'runner', where: 'tu corredor en el runner' },
];
export const RARITY_NAMES: Record<Rarity, string> = { comun: 'común', rara: 'rara', epica: 'épica' };

/* los colores de acento que se compran están en lib/theme (PREMIUM) */

/** El valor que se aplica en la página para cada objeto equipado. */
export const EFFECT: Record<string, string> = {
  'cursor-grueso': 'grueso', 'cursor-bloque': 'bloque', 'cursor-subrayado': 'subrayado', 'cursor-arcoiris': 'arcoiris',
  'marco-punteado': 'punteado', 'marco-doble': 'doble', 'marco-neon': 'neon', 'marco-arcoiris': 'arcoiris',
  'runner-rojo': 'rojo', 'runner-fantasma': 'fantasma', 'runner-dorado': 'dorado', 'runner-arcoiris': 'arcoiris',
  'festejo-confeti': 'confeti', 'festejo-asteriscos': 'asteriscos', 'festejo-estrellas': 'estrellas', 'festejo-fuegos': 'fuegos',
  'sonido-cremoso': 'cremoso', 'sonido-azul': 'azul', 'sonido-burbujas': 'burbujas', 'sonido-retro': 'retro', 'sonido-antigua': 'antigua',
  'fuente-jetbrains': 'jetbrains', 'fuente-fira': 'fira', 'fuente-space': 'space', 'fuente-courier': 'courier', 'fuente-vt323': 'vt323',
  'fondo-nieve': 'nieve', 'fondo-estrellas': 'estrellas', 'fondo-burbujas': 'burbujas', 'fondo-luciernagas': 'luciernagas',
  'avatar-pixel': 'pixel', 'avatar-formas': 'formas', 'avatar-pulgar': 'pulgar', 'avatar-lorelei': 'lorelei', 'avatar-robot': 'robot',
  'insignia-estrella': 'estrella', 'insignia-rayo': 'rayo', 'insignia-corazon': 'corazon', 'insignia-corona': 'corona',
  'efecto-chispas': 'chispas', 'efecto-neon': 'neon', 'efecto-pixeles': 'pixeles', 'efecto-supernova': 'supernova',
};

/** Texto de los títulos (el nombre del objeto es el título). */
export const titleOf = (items: ShopItem[], id?: string | null) => (id ? items.find(i => i.id === id)?.name ?? null : null);
