/* Estado compartido de una sala online, armado con dos fuentes:
   - presencia de Supabase: quién está (pero cada actualización es un "salió + entró", y a veces
     llegan separados o fuera de orden, así que un jugador puede desaparecer un instante)
   - broadcast "st": el estado de juego de cada uno (progreso, vidas, puntos), más liviano y frecuente
   Cada estado lleva un número de versión `v`: gana siempre el más nuevo, venga de donde venga.
   Un jugador que deja de verse sigue en la lista `grace` ms antes de darlo por ido. */

export interface Synced { id: string; joinedAt: number; v?: number }

export class RoomMembers<T extends Synced> {
  private known = new Map<string, T>();
  private lastSeen = new Map<string, number>();
  private inPresence = new Set<string>();

  constructor(private grace = 5000) {}

  private merge(p: T) {
    const cur = this.known.get(p.id);
    if (!cur || (p.v ?? 0) >= (cur.v ?? 0)) this.known.set(p.id, cur ? { ...cur, ...p } : p);
  }

  /** Lista completa de la presencia (cada vez que se sincroniza). */
  presence(list: T[], now = Date.now()) {
    this.inPresence = new Set(list.map(p => p.id));
    for (const p of list) { this.merge(p); this.lastSeen.set(p.id, now); }
  }

  /** Estado recibido por broadcast: también prueba que el jugador sigue conectado. */
  state(p: T, now = Date.now()) {
    if (!p || typeof p.id !== 'string') return;
    this.merge(p); this.lastSeen.set(p.id, now);
  }

  /** Jugadores en la sala: los de la presencia y los que se vieron hace menos de `grace` ms. */
  list(now = Date.now()): T[] {
    const out: T[] = [];
    for (const [id, p] of this.known) {
      const seen = this.lastSeen.get(id) ?? 0;
      if (this.inPresence.has(id) || now - seen < this.grace) out.push(p);
      else { this.known.delete(id); this.lastSeen.delete(id); }
    }
    return out.sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
  }

  get(id: string) { return this.known.get(id); }
}

/** Metas de la presencia: si hay varias para una clave, la última es la más nueva. */
export const newestMetas = <T>(state: Record<string, T[]>) =>
  Object.values(state).map(a => a[a.length - 1]).filter(Boolean) as T[];

/** ¿Cambió la lista lo suficiente como para volver a dibujar? */
export const sameMembers = <T extends Synced>(a: T[], b: T[]) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && p.v === b[i].v);
