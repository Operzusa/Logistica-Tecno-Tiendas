# CLAUDE.md — Logistica Tecno Tiendas

This file documents the codebase structure, conventions, and workflows for AI assistants working on this project.

## Project Overview

**Tecno Tiendas Logistics** is a Progressive Web App (PWA) for managing delivery drivers (domiciliarios) and service orders at Tecno Tiendas. It supports route management, service tracking, photo evidence, financial reconciliation, real-time push notifications, and offline-first operation.

- **Language:** Spanish (UI, variable names, comments)
- **Target Users:** Administrators (ADMIN/SUPERADMIN) and delivery drivers (DOMICILIARIO)
- **Timezone:** Colombia (UTC-5) — critical throughout the app

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.8 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS (CDN), CSS variables for theming |
| Database/Auth | Supabase (PostgreSQL + Realtime) |
| Offline Storage | LocalForage (IndexedDB) |
| Serverless | Supabase Edge Functions (Deno) |
| PWA | Service Worker, Web Push API (VAPID) |

---

## Directory Structure

```
/
├── App.tsx                        # Main router — manages screen state and auth flow
├── index.tsx                      # React entry point
├── types.ts                       # All TypeScript interfaces and enums
├── index.html                     # Entry HTML — Tailwind config, themes, import maps
├── vite.config.ts                 # Vite config (alias @/, port 3000)
├── tsconfig.json                  # TypeScript config (target ES2022, path alias @/)
├── .env.example                   # Required env vars template
├── metadata.json                  # App name, description, permissions
│
├── components/
│   └── CachedImage.tsx            # Image component with IndexedDB caching
│
├── screens/                       # One file per screen
│   ├── AuthScreen.tsx             # Login
│   ├── RegistrationScreen.tsx     # User registration
│   ├── LandingScreen.tsx          # Welcome / home
│   ├── AdminDashboardScreen.tsx   # Admin: fleet, all services, dashboard
│   ├── RouteScreen.tsx            # Domiciliario: daily route and service list
│   ├── ServiceDetailScreen.tsx    # Service detail with chat, evidence, financials
│   ├── CreateServiceScreen.tsx    # Admin: create new service
│   ├── ClosureScreen.tsx          # Daily cash closure report
│   ├── HistoryScreen.tsx          # Activity history with filters
│   ├── StatsScreen.tsx            # Statistics and reporting
│   ├── DirectoryScreen.tsx        # Providers and satellite technicians directory
│   └── SateliteInventoryScreen.tsx # Satellite service inventory
│
├── services/
│   ├── supabaseService.ts         # All Supabase DB/auth/storage operations
│   ├── pwaService.ts              # PWA install, push notification subscription
│   ├── audioService.ts            # Sound alerts (messages, payments, fuel)
│   └── localStorageService.ts     # IndexedDB image caching via LocalForage
│
├── utils/
│   └── dateUtils.ts               # Colombia timezone helpers — always use these
│
├── public/
│   ├── sw.js                      # Service worker: offline cache, push handling
│   └── manifest.json              # PWA manifest
│
└── supabase/
    └── functions/
        └── notify-status-change/
            └── index.ts           # Edge function: sends push when service status changes
```

---

## Development Workflow

### Setup

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY
npm run dev       # Dev server at http://localhost:3000
```

### Scripts

```bash
npm run dev       # Start dev server (port 3000, all interfaces)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (safe to expose in frontend) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for Web Push notifications |

All variables are prefixed with `VITE_` to be accessible in the browser via `import.meta.env`.

### Path Alias

Use `@/` as an alias for the project root:
```ts
import { Servicio } from '@/types';
import { getServicios } from '@/services/supabaseService';
```

---

## Data Models

All types are defined in `types.ts`. Key models:

### User Roles (enum `UserRole`)
- `SUPERADMIN` — Full access
- `ADMIN` — Manages services and drivers
- `DOMICILIARIO` — Delivery driver, limited view

### Service Types (enum `TipoServicio`)
`RECOGER` | `ENTREGAR` | `COTIZAR` | `COMPRAR` | `GARANTIA` | `SATELITE` | `CONSIGNAR` | `DILIGENCIA`

### Service States (enum `EstadoServicio`)
`PENDIENTE` → `EN_CAMINO` → `POR_CONFIRMAR` → `COMPLETADO` / `FAILED`

### Core Entity: `Servicio`
```ts
{
  id: string;
  tipo: TipoServicio;
  estado: EstadoServicio;
  cliente: { nombre, telefono, direccion, coordenadas_gps };
  dispositivo: { marca, modelo, serial, accesorios, falla };
  financiero: { valor_a_cobrar, valor_cobrado, metodo_pago };
  evidencia: string[];          // Photo URLs in Supabase storage
  satelite_info: { nombre_tecnico_externo, costo, accion, pending_change };
  garantia_info: { accion };
  logs: ServiceLog[];            // Chat messages
  domiciliario_id: string;
  cierre_tardio: boolean;
  cerrado_por_rol: UserRole;
  fecha_asignacion: string;
  updated_at: string;
}
```

