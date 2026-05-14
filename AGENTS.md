# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite)
npm run build      # type-check + production build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # preview production build locally
```

There are no automated tests in this project.

## Architecture Overview

PageByPage is a **100% client-side** reading tracker built with React 19 + TypeScript + Vite + CSS Modules. All data persists in `localStorage` under the key `pagebypage_v1`. There is no backend, no router, and no global state library.

### State management

`src/components/useReadingData.ts` (note: lives in `components/`, not `hooks/`) is the single source of truth. It exposes typed mutation functions (`addBook`, `updateBook`, `deleteLog`, `startReread`, etc.) alongside the full `AppState`. `App.tsx` spreads this hook's return value plus `showToast` into every tab as `tabProps`.

```
AppState
├── books: Book[]          — library, all statuses
├── logs: ReadingLog[]     — one entry per reading session
├── goals: Goals           — yearly + monthly page targets
├── libraries?: LibraryPlace[]
└── wantOrder?: string[]   — manual sort order for "Quero Ler"
```

### Critical data model rules

- **Metrics always come from `logs`**, never from `book.currentPage`. Performance numbers (yearly pages, totals) are sums of `log.pages`. Changing `book.pages` alone won't update stats — `updateBook` auto-creates a correction log when a `done` book's page count increases.
- **Pages read per session** = `currentPage − startPage`. `startPage` handles books with unnumbered front matter (calculated as `(firstPageNum − 1) − pagesAdditional`).
- **Dates** are always stored as `YYYY-MM-DD` strings. Display format (DD/MM/YYYY) is handled by `src/utils/dates.ts`.
- `book.quote` (single string) is deprecated — use `book.quotes: string[]`.

### Tab shell

`App.tsx` manages tab switching via local state (no router). Each tab renders a single component. The tab order is user-configurable via drag-and-drop and persisted in `localStorage` under `pbp-tab-order`.

| Tab ID | Component |
|---|---|
| `dashboard` | `Dashboard` — today's reading, active books, quick log |
| `library` / `nextreads` | `Library` — same component, `initialStatus` prop filters |
| `log` | `LogTab` — log a session, paginated history |
| `history` | `History` — performance charts, heatmap, quotes |
| `achievements` | `Achievements` |
| `libraries` | `Libraries` — physical/digital store list |
| `settings` | `Settings` — goals, import/export, data reset |

### Design System

**SEMPRE leia o DS antes de qualquer trabalho de UI/CSS:**
`Design System/files/storybook.html` — fonte da verdade visual do projeto (PageByPage Design System v2.1).

Regras obrigatórias do DS:

#### Sistema de tokens dual (accent)
- `--accent-text` / `--accent-text-hover` → para **texto e ícones** com cor de destaque
  - Light: chocolate `#6B4423` / `#4A2E1A`
  - Dark: amarelo `#F5C518` / `#FFD43B`
- `--accent-surface` / `--accent-surface-hover` → para **fundos e fills** (botões primários, progress bars, ribbons)
  - Light: mostarda `#D4A72C` / `#E6B63D`
  - Dark: amarelo `#F5C518` / `#FFD43B`
- `--accent-soft` → fundo suave translúcido (hover states, pills ativas)
- `--accent-editorial` / `--accent-editorial-soft` → terracota, para alertas e ações editoriais

#### Regras críticas de uso
- **Nunca usar `--accent-surface` como cor de texto** — é token de superfície/fundo
- **Nunca usar `--accent-text` como fundo de botão primário** — é token de texto
- **Nunca usar hex hardcoded** — sempre usar tokens semânticos do DS
- **Nunca usar variáveis legadas** (`--gold`, `--olive`, `--yellow`) — foram migradas para os tokens acima
- `.btn-primary` usa `--accent-surface` no default e `--accent-surface-hover` no hover (não invertido)

#### Componentes-padrão do DS
- **Card**: `bg-card`, borda `border-subtle`, `radius-lg`, `shadow-sm`
- **Botão primário**: fundo `accent-surface`, texto `#1A1A1F`
- **Botão secundário**: transparente, borda `border-default`, hover `bg-card-hover`
- **Pill/filtro**: borda `border-subtle`, `bg-card`, cor `text-secondary`; ativo: `accent-soft` + `accent-border` + `accent-text`
- **Input focus**: borda `accent-border` + `box-shadow: 0 0 0 3px accent-soft`
- **Tab ativa**: `accent-surface` como underline (2px)
- **Progress fill**: `accent-surface`
- **Badge**: fundo `accent-soft`, texto `accent-text`

### CSS conventions

- Global design tokens live in `src/index.css` (`:root` block). Component styles use CSS Modules (`*.module.css` co-located with the component).
- Chart.js doughnut/bar wrappers need `width: 100%; position: relative` and their grid parent needs `min-width: 0` to prevent canvas blowout.

### Export / Import

`src/utils/export.ts` — produces a `.zip` (via JSZip) containing two CSVs: `livros.csv` and `registros.csv`. Separator is `;` (semicolon) for Excel PT-BR compatibility, with UTF-8 BOM.

`src/utils/import.ts` — parses the same `.zip` format. Also supports legacy single-CSV import via `src/utils/csvImport.ts`.
