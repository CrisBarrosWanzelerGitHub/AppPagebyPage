# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### CSS conventions

- Global design tokens live in `src/index.css` (`:root` block). Component styles use CSS Modules (`*.module.css` co-located with the component).
- **Token aliases**: `--gold`, `--olive`, `--accent` all map to `--accent-text` (`#6B4423` light / `#F5C518` dark). Use the semantic aliases, not the raw hex.
- The darker brown is `--accent-text-hover` (`#4A2E1A` light). Gold highlight backgrounds use `--accent-surface` (`#D4A72C`).
- Chart.js doughnut/bar wrappers need `width: 100%; position: relative` and their grid parent needs `min-width: 0` to prevent canvas blowout.

### Export / Import

`src/utils/export.ts` — produces a `.zip` (via JSZip) containing two CSVs: `livros.csv` and `registros.csv`. Separator is `;` (semicolon) for Excel PT-BR compatibility, with UTF-8 BOM.

`src/utils/import.ts` — parses the same `.zip` format. Also supports legacy single-CSV import via `src/utils/csvImport.ts`.
