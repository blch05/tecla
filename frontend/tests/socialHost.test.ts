import { act, canStart, MAX_TRIES, newGame, publicView, ranking, startRound, tick, TIMES, type GS } from '@/lib/social/host';
import { cellsOf } from '@/lib/social/logic';
import { rng } from '@/lib/tecla/utils';

const roster = [{ id: 'a', name: 'ana', color: '#111' }, { id: 'b', name: 'beto', color: '#222' }, { id: 'c', name: 'caro', color: '#333' }];
const T0 = 1_000_000;

describe('arranque', () => {
  it('pistas y tutti piden al menos 2 jugadores; oculta y sopa se juegan solos', () => {
    expect(canStart('pistas', 1)).toBe(false); expect(canStart('tutti', 2)).toBe(true);
    expect(canStart('oculta', 1)).toBe(true); expect(canStart('sopa', 1)).toBe(true);
  });
  it('empieza en la ronda 1 con todos en 0', () => {
    const gs = newGame('oculta', roster, 3, false, T0, rng(1));
    expect(gs.round).toBe(1); expect(gs.phase).toBe('playing');
    expect(gs.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(gs.until).toBe(T0 + TIMES.oculta);
  });
});

describe('estado público', () => {
  it('nunca manda los secretos', () => {
    const o = publicView(newGame('oculta', roster, 1, false, T0, rng(2)), T0);
    expect(o.o!.secret).toBeUndefined(); expect(JSON.stringify(o)).not.toContain('"used"');
    const s = publicView(newGame('sopa', roster, 1, false, T0, rng(2)), T0);
    expect(s.s!.placed).toBeUndefined(); expect(s.s!.grid).toHaveLength(12);
    const p = publicView(newGame('pistas', roster, 1, false, T0, rng(2)), T0);
    expect(p.p!.secret).toBeUndefined();
    const t0 = newGame('tutti', roster, 1, false, T0, rng(2));
    const t = act(t0, 'a', { type: 'fill', answers: ['mesa'] }, T0).gs;
    expect(publicView(t, T0).t!.answers).toBeUndefined();
  });
  it('left es el tiempo que queda', () => {
    const gs = newGame('oculta', roster, 1, false, T0, rng(3));
    expect(publicView(gs, T0 + 1000).left).toBe(TIMES.oculta - 1000);
  });
});

describe('palabra oculta', () => {
  it('responde las marcas solo a quien adivinó y rechaza intentos de otro largo', () => {
    const gs = newGame('oculta', roster, 1, false, T0, rng(4));
    const bad = act(gs, 'a', { type: 'guess', g: 'abc' }, T0);
    expect(bad.changed).toBe(false); expect(bad.reply?.payload.error).toBeTruthy();
    const ok = act(gs, 'a', { type: 'guess', g: 'zzzzz' }, T0);
    expect(ok.reply?.to).toBe('a'); expect(ok.gs.o!.rows.a).toHaveLength(1);
  });
  it('adivinar suma puntos y cuando todos terminan pasa a mostrar la palabra', () => {
    let gs = newGame('oculta', roster, 1, false, T0, rng(5));
    const secret = gs.o!.secret!;
    gs = act(gs, 'a', { type: 'guess', g: secret }, T0 + 5000).gs;
    expect(gs.roundPts.a).toBeGreaterThan(0);
    for (let i = 0; i < MAX_TRIES; i++) gs = act(gs, 'b', { type: 'guess', g: 'zzzzz' }, T0 + 6000).gs;
    expect(gs.phase).toBe('playing');
    // después del sexto intento no se aceptan más
    expect(act(gs, 'b', { type: 'guess', g: 'zzzzz' }, T0).changed).toBe(false);
    gs = act(gs, 'c', { type: 'guess', g: secret }, T0 + 100_000).gs;
    expect(gs.phase).toBe('reveal'); expect(gs.o!.reveal).toBeTruthy();
    expect(gs.scores.a).toBeGreaterThan(gs.scores.c); expect(gs.scores.b).toBe(0);
  });
  it('un jugador que no está en la ronda no puede jugar', () => {
    const gs = newGame('oculta', roster, 1, false, T0, rng(6));
    expect(act(gs, 'intruso', { type: 'guess', g: 'perro' }, T0).changed).toBe(false);
  });
});

describe('sopa de letras', () => {
  it('cada palabra es de quien la encuentra primero; al encontrar todas termina', () => {
    let gs = newGame('sopa', roster, 1, false, T0, rng(7));
    const placed = gs.s!.placed!;
    expect(placed.length).toBeGreaterThanOrEqual(8);
    const [first, ...rest] = placed; const cs = cellsOf(first);
    const pick = (p: typeof first) => { const c = cellsOf(p); return { type: 'pick' as const, r1: c[0][0], c1: c[0][1], r2: c[c.length - 1][0], c2: c[c.length - 1][1] }; };
    gs = act(gs, 'a', pick(first), T0).gs;
    expect(gs.s!.found[first.w].by).toBe('a');
    expect(act(gs, 'b', pick(first), T0).changed).toBe(false); // ya es de a
    expect(act(gs, 'b', { type: 'pick', r1: cs[0][0], c1: cs[0][1], r2: cs[1][0], c2: cs[1][1] }, T0).changed).toBe(false); // selección incompleta
    for (const p of rest) gs = act(gs, 'b', pick(p), T0).gs;
    expect(gs.phase).toBe('reveal');
    expect(gs.scores.a).toBe(first.w.length * 10);
  });
});

describe('pistas', () => {
  it('rota quién da las pistas, valida las pistas y premia al que adivina', () => {
    let gs = newGame('pistas', roster, 3, false, T0, rng(8));
    expect(gs.p!.giver).toBe('a');
    const secret = gs.p!.secret!;
    // antes de la primera pista no se puede adivinar; y solo el que da pistas puede darlas
    expect(act(gs, 'b', { type: 'answer', text: secret }, T0).changed).toBe(false);
    expect(act(gs, 'b', { type: 'clue', text: 'hola' }, T0).changed).toBe(false);
    const bad = act(gs, 'a', { type: 'clue', text: secret }, T0);
    expect(bad.changed).toBe(false); expect(bad.reply?.event).toBe('clue-error');
    gs = act(gs, 'a', { type: 'clue', text: 'zzzpista' }, T0).gs;
    gs = act(gs, 'b', { type: 'answer', text: 'otracosa' }, T0).gs;
    expect(gs.p!.guesses[0]).toMatchObject({ id: 'b', ok: false });
    gs = act(gs, 'c', { type: 'answer', text: secret.toUpperCase() }, T0).gs;
    expect(gs.phase).toBe('reveal'); expect(gs.p!.winner).toBe('c');
    expect(gs.scores.c).toBeGreaterThan(0); expect(gs.scores.a).toBeGreaterThan(0); expect(gs.scores.b).toBe(0);
    gs = tick(gs, gs.until, rng(9)).gs;
    expect(gs.round).toBe(2); expect(gs.p!.giver).toBe('b');
  });
  it('el que da pistas puede cambiar la palabra antes de la primera pista (hasta 2 veces)', () => {
    let gs = newGame('pistas', roster, 1, false, T0, rng(10));
    const w0 = gs.p!.secret;
    gs = act(gs, 'a', { type: 'skip' }, T0).gs; expect(gs.p!.secret).not.toBe(w0);
    gs = act(gs, 'a', { type: 'skip' }, T0).gs;
    expect(act(gs, 'a', { type: 'skip' }, T0).changed).toBe(false);
  });
  it('si nadie adivina, se muestra la palabra y no suma nadie', () => {
    let gs = newGame('pistas', roster, 1, false, T0, rng(11));
    gs = tick(gs, gs.until, rng(1)).gs;
    expect(gs.phase).toBe('reveal'); expect(gs.p!.reveal).toBeTruthy();
    expect(Object.values(gs.scores).every(v => v === 0)).toBe(true);
  });
});

describe('tutti frutti', () => {
  const fill = (gs: GS, id: string, answers: string[]) => act(gs, id, { type: 'fill', answers }, T0).gs;
  it('basta solo si completaste todo, y da 5 segundos', () => {
    let gs = newGame('tutti', roster, 1, false, T0, rng(12));
    const L = gs.t!.letter, n = gs.t!.cats.length;
    gs = fill(gs, 'a', Array(n - 1).fill(L + 'xx'));
    expect(act(gs, 'a', { type: 'basta' }, T0).changed).toBe(false);
    gs = fill(gs, 'a', Array(n).fill(L + 'xx'));
    gs = act(gs, 'a', { type: 'basta' }, T0).gs;
    expect(gs.t!.bastaBy).toBe('a'); expect(gs.until).toBe(T0 + TIMES.basta);
  });
  it('vota, cierra cuando todos están listos y suma los puntos', () => {
    let gs = newGame('tutti', roster, 2, false, T0, rng(13));
    const L = gs.t!.letter, n = gs.t!.cats.length;
    gs = fill(gs, 'a', Array.from({ length: n }, (_, i) => `${L}aa${i}`));
    gs = fill(gs, 'b', Array.from({ length: n }, (_, i) => `${L}aa${i}`)); // todas repetidas con a
    gs = fill(gs, 'c', [`${L}unica`]);
    gs = tick(gs, gs.until, rng(1)).gs;
    expect(gs.phase).toBe('vote'); expect(gs.t!.answers!.c[0]).toBe(`${L}unica`);
    // b y a votan en contra de la única de c: queda en 0
    gs = act(gs, 'a', { type: 'vote', cell: 'c:0', against: true }, T0).gs;
    gs = act(gs, 'b', { type: 'vote', cell: 'c:0', against: true }, T0).gs;
    expect(gs.t!.cell!['c:0']).toBe(0);
    // no se puede votar la propia
    expect(act(gs, 'c', { type: 'vote', cell: 'c:0', against: false }, T0).changed).toBe(false);
    for (const id of ['a', 'b', 'c']) gs = act(gs, id, { type: 'ready' }, T0 + 1000).gs;
    expect(gs.phase).toBe('reveal');
    expect(gs.scores).toEqual({ a: n * 5, b: n * 5, c: 0 });
  });
});

describe('fin de la partida', () => {
  it('después de la última ronda queda en "over" y el ranking ordena por puntos', () => {
    let gs = newGame('oculta', roster, 1, false, T0, rng(14));
    gs = act(gs, 'b', { type: 'guess', g: gs.o!.secret! }, T0).gs;
    gs = tick(gs, gs.until, rng(1)).gs; // se termina el tiempo → reveal
    expect(gs.phase).toBe('reveal');
    gs = tick(gs, gs.until, rng(1)).gs;
    expect(gs.phase).toBe('over');
    expect(ranking(gs)[0].id).toBe('b');
    expect(tick(gs, Number.MAX_SAFE_INTEGER, rng(1)).changed).toBe(false);
  });
  it('no repite palabras entre rondas', () => {
    let gs = newGame('oculta', roster, 5, false, T0, rng(15));
    const seen = new Set([gs.o!.secret]);
    for (let i = 0; i < 4; i++) { gs = startRound(gs, T0, rng(20 + i)); expect(seen.has(gs.o!.secret)).toBe(false); seen.add(gs.o!.secret); }
  });
});

describe('jugadores que se van a mitad de partida', () => {
  it('palabra oculta: si los que quedan ya terminaron, no se espera al que se fue', () => {
    let gs = newGame('oculta', roster, 1, false, T0, rng(30));
    const secret = gs.o!.secret!;
    gs = act(gs, 'a', { type: 'guess', g: secret }, T0, new Set(['a', 'b'])).gs;
    expect(gs.phase).toBe('playing'); // falta b
    gs = act(gs, 'b', { type: 'guess', g: secret }, T0, new Set(['a', 'b'])).gs;
    expect(gs.phase).toBe('reveal'); // c se fue: no se lo espera
  });
  it('palabra oculta: el reloj también cierra la ronda si el que faltaba se desconecta', () => {
    let gs = newGame('oculta', roster, 1, false, T0, rng(31));
    gs = act(gs, 'a', { type: 'guess', g: gs.o!.secret! }, T0).gs;
    gs = act(gs, 'b', { type: 'guess', g: gs.o!.secret! }, T0).gs;
    expect(tick(gs, T0 + 1000, rng(1)).changed).toBe(false); // con todos conectados, c todavía juega
    const r = tick(gs, T0 + 1000, rng(1), new Set(['a', 'b']));
    expect(r.changed).toBe(true); expect(r.gs.phase).toBe('reveal');
  });
  it('pistas: si se va el que da las pistas, se pasa de turno enseguida', () => {
    const gs = newGame('pistas', roster, 3, false, T0, rng(32));
    expect(gs.p!.giver).toBe('a');
    const r = tick(gs, T0 + 100, rng(1), new Set(['b', 'c']));
    expect(r.gs.phase).toBe('reveal');
    expect(Object.values(r.gs.scores).every(v => v === 0)).toBe(true);
  });
  it('pistas: la rueda salta a los que no están', () => {
    let gs = newGame('pistas', roster, 3, false, T0, rng(33));
    gs = tick(gs, gs.until, rng(1), new Set(['a', 'c'])).gs; // fin de la ronda 1 (se va b)
    gs = tick(gs, gs.until, rng(1), new Set(['a', 'c'])).gs; // arranca la 2: le tocaba a b
    expect(gs.round).toBe(2); expect(gs.p!.giver).toBe('c');
  });
  it('tutti: la votación cierra cuando están listos los que quedan', () => {
    let gs = newGame('tutti', roster, 1, false, T0, rng(34));
    gs = tick(gs, gs.until, rng(1)).gs;
    expect(gs.phase).toBe('vote');
    gs = act(gs, 'a', { type: 'ready' }, T0, new Set(['a', 'b'])).gs;
    expect(gs.phase).toBe('vote');
    gs = act(gs, 'b', { type: 'ready' }, T0, new Set(['a', 'b'])).gs;
    expect(gs.phase).toBe('reveal');
  });
  it('tutti: el que no escribió nada igual cuenta para la mayoría de la votación', () => {
    let gs = newGame('tutti', roster, 1, false, T0, rng(35));
    const L = gs.t!.letter;
    gs = act(gs, 'a', { type: 'fill', answers: [L + 'aaa'] }, T0).gs; // b y c no escriben nada
    gs = tick(gs, gs.until, rng(1)).gs;
    expect(Object.keys(gs.t!.answers!).sort()).toEqual(['a', 'b', 'c']);
    // un solo voto en contra (de 2 posibles) no alcanza
    gs = act(gs, 'b', { type: 'vote', cell: 'a:0', against: true }, T0).gs;
    expect(gs.t!.cell!['a:0']).toBe(10);
  });
  it('si no se sabe quién está (o no queda nadie), se usa el roster completo', () => {
    let gs = newGame('oculta', roster, 1, false, T0, rng(36));
    gs = act(gs, 'a', { type: 'guess', g: gs.o!.secret! }, T0, new Set()).gs;
    expect(gs.phase).toBe('playing');
  });
});

describe('entradas raras', () => {
  it('acciones mal formadas no rompen nada', () => {
    const gs = newGame('tutti', roster, 1, false, T0, rng(40));
    expect(act(gs, 'a', null as never, T0).changed).toBe(false);
    expect(act(gs, 'a', { type: 'vote', cell: 'sin-formato', against: true } as never, T0).changed).toBe(false);
    expect(act(gs, 'a', { type: 'fill', answers: 'no es lista' } as never, T0).changed).toBe(false);
    const big = act(gs, 'a', { type: 'fill', answers: ['x'.repeat(500), 1 as never, null as never] }, T0).gs;
    expect(big.t!.answers!.a[0]).toHaveLength(40); expect(big.t!.answers!.a[1]).toBe('1'); expect(big.t!.answers!.a[2]).toBe('');
  });
  it('en sopa, una selección fuera de la grilla no encuentra nada', () => {
    const gs = newGame('sopa', roster, 1, false, T0, rng(41));
    expect(act(gs, 'a', { type: 'pick', r1: -5, c1: 99, r2: 1e9, c2: NaN }, T0).changed).toBe(false);
  });
  it('en pistas, adivinar después de que ganó alguien no suma de nuevo', () => {
    let gs = newGame('pistas', roster, 1, false, T0, rng(42));
    gs = act(gs, 'a', { type: 'clue', text: 'zzzpista' }, T0).gs;
    gs = act(gs, 'b', { type: 'answer', text: gs.p!.secret! }, T0).gs;
    const before = { ...gs.scores };
    expect(act(gs, 'c', { type: 'answer', text: gs.p!.secret! }, T0).changed).toBe(false);
    expect(gs.scores).toEqual(before);
  });
  it('en la última ronda de pistas con 1 ronda, termina en over', () => {
    let gs = newGame('pistas', roster, 1, false, T0, rng(43));
    gs = tick(gs, gs.until, rng(1)).gs; gs = tick(gs, gs.until, rng(1)).gs;
    expect(gs.phase).toBe('over');
  });
});
