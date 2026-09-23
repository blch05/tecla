import { clampGarbage, decideEnd, participants, pickEliminated, resolveColor, standings, type RoomPlayer } from '@/lib/roomLogic';

const P = (id: string, over: Partial<RoomPlayer> = {}): RoomPlayer => ({ id, color: '', joinedAt: 0, round: 1, alive: true, ...over });
const roster = (...ids: string[]) => ids.map(id => ({ id }));

describe('participants', () => {
  it('solo cuenta a los de la lista de la ronda y en la ronda actual', () => {
    const players = [P('a'), P('b', { round: 0 }), P('c')];
    expect(participants(players, roster('a', 'b'), 1).map(p => p.id)).toEqual(['a']);
  });
});

describe('decideEnd (último en pie)', () => {
  it('sigue mientras haya 2 o más vivos', () => {
    expect(decideEnd([P('a'), P('b'), P('c', { alive: false })], roster('a', 'b', 'c'), 1)).toEqual({ end: false, winner: null });
  });
  it('gana el último vivo', () => {
    expect(decideEnd([P('a', { alive: false }), P('b')], roster('a', 'b'), 1)).toEqual({ end: true, winner: 'b' });
  });
  it('si caen todos a la vez, termina sin ganador', () => {
    expect(decideEnd([P('a', { alive: false }), P('b', { alive: false })], roster('a', 'b'), 1)).toEqual({ end: true, winner: null });
  });
  it('si se desconecta el rival, el que queda gana', () => {
    expect(decideEnd([P('a')], roster('a', 'b'), 1)).toEqual({ end: true, winner: 'a' });
  });
  it('si se desconectan todos, termina', () => {
    expect(decideEnd([], roster('a', 'b'), 1).end).toBe(true);
  });
  it('jugando solo: sigue mientras esté vivo y termina al morir, sin ganador', () => {
    expect(decideEnd([P('a')], roster('a'), 1)).toEqual({ end: false, winner: null });
    expect(decideEnd([P('a', { alive: false })], roster('a'), 1)).toEqual({ end: true, winner: null });
  });
  it('al arrancar, un rival conectado que todavía no se actualizó cuenta como vivo (no hay ganador instantáneo)', () => {
    expect(decideEnd([P('a'), P('b', { round: 0 })], roster('a', 'b'), 1)).toEqual({ end: false, winner: null });
  });
  it('jugando solo, antes de que llegue mi propia actualización la ronda no termina', () => {
    expect(decideEnd([P('a', { round: 0 })], roster('a'), 1)).toEqual({ end: false, winner: null });
  });
  it('si el que quedaba atrasado se desconecta, gana el que queda', () => {
    expect(decideEnd([P('a')], roster('a', 'b'), 1)).toEqual({ end: true, winner: 'a' });
  });
});

describe('pickEliminated (battle royale)', () => {
  it('sale el que menos letras escribió en la ronda cerrada', () => {
    const players = [P('a', { rr: 1, rc: 50 }), P('b', { rr: 1, rc: 20 }), P('c', { rr: 1, rc: 35 })];
    expect(pickEliminated(players, roster('a', 'b', 'c'), 1, 1)).toBe('b');
  });
  it('quien no reportó la ronda cuenta como 0', () => {
    const players = [P('a', { rr: 1, rc: 5 }), P('b', { rr: 0, rc: 999 })];
    expect(pickEliminated(players, roster('a', 'b'), 1, 1)).toBe('b');
  });
  it('empate: sale el que llegó último a la sala (resultado estable)', () => {
    const players = [P('a', { rr: 2, rc: 10, joinedAt: 1 }), P('b', { rr: 2, rc: 10, joinedAt: 5 })];
    expect(pickEliminated(players, roster('a', 'b'), 1, 2)).toBe('b');
    expect(pickEliminated([...players].reverse(), roster('a', 'b'), 1, 2)).toBe('b');
  });
  it('letras negativas (datos raros) se tratan como 0', () => {
    const players = [P('a', { rr: 1, rc: -500 }), P('b', { rr: 1, rc: 1 })];
    expect(pickEliminated(players, roster('a', 'b'), 1, 1)).toBe('a');
  });
  it('con un solo vivo o ninguno no elimina a nadie', () => {
    expect(pickEliminated([P('a')], roster('a'), 1, 1)).toBeNull();
    expect(pickEliminated([P('a', { alive: false }), P('b')], roster('a', 'b'), 1, 1)).toBeNull();
    expect(pickEliminated([], roster('a', 'b'), 1, 1)).toBeNull();
  });
  it('nunca elimina a alguien que ya estaba afuera', () => {
    const players = [P('a', { alive: false, rr: 1, rc: 0 }), P('b', { rr: 1, rc: 10 }), P('c', { rr: 1, rc: 20 })];
    expect(pickEliminated(players, roster('a', 'b', 'c'), 1, 1)).toBe('b');
  });
});

describe('resolveColor', () => {
  const pal = ['rojo', 'verde', 'azul'];
  it('sin color toma el primero libre', () => {
    expect(resolveColor(P('b', { joinedAt: 2 }), [P('a', { color: 'rojo', joinedAt: 1 }), P('b', { joinedAt: 2 })], pal)).toBe('verde');
  });
  it('si choca con alguien que llegó antes, cambia', () => {
    const me = P('b', { color: 'rojo', joinedAt: 2 });
    expect(resolveColor(me, [P('a', { color: 'rojo', joinedAt: 1 }), me], pal)).toBe('verde');
  });
  it('si choca con alguien que llegó después, se queda (cambia el otro)', () => {
    const me = P('a', { color: 'rojo', joinedAt: 1 });
    expect(resolveColor(me, [me, P('b', { color: 'rojo', joinedAt: 2 })], pal)).toBeNull();
  });
  it('un color que no está en la paleta se reemplaza', () => {
    expect(resolveColor(P('a', { color: '#hack' }), [P('a', { color: '#hack' })], pal)).toBe('rojo');
  });
  it('con la paleta llena devuelve algún color en vez de fallar', () => {
    const others = pal.map((c, i) => P('x' + i, { color: c, joinedAt: i }));
    const me = P('z', { joinedAt: 99 });
    expect(pal).toContain(resolveColor(me, [...others, me], pal));
  });
});

describe('standings', () => {
  it('vivos primero, después el que cayó más tarde, y por puntos', () => {
    const players = [P('a', { alive: false, deadAt: 100 }), P('b', { alive: false, deadAt: 300 }), P('c', { score: 5 }), P('d', { score: 50 })];
    expect(standings(players, roster('a', 'b', 'c', 'd'), 1).map(p => p.id)).toEqual(['d', 'c', 'b', 'a']);
  });
});

describe('clampGarbage', () => {
  it.each([[1, 1], [2, 2], [3, 3], [1000, 3], [0, 1], [-5, 1], ['2', 2], ['hack', 1], [null, 1], [2.9, 2]])('%p → %p', (inp, out) => {
    expect(clampGarbage(inp)).toBe(out);
  });
});
