import { newestMetas, RoomMembers, sameMembers } from '@/lib/roomSync';

type P = { id: string; joinedAt: number; v?: number; progress?: number };
const p = (id: string, joinedAt: number, v: number, progress = 0): P => ({ id, joinedAt, v, progress });

describe('RoomMembers', () => {
  it('un jugador que desaparece un instante de la presencia sigue en la sala (el "salió + entró" de cada actualización)', () => {
    const m = new RoomMembers<P>(5000);
    m.presence([p('a', 1, 1), p('b', 2, 1)], 1000);
    m.presence([p('a', 1, 1)], 1200); // llegó el "salió" de b antes que su "entró"
    expect(m.list(1300).map(x => x.id)).toEqual(['a', 'b']);
    m.presence([p('a', 1, 1), p('b', 2, 2)], 1400);
    expect(m.list(1500).map(x => x.id)).toEqual(['a', 'b']);
  });

  it('si se fue de verdad, sale de la lista pasado el margen', () => {
    const m = new RoomMembers<P>(5000);
    m.presence([p('a', 1, 1), p('b', 2, 1)], 0);
    m.presence([p('a', 1, 1)], 100);
    expect(m.list(4000).map(x => x.id)).toEqual(['a', 'b']);
    expect(m.list(5200).map(x => x.id)).toEqual(['a']);
    expect(m.get('b')).toBeUndefined();
  });

  it('los estados por broadcast lo mantienen vivo aunque la presencia no lo muestre', () => {
    const m = new RoomMembers<P>(5000);
    m.presence([p('a', 1, 1), p('b', 2, 1)], 0);
    m.presence([p('a', 1, 1)], 100);
    for (let t = 1000; t <= 20000; t += 1000) m.state(p('b', 2, t, t / 20000), t);
    expect(m.list(20500).find(x => x.id === 'b')?.progress).toBe(1);
  });

  it('gana siempre la versión más nueva, venga de la presencia o del broadcast', () => {
    const m = new RoomMembers<P>();
    m.state(p('b', 2, 5, 0.5), 0);
    m.presence([p('b', 2, 3, 0.2)], 10); // presencia vieja que llega tarde
    expect(m.get('b')?.progress).toBe(0.5);
    m.presence([p('b', 2, 6, 0.6)], 20);
    expect(m.get('b')?.progress).toBe(0.6);
    m.state(p('b', 2, 4, 0.3), 30); // broadcast desordenado
    expect(m.get('b')?.progress).toBe(0.6);
  });

  it('ordena por llegada y desempata por id (mismo anfitrión en todos lados)', () => {
    const m = new RoomMembers<P>();
    m.presence([p('z', 5, 1), p('b', 3, 1), p('a', 3, 1)], 0);
    expect(m.list(0).map(x => x.id)).toEqual(['a', 'b', 'z']);
  });

  it('ignora estados sin id', () => {
    const m = new RoomMembers<P>();
    m.state(null as unknown as P);
    m.state({ joinedAt: 1 } as unknown as P);
    expect(m.list()).toEqual([]);
  });
});

describe('helpers', () => {
  it('newestMetas toma la última meta de cada clave (la más nueva)', () => {
    expect(newestMetas({ a: [p('a', 1, 1), p('a', 1, 2)], b: [p('b', 2, 1)], c: [] })).toEqual([p('a', 1, 2), p('b', 2, 1)]);
  });
  it('sameMembers compara ids y versiones', () => {
    expect(sameMembers([p('a', 1, 1)], [p('a', 1, 1)])).toBe(true);
    expect(sameMembers([p('a', 1, 1)], [p('a', 1, 2)])).toBe(false);
    expect(sameMembers([p('a', 1, 1)], [])).toBe(false);
  });
});
