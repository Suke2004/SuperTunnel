# SuperTunnel — Project Architecture

> **Version:** 0.1.0  
> **Stack:** Next.js 15 (App Router) · React 18 · TypeScript 5 · Tailwind CSS 3 · shadcn/ui · Vite 5 + CRX · Genkit AI  
> **Authors:** Benny 01r, Irshad Siddi  
> **License:** MIT

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Repository Layout](#2-repository-layout)
3. [Subsystem Breakdown](#3-subsystem-breakdown)
   - 3.1 [Browser Extension (MV3)](#31-browser-extension-mv3)
   - 3.2 [Next.js Web Dashboard](#32-nextjs-web-dashboard)
   - 3.3 [AI Module (Genkit)](#33-ai-module-genkit)
   - 3.4 [Shared UI Layer (shadcn/ui)](#34-shared-ui-layer-shadcnui)
4. [Data-Flow & Sequence Diagrams](#4-data-flow--sequence-diagrams)
5. [Build & Tooling Pipeline](#5-build--tooling-pipeline)
6. [Environment & Configuration](#6-environment--configuration)
7. [Identified Flaws & Issues (Descending Severity)](#7-identified-flaws--issues-descending-severity)

---

## 1. High-Level Overview

SuperTunnel is an **open-source, browser-based VPN controller** composed of two
co-located applications inside a single pnpm monorepo:

| Deliverable | Purpose | Build Tool |
|---|---|---|
| **Chrome Extension (MV3)** | Configures browser proxy settings via `chrome.proxy` API; popup UI for connect/disconnect | Vite + `@crxjs/vite-plugin` |
| **Next.js Web UI** | Server-side management dashboard; mirrors the extension popup for a standalone web view | Next.js 15 (Turbopack) |

Both share a common design-token system (CSS variables in `globals.css`),
the shadcn/ui component library under `src/components/ui/`, and the
`@/components/icons` module.

```
                    ┌──────────────────────────────────────────┐
                    │           REMOTE VPN API SERVER          │
                    │  POST /connect → { pacUrl | proxy }      │
                    └──────────┬───────────────────────────────┘
                               │  HTTPS
          ┌────────────────────┴─────────────────────┐
          │                                          │
  ┌───────▼───────────┐                   ┌──────────▼──────────┐
  │  Browser Extension │                   │   Next.js Web UI    │
  │  (MV3 / Vite+CRX) │                   │   (Port 9002)       │
  │                    │                   │                     │
  │  popup.html/.tsx   │ ← shared ui ──→  │  src/app/page.tsx   │
  │  background.ts     │                   │  src/ai/*           │
  └────────────────────┘                   └─────────────────────┘
          │
          │ chrome.proxy.settings.set()
          ▼
  ┌────────────────────┐
  │   Browser Traffic   │
  │   (Proxied / PAC)   │
  └────────────────────┘
```

---

## 2. Repository Layout

```
SuperTunnel/
├── .env                          # Build-time env (VITE_API_ORIGIN)
├── .github/                      # Issue templates & PR template
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── config.yml
│   │   └── feature_request.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── extension/                    # Chrome Extension source (MV3)
│   ├── background.ts             # Service worker — proxy logic & messaging
│   ├── manifest.ts               # Programmatic MV3 manifest (consumed by CRX)
│   ├── popup.html                # Extension popup shell (loads popup.tsx)
│   ├── popup.ts                  # Legacy vanilla TS popup (unused at runtime)
│   ├── popup.tsx                 # React entry-point for the popup
│   └── icons/                    # Generated placeholder PNGs
│
├── src/                          # Next.js application source
│   ├── ai/                       # Genkit AI module
│   │   ├── genkit.ts             # AI client configuration (Gemini 2.0)
│   │   └── dev.ts                # Dev server entry (empty)
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root HTML layout & font loading
│   │   ├── page.tsx              # Home page (mock VPN dashboard)
│   │   ├── globals.css           # Design tokens (CSS variables) + Tailwind
│   │   └── favicon.ico
│   ├── components/
│   │   ├── icons.tsx             # Logo SVG icon
│   │   ├── popup/                # React components for extension popup
│   │   │   ├── PopupProviders.tsx
│   │   │   └── PopupView.tsx
│   │   └── ui/                   # 35 shadcn/ui primitives (Button, Card, etc.)
│   ├── hooks/
│   │   ├── use-mobile.tsx        # Responsive breakpoint hook
│   │   └── use-toast.ts          # Toast notification state machine
│   └── lib/
│       └── utils.ts              # cn() utility (clsx + tailwind-merge)
│
├── scripts/
│   └── gen-icons.mjs             # Generates 1×1 transparent placeholder icons
│
├── dist-extension/               # Vite build output for the extension
│
├── components.json               # shadcn/ui CLI configuration
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS theme + design tokens
├── tsconfig.json                 # TypeScript compiler options
├── vite.config.ts                # Vite config for extension build
├── postcss.config.mjs            # PostCSS (tailwindcss plugin)
├── pnpm-workspace.yaml           # pnpm workspace allowlist
├── pnpm-lock.yaml                # Lockfile
└── package.json                  # Scripts, deps, metadata
```

---

## 3. Subsystem Breakdown

### 3.1 Browser Extension (MV3)

**Entry points:** `extension/popup.html` → `extension/popup.tsx` → React tree  
**Background worker:** `extension/background.ts`

#### 3.1.1 Background Service Worker (`background.ts`)

This is the core of the VPN controller. It manages:

| Responsibility | Implementation |
|---|---|
| **State persistence** | `chrome.storage.local` storing `ConnectionState`, endpoint, token, local-proxy config |
| **Proxy activation** | `chrome.proxy.settings.set()` with either PAC script or fixed-server rules |
| **API integration** | `POST {endpoint}/connect` with optional Bearer token |
| **Badge indicator** | `chrome.action.setBadgeText` / `setBadgeBackgroundColor` reflecting ON/OFF/Error |
| **Message bus** | `chrome.runtime.onMessage` handling: `get_state`, `set_token`, `set_endpoint`, `set_local_mode`, `set_local_proxy`, `connect`, `disconnect` |

**Connection flow:**

```
User clicks "Connect"
       │
       ├─ localMode=true? ──YES──→ Build fixed_servers ProxyConfig from local settings
       │                           → chrome.proxy.settings.set()
       │                           → state = "connected"
       │
       └─ localMode=false ──────→ POST {endpoint}/connect
                                   │
                                   ├─ Response has pacUrl?
                                   │   → ProxyConfig { mode: "pac_script" }
                                   │
                                   └─ Response has proxy.host + proxy.port?
                                       → ProxyConfig { mode: "fixed_servers" }
                                   │
                                   → chrome.proxy.settings.set()
                                   → state = "connected"
```

#### 3.1.2 Popup UI (`popup.tsx` → `PopupView.tsx`)

The React popup renders inside `popup.html` via `createRoot()`. It provides:

- **Connection card:** Connect/Disconnect button, status indicator, uptime timer, data counters
- **Settings card:** API endpoint, auth token, local-proxy toggle + host/port/scheme
- **Activity logs card:** Timestamped log scroll area with mock AI analysis trigger

The popup communicates with the background worker exclusively through
`chrome.runtime.sendMessage()`.

#### 3.1.3 Manifest Generation (`manifest.ts`)

The manifest is defined as a TypeScript object (not static JSON) so that
`VITE_API_ORIGIN` can be injected into `host_permissions` at build time.
The CRX plugin translates this into a proper `manifest.json` in `dist-extension/`.

#### 3.1.4 Build Pipeline

```
vite.config.ts
  └── @crxjs/vite-plugin + @vitejs/plugin-react
       ├── Input:  extension/popup.html, extension/background.ts, extension/manifest.ts
       └── Output: dist-extension/  (loadable via chrome://extensions)
```

### 3.2 Next.js Web Dashboard

**Entry:** `src/app/layout.tsx` → `src/app/page.tsx`

The web dashboard is a **standalone client-side page** (`"use client"`) that
**simulates** a VPN connection UI. It does **not** communicate with the Chrome
extension or any real backend.

| Feature | Behavior |
|---|---|
| Server selector | Hardcoded list of 5 servers (US, DE, JP, AU, BR) |
| Connect/Disconnect | `setTimeout` mock — transitions status after 2.5s |
| Uptime counter | `setInterval` incrementing every 1s while "connected" |
| Data counter | Random MB increments every 1.5s (cosmetic) |
| AI log analysis | `setTimeout` mock returning a static string |

### 3.3 AI Module (Genkit)

Located in `src/ai/`:

- `genkit.ts` — Initializes a Genkit AI client with the `@genkit-ai/googleai`
  plugin targeting `googleai/gemini-2.0-flash`.
- `dev.ts` — Empty entry point for `genkit start` dev server.

**Current status:** The AI module is scaffolded but **completely unused**.
No flows are defined, no API routes consume the `ai` instance, and the
"Analyze Logs" button in both the extension popup and the web dashboard uses
hardcoded mock responses instead of calling Genkit.

### 3.4 Shared UI Layer (shadcn/ui)

35 pre-built Radix UI + Tailwind primitives live in `src/components/ui/`.
These are consumed by both:

- The Next.js web page (`src/app/page.tsx`)
- The extension popup (`src/components/popup/PopupView.tsx`)

The design-token system in `globals.css` provides light and dark mode via
HSL CSS custom properties, consumed through Tailwind's `hsl(var(--*))` pattern.

---

## 4. Data-Flow & Sequence Diagrams

### 4.1 Extension Connect Sequence

```
┌────────┐          ┌──────────────┐          ┌────────────┐          ┌──────────┐
│ Popup  │          │  Background  │          │ Remote API │          │  Chrome  │
│  UI    │          │   Worker     │          │  Server    │          │  Proxy   │
└───┬────┘          └──────┬───────┘          └──────┬─────┘          └────┬─────┘
    │  sendMessage(connect) │                        │                     │
    │ ────────────────────► │                        │                     │
    │                       │ writeState(connecting) │                     │
    │                       │ ─────────── ►          │                     │
    │                       │                        │                     │
    │                       │ POST /connect           │                     │
    │                       │ ──────────────────────► │                     │
    │                       │                        │                     │
    │                       │    { pacUrl | proxy }   │                     │
    │                       │ ◄────────────────────── │                     │
    │                       │                        │                     │
    │                       │       proxy.settings.set(config)             │
    │                       │ ────────────────────────────────────────────► │
    │                       │                        │                     │
    │                       │ writeState(connected)  │                     │
    │                       │ setBadge("ON")         │                     │
    │                       │                        │                     │
    │   { state: connected }│                        │                     │
    │ ◄──────────────────── │                        │                     │
    │                       │                        │                     │
```

### 4.2 State Management

```
Extension State (chrome.storage.local)
┌──────────────────────────────────────┐
│  state:          ConnectionState     │
│  lastError?:     string              │
│  token?:         string              │
│  endpoint?:      string              │
│  localMode?:     boolean             │
│  localProxyHost?:  string            │
│  localProxyPort?:  number            │
│  localProxyScheme?: "http" | "https" │
└──────────────────────────────────────┘

Web Dashboard State (React useState — ephemeral)
┌──────────────────────────────────────┐
│  status:         ConnectionStatus    │
│  selectedServer: string              │
│  logs[]:         string[]            │
│  uptime:         number              │
│  data:           { down, up }        │
│  analysis:       string | null       │
│  isAnalyzing:    boolean             │
└──────────────────────────────────────┘
```

---

## 5. Build & Tooling Pipeline

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev --turbopack -p 9002` | Start Next.js dev server on port 9002 |
| `build` | `next build` | Production build of the web app |
| `dev:extension` | `vite --config vite.config.ts` | Vite dev mode for the extension |
| `build:extension` | `vite build --config vite.config.ts` | Production build → `dist-extension/` |
| `genkit:dev` | `genkit start -- tsx src/ai/dev.ts` | Genkit AI dev server |
| `genkit:watch` | `genkit start -- tsx --watch src/ai/dev.ts` | Genkit with file-watching |
| `gen:icons` | `node scripts/gen-icons.mjs` | Generate transparent placeholder icons |
| `typecheck` | `tsc --noEmit` | Run TypeScript type-checking only |
| `lint` | `next lint` | ESLint via Next.js |

### Dependency Graph (Build Tools)

```
package.json
├── Next.js 15 ──► Turbopack (dev), Webpack (prod)
│   └── PostCSS → Tailwind CSS 3
├── Vite 5
│   ├── @vitejs/plugin-react
│   └── @crxjs/vite-plugin → CRX MV3 bundle
└── TypeScript 5 (tsc --noEmit)
```

---

## 6. Environment & Configuration

| Variable | Source | Consumer | Purpose |
|---|---|---|---|
| `VITE_API_ORIGIN` | `.env` / shell | Extension build (Vite) | API base URL for remote proxy mode |
| `GOOGLE_API_KEY` | *(expected)* | `@genkit-ai/googleai` | AI features (currently unused) |

---

## 7. Identified Flaws & Issues (Descending Severity)

### 🔴 CRITICAL

#### C1 — TypeScript & ESLint Errors Silenced in Production

**File:** [`next.config.ts`](next.config.ts) (lines 5–10)

```ts
typescript: { ignoreBuildErrors: true },
eslint:     { ignoreDuringBuilds: true },
```

**Impact:** Type errors and lint violations are **completely invisible** during
`next build`. This means broken imports, type mismatches, and dead code ship
to production without any gate. This is the single most dangerous configuration
in the project — it completely undermines the value of using TypeScript.

---

#### C2 — Zero Test Coverage

**Evidence:** No `*.test.ts`, `*.spec.ts`, `__tests__/` directories, no test
runner (`jest`, `vitest`, `playwright`, etc.) in `devDependencies`.

**Impact:** There is zero automated verification for any behavior — the
extension proxy logic, the popup UI, the messaging protocol, or the web
dashboard. Any refactor is a regression gamble.

---

#### C3 — Massive Code Duplication Between Web Dashboard & Extension Popup

**Files:**
- [`src/app/page.tsx`](src/app/page.tsx) — 254 lines
- [`src/components/popup/PopupView.tsx`](src/components/popup/PopupView.tsx) — 223 lines

**Impact:** These two files are ~70% identical (status display, uptime counter,
data counter, log viewer, AI analysis button, `formatUptime()`,
`getStatusInfo()`). Each has its own copy-pasted logic with slight divergences.
Bugs fixed in one will not be fixed in the other. This violates the **DRY
(Don't Repeat Yourself)** principle at the component level.

---

### 🟠 HIGH

#### H1 — Dead / Orphaned Code: `extension/popup.ts`

**File:** [`extension/popup.ts`](extension/popup.ts) — 47 lines

**Impact:** The legacy vanilla-TS popup script (`popup.ts`) co-exists with the
React-based `popup.tsx`, but `popup.html` only loads `popup.tsx`. The old file
is dead code that confuses contributors and increases cognitive overhead.

---

#### H2 — AI Module Is a Dead Scaffold

**Files:** [`src/ai/genkit.ts`](src/ai/genkit.ts), [`src/ai/dev.ts`](src/ai/dev.ts)

**Impact:** The Genkit AI client is fully configured and its dependencies
(`genkit`, `@genkit-ai/googleai`, `@genkit-ai/next`, `genkit-cli`) add
significant weight to `node_modules`, yet **nothing uses it**. The "Analyze
Logs" feature in both UIs uses `setTimeout` with a hardcoded string. This bloats
the install size and misleads contributors about the project's capabilities.

---

#### H3 — Rampant `as any` Type Assertions

**File:** [`extension/background.ts`](extension/background.ts) — lines 20, 68, 92, 96, 119

**Impact:** Five `as any` casts suppress type-checking at the most critical
points in the codebase (Chrome proxy config, API response parsing, environment
variable access). Combined with **C1**, these are completely silent type holes.

---

#### H4 — No CI/CD Pipeline

**Evidence:** No `.github/workflows/` directory, no GitHub Actions YAML,
no build/test/deploy automation.

**Impact:** Pull requests are merged without automated checks. There is no
gate for type-checking, linting, test execution, or extension build
verification. This is especially problematic for an open-source project
inviting external contributions.

---

#### H5 — Bloated UI Dependencies (35 Unused Components)

**Directory:** `src/components/ui/` — 35 shadcn/ui components

**Impact:** Only ~8 components are actually imported (`Button`, `Card`,
`Select`, `ScrollArea`, `Alert`, `Input`, `Label`, `Switch`, `Toaster`).
The remaining 27 (e.g., `sidebar.tsx` at 24KB, `chart.tsx` at 10KB,
`menubar.tsx`, `carousel.tsx`, `table.tsx`, `calendar.tsx`, etc.) are dead
weight. While they are tree-shaken from the Next.js bundle, they increase
repository noise, confusion, and maintenance surface.

---

### 🟡 MEDIUM

#### M1 — Web Dashboard Is Entirely Mocked

**File:** [`src/app/page.tsx`](src/app/page.tsx)

**Impact:** The Next.js "management UI" does not communicate with any real
backend or the extension. All connection logic is faked with `setTimeout`.
The data counters use `Math.random()`. This is fine for a prototype, but it
is misleading if the README advertises it as a "server-side management UI."

---

#### M2 — Manifest Uses `process.env` Instead of `import.meta.env`

**File:** [`extension/manifest.ts`](extension/manifest.ts) (line 1)

```ts
const apiOrigin = process.env.VITE_API_ORIGIN || "https://api.supertunnel.example";
```

**Impact:** In a Vite project, `process.env` is not natively available.
`import.meta.env.VITE_API_ORIGIN` is the correct Vite idiom. The CRX plugin
may or may not do static replacement; this is fragile and will break if the
build toolchain is updated. Contrast with `background.ts` (line 20), which
already uses `import.meta.env` (albeit with an ugly `as any` cast).

---

#### M3 — Missing `.env.example` File

**Impact:** The `.gitignore` excludes `.env*`, but there is no `.env.example`
or `.env.template` committed. New contributors must read the README or grep the
source to discover required environment variables. This is a common
open-source anti-pattern.

---

#### M4 — `package-lock.json` Referenced But Project Uses pnpm

**File:** `pnpm-lock.yaml` exists, `pnpm-workspace.yaml` exists, user runs
`pnpm run dev`, yet the README says `npm install`.

**Impact:** Inconsistent package manager guidance. Running `npm install` on a
pnpm-managed project can create a conflicting `package-lock.json` and lead to
dependency resolution issues. The README should specify `pnpm install`.

---

#### M5 — Font Loading in `<head>` Bypasses Next.js Font Optimization

**File:** [`src/app/layout.tsx`](src/app/layout.tsx) (lines 17–20)

```tsx
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
```

**Impact:** Next.js has a built-in `next/font` system that self-hosts fonts,
eliminates layout shift, and avoids third-party network requests. The current
approach creates an external network dependency and misses font optimization.

---

#### M6 — `globals.css` Body Font Overridden

**File:** [`src/app/globals.css`](src/app/globals.css) (line 6)

```css
body { font-family: Arial, Helvetica, sans-serif; }
```

**Impact:** This rule overrides Tailwind's `font-body` class applied in
`layout.tsx`. Inter is loaded from Google Fonts but may not actually render
because the CSS specificity order means the bare `body` selector wins. This
is a silent styling bug.

---

### 🟢 LOW

#### L1 — Logs Use Array Index as React Key

**Files:** `page.tsx` (line 222), `PopupView.tsx` (line 200)

```tsx
{logs.map((log, i) => <p key={i}>…</p>)}
```

**Impact:** Using array index as key causes incorrect reconciliation when
items are prepended (which is exactly what `addLog` does). This can lead to
stale or flickering UI updates.

---

#### L2 — `useToast` Listener Cleanup Depends on `state`

**File:** [`src/hooks/use-toast.ts`](src/hooks/use-toast.ts) (line 185)

```ts
React.useEffect(() => { … }, [state])
```

**Impact:** The effect re-subscribes on every state change because `state` is
in the dependency array. The listener should only be registered once (empty
dep array `[]`). This causes unnecessary subscribe/unsubscribe cycles.

---

#### L3 — `pnpm-workspace.yaml` Is Not Actually Defining Workspaces

**File:** [`pnpm-workspace.yaml`](pnpm-workspace.yaml)

```yaml
onlyBuiltDependencies:
  - '@firebase/util'
  - esbuild
  - protobufjs
  - sharp
```

**Impact:** This file contains `onlyBuiltDependencies` (a pnpm feature to
restrict lifecycle scripts) but no `packages:` field. It is not actually
configuring a multi-package workspace, which is misleading.

---

#### L4 — No ESLint / Prettier Configuration Files

**Impact:** `next lint` is available as a script, but there are no
`.eslintrc.*`, `eslint.config.*`, or `.prettierrc` files. This means the
linter uses Next.js defaults only, and code formatting is unenforceable.
Contributors will inevitably introduce inconsistent styles.

---

#### L5 — `TOAST_REMOVE_DELAY` Set to ~16 Minutes

**File:** [`src/hooks/use-toast.ts`](src/hooks/use-toast.ts) (line 12)

```ts
const TOAST_REMOVE_DELAY = 1000000
```

**Impact:** 1,000,000 ms = 16.7 minutes. Toast DOM nodes are effectively
never cleaned up during a normal session, which is a minor memory leak.

---

#### L6 — Project Name in `package.json` Is Generic

**File:** [`package.json`](package.json) (line 2)

```json
"name": "nextn"
```

**Impact:** The npm package name is `nextn`, not `supertunnel`. This is
confusing for any downstream tooling, logs, or registry interactions.

---

#### L7 — No `LICENSE` Header or Copyright Notice in Source Files

**Impact:** While a `LICENSE` file (MIT) exists at the root, **no source file**
contains a license header or copyright notice. For an open-source project under
GSoC, per-file headers are a common convention to clarify ownership.

---

*End of architecture document.*
