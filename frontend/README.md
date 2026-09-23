# tecla* — frontend

Next.js 15 (App Router) + React 19 + TypeScript.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de producción (incluye chequeo de tipos)
npm run typecheck
npm test           # tests con Vitest (carpeta tests/)
```

## Estructura

```
src/
├── app/                  rutas: / /test /competir /arcade /estudiar /ranking /progreso /perfil /login
│                         /u/[usuario] (perfil público) · /carrera/[código] (carrera en vivo)
│                         /sala/[código]?juego=… (arcade multijugador y battle royale online)
├── components/
│   ├── AppShell.tsx      input oculto del teclado, avisos, decoración, guardado al cerrar
│   ├── Header.tsx        navegación y usuario
│   ├── ViewRunner.tsx    monta cada vista imperativa sobre el markup de su página
│   ├── Landing, Ranking, PublicProfile, LiveRace, GameRoom, RoomBrowser, ArcadeStage, ThemeSwitcher
│   └── bits/             componentes de React Bits adaptados (ver bits/README.md)
└── lib/
    ├── supabase/client.ts
    └── tecla/
        ├── input.ts          reparte las teclas al modo activo
        ├── typebox.ts        motor de tipeo (caret, fantasma, estadísticas)
        ├── keystats.ts       mapa de calor y puntos débiles
        ├── history.ts        historial: localStorage + Supabase
        ├── bits.tsx          puente para usar componentes de React dentro de las vistas imperativas
        ├── sfx.ts            sonidos sintetizados (arcade y teclado del test)
        ├── data/words.ts     vocabularios (fácil / normal / difícil) y frases
        └── views/            test, compete, arcade, study, stats, profile
```

**Por qué el motor no usa estado de React:** cada tecla tiene que responder al instante. El motor de tipeo y los juegos en canvas son TypeScript imperativo y React solo arma las páginas.

## Deuda técnica conocida

Los módulos portados del prototipo (`utils`, `words`, `keystats`, `typebox`, `charts`, `decor` y las vistas salvo `profile`) llevan `// @ts-nocheck`. Compilan y funcionan, pero todavía no tienen tipos estrictos. Conviene tiparlos de a uno, empezando por `typebox.ts`, y sumarles tests.

## Variables de entorno

Ver `.env.example`. Sin ellas la app funciona igual, pero solo guarda en el navegador.
