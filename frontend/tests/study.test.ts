import { chunkSentences, processDoc as rawProcessDoc, tokens } from '@/lib/tecla/views/study';

// el módulo portado no tiene tipos: acá le damos una firma laxa
const processDoc = rawProcessDoc as unknown as (raw: string, title?: string) => any;

const DOC = `El ciclo del agua

Evaporación: proceso en el que el agua líquida se transforma en vapor por acción del calor solar.
Condensación: cambio del vapor de agua a pequeñas gotas cuando el aire se enfría y forma nubes.
Precipitación: caída de agua desde las nubes hacia la superficie en forma de lluvia o nieve.

La deforestación altera el ciclo porque reduce la transpiración y aumenta la escorrentía del agua.`;

describe('processDoc', () => {
  it('detecta el título y separa las definiciones en tarjetas', () => {
    const d = processDoc(DOC);
    expect(d.title).toBe('El ciclo del agua');
    expect(d.cards.map((c: any) => c.a)).toEqual(expect.arrayContaining(['Evaporación', 'Condensación', 'Precipitación']));
    // en las tarjetas de definiciones, el concepto no aparece dentro de la pregunta
    for (const term of ['Evaporación', 'Condensación', 'Precipitación']) {
      const c = d.cards.find((x: any) => x.a === term);
      expect(c!.q.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });
  it('un título pasado a mano gana sobre el detectado', () => {
    expect(processDoc(DOC, 'Mis apuntes').title).toBe('Mis apuntes');
  });
  it('texto vacío o muy corto no rompe: devuelve sin párrafos', () => {
    for (const t of ['', '   ', 'hola', '\n\n\n']) {
      const d = processDoc(t);
      expect(d.paras).toEqual([]);
      expect(d.cards).toEqual([]);
    }
  });
  it('términos con símbolos de expresiones regulares no rompen el procesamiento', () => {
    const t = `C++: lenguaje de programación de propósito general con orientación a objetos.
Función (f): relación que asigna a cada elemento de un conjunto exactamente un elemento de otro.
Precio [USD]: valor expresado en dólares estadounidenses para comparar mercados distintos.`;
    expect(() => processDoc(t)).not.toThrow();
    const d = processDoc(t);
    expect(d.cards.find((c: any) => c.a === 'C++')?.q).not.toContain('C++');
  });
  it('corta párrafos gigantes en pedazos manejables', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Esta es la oración número ${i} del texto larguísimo.`).join(' ');
    const d = processDoc(long);
    expect(d.paras.length).toBeGreaterThan(1);
    expect(d.paras.every((p: string) => p.length <= 480)).toBe(true);
  });
  it('une palabras cortadas con guion al final de línea (típico de PDF)', () => {
    const d = processDoc('La fotosín-\ntesis ocurre en los cloroplastos de las hojas verdes de las plantas.');
    expect(d.paras[0]).toContain('fotosíntesis');
  });
  it('los conceptos clave ignoran números y palabras vacías', () => {
    const d = processDoc('El agua agua agua 1999 1999 1999 cubre la mayor parte del planeta y el agua es vital para la vida.');
    expect(d.kws[0]).toBe('agua');
    expect(d.kws).not.toContain('1999');
    expect(d.kws).not.toContain('para');
  });
});

describe('utilidades de texto', () => {
  it('tokens reconoce tildes, ñ y números con su posición', () => {
    expect(tokens('Año 2024: ñandú!')).toEqual([{ w: 'Año', i: 0 }, { w: '2024', i: 4 }, { w: 'ñandú', i: 10 }]);
  });
  it('chunkSentences no parte oraciones y respeta el máximo cuando puede', () => {
    const out = chunkSentences('Uno dos tres. Cuatro cinco seis. Siete ocho nueve.', 20);
    expect(out).toEqual(['Uno dos tres.', 'Cuatro cinco seis.', 'Siete ocho nueve.']);
  });
  it('una oración más larga que el máximo queda entera', () => {
    const s = 'Una oración larguísima sin ningún punto intermedio que supera el máximo';
    expect(chunkSentences(s, 10)).toEqual([s]);
  });
});