---

## Supabase Database

### Tables
- `profiles` — User accounts (id, nombre, role, avatar, telefono, cedula, direccion, vehicle, password)
- `servicios` — Service orders (see `Servicio` type above)
- `gastos` — Expenses (tipo, descripcion, monto, fecha)
- `actividades` — Activity log (timestamp, descripcion, tipo, detalle, color)
- `push_subscriptions` — Web push endpoints (user_id, endpoint, p256dh, auth)
- `proveedores` — Supplier directory (nombre, direccion, telefono)
- `tecnicos_satelite` — External technician directory

### Storage
- Bucket: `media` — Evidence photos, stored as WebP compressed images

### All DB operations go through `services/supabaseService.ts`
Never access Supabase directly from screens — always call a function in `supabaseService.ts`.

---

## Offline & PWA Architecture

- **Service Worker** (`public/sw.js`): cache-first strategy, handles push notification clicks with deep links to specific services
- **LocalForage** (`services/localStorageService.ts`): caches images in IndexedDB to reduce Supabase Storage egress; also caches `cached_servicios` and `cached_actividades`
- **Incremental sync**: uses `updated_at` timestamps to fetch only changed records
- **PWA installable** on Android and iOS (standalone mode)

---

## Authentication

- Custom session stored in `localStorage` as `current_user_id`
- Daily tokens: `auth_{userId}_{date}` in localStorage
- Default passwords by role (change in production):
  - ADMIN / SUPERADMIN: `"4321"`
  - DOMICILIARIO: `"1234"`
- Supabase anon key is used — server-side RLS must enforce access control

---

## UI & Theming

Tailwind CSS is loaded via CDN and configured inside `index.html` with a custom `theme.extend`.

Three themes (set via CSS class on `<html>`):
- `default` — Dark blue (`#1e293b` background)
- `whatsapp` — Dark green (`#0b141a` background)
- `light` — Azure/light mode

Font size scaling classes: `text-scale-sm` (0.9x), `text-scale-md` (1.1x), `text-scale-lg` (1.35x)

Font: **Space Grotesk** (Google Fonts)
Icons: **Material Symbols** (Google)

---

## Conventions

### File & Naming
- React components: `PascalCase` (e.g., `RouteScreen.tsx`)
- Services & utilities: `camelCase` (e.g., `supabaseService.ts`)
- Types/enums: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Event handlers: prefix `on` (e.g., `onServiceSelect`)
- State setters follow React convention: `set` prefix

### Language
- All UI text, comments, variable names, and log messages are in **Spanish**
- Colombia-specific terminology: domiciliario, servicio, cierre de caja, gasolina

### Date/Time
- Always use helpers from `utils/dateUtils.ts` — never use raw `new Date()` for display
- The app operates in Colombia timezone (UTC-5)

### State Management
- No Redux or Zustand — state managed locally in each screen via `useState`/`useEffect`
- Global state (current user, theme) passed as props from `App.tsx`

### Images
- Always upload as WebP via `localStorageService.ts` to reduce storage costs
- Use `<CachedImage>` component instead of `<img>` for any Supabase-hosted images

### No Test Suite
There are no automated tests. Manual testing in the browser is the current practice.

---

## Push Notifications Flow

1. User grants notification permission → `pwaService.ts` subscribes via Web Push
2. Subscription endpoint saved to `push_subscriptions` table
3. When a `servicio.estado` changes → Supabase Edge Function `notify-status-change` is triggered
4. Edge Function sends VAPID-signed push to all relevant subscribers
5. `sw.js` receives push event → shows notification with deep link
6. User taps notification → Service Worker opens app to specific service screen

---

## Key Business Rules

- A domiciliario sees only their own assigned services
- Admins see all services across all drivers
- Services can only be closed (COMPLETADO/FAILED) by the assigned domiciliario
- `cierre_tardio` is flagged when a service is closed after midnight
- Satellite services require admin approval for cost/action changes (`pending_change` workflow)
- Fuel shortage alerts (`FALTA_GASOLINA`) trigger audio + push to admins
- Daily cash closure (`ClosureScreen`) aggregates all financiero data for the day

---

## Common Pitfalls

- **Timezone bugs**: Never compare dates without using `dateUtils.ts` functions — raw JS dates use UTC and will be off by 5 hours
- **Supabase anon key**: This is the public key, not the service role key. Do not add the service role key to frontend code
- **Image compression**: Always compress to WebP before upload — raw camera photos can be 5-10MB
- **Service Worker updates**: After changing `sw.js`, users may need to manually refresh or clear cache until the new SW activates
- **Import maps**: React, React-DOM, and Supabase are loaded via `<script type="importmap">` in `index.html` — do not add them as npm dependencies expecting bundling

---

## Edge Functions (Deno)

Located in `supabase/functions/`. Written in TypeScript for Deno runtime.

Deploy with:
```bash
supabase functions deploy notify-status-change
```

Set secrets:
```bash
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```
