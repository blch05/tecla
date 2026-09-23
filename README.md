# tecla*

Práctica de tipeo estilo monkeytype con fantasma, mapa de calor, carreras, juegos arcade y modos de estudio con tu propio material.

```
tecla/
├── frontend/   Next.js 15 + React 19 + TypeScript (la app)
└── backend/    Supabase: base de datos, reglas de seguridad y funciones
```

## Arrancar en tu compu

```bash
cd frontend
npm install
npm run dev
```

Abrí http://localhost:3000. Sin configurar nada, la app funciona completa y guarda el progreso en el navegador.

## Conectar las cuentas (Supabase)

1. Creá un proyecto gratis en https://supabase.com.
2. Cargá el esquema: pegá en orden cada archivo de `backend/supabase/migrations/` en **SQL Editor → New query → Run** (o usá la CLI, ver `backend/README.md`).
3. En **Authentication → URL Configuration** poné `http://localhost:3000` como Site URL y agregá `http://localhost:3000/perfil` en Redirect URLs.
4. Copiá `frontend/.env.example` como `frontend/.env.local` y completá la URL y la clave pública (**Project Settings → API**).
5. Reiniciá `npm run dev`. Ya podés entrar desde **perfil → entrar**.

Login con Google (opcional): **Authentication → Providers → Google**, con un Client ID y Secret de Google Cloud Console.

## Tests

```bash
cd frontend && npm test          # lógica del frontend (Vitest): motor de tipeo, vocabularios, historial, salas, apuntes
cd backend && npm run test:live  # contra tu proyecto de Supabase, sin sesión: permisos y validaciones
cd backend && npm run test:db    # base completa con usuarios logueados (pgTAP); necesita Docker y `npx supabase start`
```
