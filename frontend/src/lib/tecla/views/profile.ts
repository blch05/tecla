/* =========================================================
   vista: PERFIL — nivel, resumen, historial paginado y récords
   ========================================================= */
import { History, type Run } from '@/lib/tecla/history';
import { setConsumer } from '@/lib/tecla/input';
import { $, clamp, h, nav } from '@/lib/tecla/utils';
import { ADIFF, ARC } from '@/lib/tecla/views/arcade';

const HIST_KINDS: Record<string, string> = { all: 'todo', test: 'tests', arcade: 'arcade', comp: 'competir', study: 'estudiar' };
const GLYPH: Record<string, string> = { test: '|', arcade: '*', comp: '—', study: '/' };

export const ProfileView: any = {
  filter: 'all', page: 0, editing: false, editMsg: '', unsub: null as null | (() => void),
  enter() {
    setConsumer(null); this.page = 0;
    // si estás escribiendo en el editor, no redibujar (se perdería lo tipeado)
    this.unsub = History.subscribe(() => { if (this.editing && (document.activeElement as HTMLElement | null)?.closest?.('.editor')) return; this.render(); });
    this.onResize = () => this.render(); window.addEventListener('resize', this.onResize);
    this.render();
  },
  leave() { this.unsub?.(); this.unsub = null; window.removeEventListener('resize', this.onResize); },
  level(xp: number) { const lv = Math.floor(Math.sqrt(xp / 150)) + 1, a = 150 * (lv - 1) ** 2, b = 150 * lv ** 2; return { lv, pct: (xp - a) / (b - a), next: b - xp }; },
  title(r: Run) {
    if (r.t === 'test') return 'test · ' + r.mode;
    if (r.t === 'arcade') return `${(ARC[r.game!] || {}).name || r.game} · ${(ADIFF[r.diff!] || {}).name || ''}`;
    if (r.t === 'comp') return r.mode;
    return 'estudio · ' + r.mode;
  },
  dayLabel(d: number) {
    const x = new Date(d), t = new Date(); const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(x, t)) return 'hoy'; t.setDate(t.getDate() - 1); if (same(x, t)) return 'ayer';
    return x.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  },
  render() {
    const v = $('#v-profile'); if (!v) return;
    const runs = History.all(), xp = runs.reduce((a, r) => a + (r.pts || 0), 0), L = this.level(xp), me = History.user;
    const name = (me && me.name) || 'vos';
    const avatar = h('div', { class: 'avatar' }, me && me.avatarUrl ? h('img', { src: me.avatarUrl, alt: '', referrerpolicy: 'no-referrer' }) : h('span', { text: name[0].toUpperCase() }));
    const pend = History.pending();
    const cloud = History.mode === 'cloud';
    const sync = cloud ? (pend ? `guardando ${pend}…` : '* guardado en tu cuenta') : 'guardado solo en este navegador';
    const account = cloud
      ? h('button', { class: 'btn ghost', type: 'button', text: 'salir', onclick: () => History.signOut() })
      : h('button', { class: 'btn primary', type: 'button', text: 'entrar', onclick: () => nav.go('/login') });
    const head = h('div', { class: 'panel phead' }, h('span', { class: 'corner', text: '* — |' }), avatar,
      h('div', { class: 'pinfo' }, h('span', { class: 'eyebrow', text: me?.username ? '@' + me.username : 'perfil' }), h('h2', { text: name }),
        h('p', { class: 'sub', text: `nivel ${L.lv} · ${xp.toLocaleString('es')} puntos · faltan ${L.next.toLocaleString('es')} para el nivel ${L.lv + 1}` }),
        h('div', { class: 'progress', style: 'max-width:420px' }, h('i', { style: `width:${(L.pct * 100).toFixed(1)}%` }))),
      h('div', { class: 'pside' }, h('span', { class: 'chip sync' + (cloud ? ' ok' : ''), text: sync }),
        h('div', { class: 'row' },
          me?.username ? h('button', { class: 'btn ghost', type: 'button', text: 'perfil público', onclick: () => nav.go('/u/' + me.username) }) : '',
          cloud ? h('button', { class: 'btn ghost', type: 'button', text: this.editing ? 'cerrar' : 'editar', onclick: () => { this.editing = !this.editing; this.editMsg = ''; this.render(); } }) : '',
          account)));
    let editor: any = '';
    if (cloud && this.editing && me) {
      const nameIn = h('input', { class: 'live-nick', id: 'edit-name', value: me.name, maxlength: '40' });
      const userIn = h('input', { class: 'live-nick', id: 'edit-user', value: me.username || '', maxlength: '20' });
      const save = async () => {
        const patch: { display_name?: string; username?: string } = {};
        if (nameIn.value.trim() !== me.name) patch.display_name = nameIn.value.trim();
        const u = userIn.value.trim().toLowerCase();
        if (u && u !== me.username) patch.username = u;
        if (!Object.keys(patch).length) { this.editing = false; this.render(); return; }
        const err = await History.updateProfile(patch);
        this.editMsg = err || ''; if (!err) this.editing = false; this.render();
      };
      editor = h('div', { class: 'panel editor' },
        h('span', { class: 'eyebrow', text: 'editar perfil' }),
        h('div', { class: 'row' }, h('label', { class: 'lbl', for: 'edit-name', text: 'nombre' }), nameIn, h('label', { class: 'lbl', for: 'edit-user', text: 'usuario' }), userIn,
          h('button', { class: 'btn primary', type: 'button', text: 'guardar', onclick: save })),
        this.editMsg ? h('p', { class: 'msg err', text: this.editMsg }) : h('p', { class: 'hint', style: 'text-align:left', text: 'el usuario es tu link público: tecla/u/tu-usuario' }));
    }
    const cnt = (t: string) => runs.filter(r => r.t === t);
    const tests = cnt('test'), arc = cnt('arcade'), comp = cnt('comp');
    const tiles = h('div', { class: 'tiles t2' }, ...[
      ['puntos totales', xp.toLocaleString('es'), 'acc'],
      ['tests', tests.length ? `${tests.length} · mejor ${Math.max(...tests.map(r => r.wpm || 0))} ppm` : '0', ''],
      ['partidas arcade', String(arc.length), ''],
      ['victorias', `${comp.filter(r => r.win).length} de ${comp.length}`, ''],
    ].map(([l, n2, c]) => h('div', { class: 'tile ' + c }, h('span', { class: 'lbl', text: l }), h('b', { text: n2 }))));
    const recRows = Object.entries(ARC).map(([k, m]: [string, any]) => h('tr', {}, h('td', { text: m.name }), ...Object.keys(ADIFF).map(d => {
      const best = History.bestArcade(k, d);
      return h('td', { class: 'num' + (best ? '' : ' none'), text: best ? best.toLocaleString('es') : '—' });
    })));
    const records = h('div', { class: 'panel' }, h('span', { class: 'eyebrow', text: 'récords de arcade' }),
      h('div', { style: 'overflow-x:auto;margin-top:10px' }, h('table', { class: 'rtable' }, h('thead', {}, h('tr', {}, h('th', { text: 'juego' }), ...Object.values(ADIFF).map((d: any) => h('th', { class: 'num', text: d.name })))), h('tbody', {}, ...recRows))));
    const list = runs.filter(r => this.filter === 'all' || r.t === this.filter);
    const filters = h('div', { class: 'cfgbar', style: 'align-self:flex-start' }, ...Object.entries(HIST_KINDS).map(([k, l]) => h('button', { class: 'opt' + (k === this.filter ? ' on' : ''), type: 'button', text: l, onclick: () => { this.filter = k; this.page = 0; this.render(); } })));
    const hist = h('div', { class: 'hist' }); let lastDay = '';
    const per = clamp(Math.floor((window.innerHeight - 300) / 44), 4, 16), pages = Math.max(1, Math.ceil(list.length / per)); this.page = Math.min(this.page, pages - 1);
    list.slice(this.page * per, this.page * per + per).forEach(r => {
      const day = this.dayLabel(r.d); if (day !== lastDay) { hist.append(h('div', { class: 'hday', text: day })); lastDay = day; }
      hist.append(h('div', { class: 'hrow' },
        h('span', { class: 'ht', text: new Date(r.d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }),
        h('span', { class: 'hg', text: GLYPH[r.t] || '*' }),
        h('div', { class: 'hm' }, h('span', { class: 'hti', text: this.title(r) }), h('span', { class: 'det', text: (r.detail || '') + (r.t === 'arcade' && r.fin === false ? ' · guardada al salir' : '') })),
        h('span', { class: 'hp', text: '+' + (r.pts || 0).toLocaleString('es') })));
    });
    if (!list.length) hist.append(h('p', { class: 'sub', text: runs.length ? 'No hay actividad de este tipo todavía.' : 'Todavía no hay actividad. Hacé un test, jugá en el arcade o estudiá un rato: todo queda acá.' }));
    const more = pages > 1 ? h('div', { class: 'row pager' },
      h('button', { class: 'btn ghost', text: '← más nuevas', disabled: this.page === 0, onclick: () => { this.page--; this.render(); } }),
      h('span', { class: 'hint', text: `página ${this.page + 1} de ${pages}` }),
      h('button', { class: 'btn ghost', text: 'más viejas →', disabled: this.page >= pages - 1, onclick: () => { this.page++; this.render(); } })) : '';
    const histPanel = h('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'eyebrow', text: `historial · ${list.length} actividades` }), filters), hist, more);
    v.replaceChildren(h('div', { class: 'two fill' }, h('div', { class: 'col' }, head, editor, tiles, records), histPanel));
  },
};
