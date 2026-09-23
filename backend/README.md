# tecla* — backend (Supabase)

```
supabase/
├── config.toml                           configuración para desarrollo local
├── migrations/20260923120000_init.sql    esquema inicial
├── migrations/20260923180000_social.sql  usuarios, perfiles públicos y rankings
└── seed.sql
```

## Qué hay en la base

| Tabla / función | Para qué | Quién puede |
|---|---|---|
| `profiles` | nombre y avatar (se crea solo al registrarse) | todos leen · cada uno edita el suyo |
| `runs` | historial: tests, arcade, competir, estudio | cada uno lee y guarda solo lo suyo |
| `daily_results` | mejor resultado del desafío diario por usuario | todos leen · se escribe solo con `submit_daily()` |
| `submit_daily(day, wpm, accuracy)` | guarda el mejor intento del día, valida día y rangos | usuarios con sesión |
| `daily_leaderboard` (vista) | ranking del día con nombre y posición | todos |
| `profiles.username` | usuario único para el link público `/u/usuario` | cada uno edita el suyo |
| `runs.mode_key` | modo del test (t15, t30, w25…) para los rankings | — |
| `public_profile(usuario)` | datos agregados del perfil público (nunca el historial completo) | todos |
| `leaderboard(tabla, período)` | rankings globales por modo o por puntos: hoy, semana, siempre | todos |

Todas las tablas tienen Row Level Security activado.

## Aplicar el esquema

**Opción simple:** pegá el SQL de cada migración, en orden, en **SQL Editor** del panel de Supabase y ejecutalo.

**Con la CLI:**

```bash
npm install
npx supabase login            # abre el navegador
npx supabase link             # elegís el proyecto y escribís la contraseña de la base
npm run db:push               # aplica las migraciones
npm run types                 # genera los tipos TypeScript para el frontend
```

**Local con Docker:** `npm run db:local` levanta Supabase completo en tu compu.

## Próximos pasos

- Validar récords en el servidor recalculando la velocidad desde el registro de pulsaciones (Edge Function).
- Carreras en vivo: ya funcionan con Supabase Realtime (presencia + broadcast por sala, sin tablas).
