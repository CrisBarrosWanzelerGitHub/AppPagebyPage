import type { Book, ReadingLog } from '../types';

const STATUS_REVERSE: Record<string, Book['status']> = {
  'Quero ler':  'want',
  'Lendo':      'reading',
  'Relendo':    'rereading',
  'Reler':      'rereading',
  'Lido':       'done',
  'Abandonado': 'abandoned',
};

/** Parse a single CSV row respecting RFC-4180 quoting with semicolon separator */
function parseRow(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ';') i++;
    } else {
      const end = line.indexOf(';', i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
  }
  return fields;
}

/** Convert several date formats → YYYY-MM-DD. Returns '' if unrecognised/empty. */
function parseDate(str: string): string {
  if (!str) return '';
  // Already ISO: 2025-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY or D/M/YYYY (4-digit year)
  const dmY4 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY4) return `${dmY4[3]}-${dmY4[2].padStart(2,'0')}-${dmY4[1].padStart(2,'0')}`;
  // DD/MM/YY or D/M/YY (2-digit year — interpret as 20YY)
  const dmY2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (dmY2) return `20${dmY2[3]}-${dmY2[2].padStart(2,'0')}-${dmY2[1].padStart(2,'0')}`;
  // DD-MM-YYYY or D-M-YYYY
  const dmYd = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmYd) return `${dmYd[3]}-${dmYd[2].padStart(2,'0')}-${dmYd[1].padStart(2,'0')}`;
  // YYYY/MM/DD
  const Ymd = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (Ymd) return `${Ymd[1]}-${Ymd[2]}-${Ymd[3]}`;
  return '';
}

/**
 * Distributes `totalPages` across every day between startDate and endDate,
 * creating one ReadingLog per day so the heatmap fills the full reading period.
 * Days listed in `excludedDates` are skipped (e.g. "Dias sem leitura" column).
 */
function makeBookLogs(
  bookId: string,
  bookTitle: string,
  startDate: string,
  endDate: string,
  totalPages: number,
  excludedDates: Set<string> = new Set(),
): ReadingLog[] {
  if (totalPages <= 0) return [];
  const todayStr = new Date().toISOString().split('T')[0];

  // Clamp both dates to today (no future logs)
  const effStart = startDate <= todayStr ? startDate : todayStr;
  const effEnd   = endDate   <= todayStr ? endDate   : todayStr;

  // Build list of days in range, skipping excluded dates
  const allDays: string[] = [];
  const cursor = new Date(effStart + 'T12:00:00');
  const last   = new Date((effEnd >= effStart ? effEnd : effStart) + 'T12:00:00');
  while (cursor <= last) {
    allDays.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  const days = allDays.filter(d => !excludedDates.has(d));

  if (days.length === 0) {
    return [{ id: crypto.randomUUID(), bookId, bookTitle, date: effStart, pages: totalPages }];
  }

  // Distribute pages evenly: base + 1 for the first `remainder` days
  const base      = Math.floor(totalPages / days.length);
  const remainder = totalPages - base * days.length;

  return days.map((date, idx) => ({
    id:        crypto.randomUUID(),
    bookId,
    bookTitle,
    date,
    pages:     base + (idx < remainder ? 1 : 0),
  })).filter(l => l.pages > 0);
}

/** Map ISO 639-1 (2-letter) and ISO 639-2/MARC (3-letter) codes to display names */
const LANGUAGE_NAMES: Record<string, string> = {
  // ISO 639-1 — Google Books
  pt: 'Português', en: 'Inglês',   es: 'Espanhol',
  fr: 'Francês',   de: 'Alemão',   it: 'Italiano',
  ja: 'Japonês',   ko: 'Coreano',  zh: 'Chinês',
  ar: 'Árabe',     ru: 'Russo',    nl: 'Holandês',
  // ISO 639-2 / MARC — Open Library
  por: 'Português', eng: 'Inglês',  spa: 'Espanhol',
  fre: 'Francês',   ger: 'Alemão',  ita: 'Italiano',
  jpn: 'Japonês',   kor: 'Coreano', chi: 'Chinês',
  ara: 'Árabe',     rus: 'Russo',   dut: 'Holandês',
};

function resolveLanguage(code: string): string {
  if (!code) return '';
  const lower = code.toLowerCase().trim();
  return LANGUAGE_NAMES[lower] || LANGUAGE_NAMES[lower.split('-')[0]] || code;
}

export interface CsvImportResult {
  books: Book[];
  historicalLogs: import('../types').ReadingLog[];
  errors: string[];
}

/**
 * Parse a Pagebypage library CSV (semicolon-separated, UTF-8 BOM optional).
 *
 * Expected columns (row 1 = header, skipped):
 * Livro | Autor | Gênero | Status | Tags | Total de páginas | Página atual |
 * Páginas lidas | Páginas restantes | % lido | Data início | Data fim | Nº de registros | Capa | ISBN
 *
 * Automatically generates ReadingLog entries from each book's pages-read data
 * so that charts and metrics are populated after import.
 */
export function parseLibraryCSV(text: string): CsvImportResult {
  // Strip BOM if present
  const clean = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== '');

  console.log('[CSV import] arquivo lido:', lines.length, 'linhas. Primeiros 200 chars:', clean.slice(0, 200));

  if (lines.length < 2) {
    return { books: [], historicalLogs: [], errors: ['Arquivo vazio ou sem dados.'] };
  }

  // Auto-detect separator: tab (Excel/Sheets export), semicolon (PageByPage), or comma
  const header = lines[0];
  const sep = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ',';
  console.log('[CSV import] separador detectado:', JSON.stringify(sep), '| cabeçalho:', header.slice(0, 100));

  // ── Resolve column indexes from header (robust against column additions) ──
  const headerFields = sep === ';'
    ? parseRow(lines[0])
    : lines[0].split(sep).map(v => v.replace(/^"|"$/g, '').trim());
  const col: Record<string, number> = {};
  headerFields.forEach((h, i) => { col[h.trim()] = i; });

  // Column helpers — named lookup with positional fallback for legacy CSVs
  const ci = (name: string, fallback: number): number => col[name] ?? fallback;

  const IDX = {
    title:        ci('Livro', 0),
    author:       ci('Autor', 1),
    genre:        ci('Gênero', 2),
    status:       ci('Status', 3),
    tags:         ci('Tags', 4),
    totalPages:   ci('Total de páginas', 5),
    currentPage:  ci('Página atual', 6),
    pagesRead:    ci('Páginas lidas (sessão atual)', ci('Páginas lidas', 7)),
    startDate:    ci('Data início', 10),
    endDate:      ci('Data fim', 11),
    cover:        ci('Capa (URL)', ci('Capa', 13)),
    isbn:         ci('ISBN', 14),
    store:        ci('Onde encontrar / plataforma', ci('Onde encontrar', 15)),
    language:     ci('Idioma', -1),
    format:       ci('Formato', -1),
    // "Dias sem leitura" column — find by partial match (header text is very long)
    daysOff:      Object.keys(col).findIndex(k => k.startsWith('Dias sem leitura')),
  };

  const histIdx  = lines.findIndex(l => l.includes('HISTÓRICO IMPORTADO'));
  const dataLines = histIdx > 0 ? lines.slice(1, histIdx) : lines.slice(1);

  // ── Pré-passagem: coleta coluna "Dias sem leitura" de todas as linhas ─────
  const globalExcluded = new Set<string>();
  if (IDX.daysOff >= 0) {
    for (const line of dataLines) {
      const f = sep === ';'
        ? parseRow(line)
        : line.split(sep).map(v => v.replace(/^"|"$/g, '').trim());
      const raw = f[IDX.daysOff]?.trim() || '';
      if (raw) {
        const iso = parseDate(raw);
        if (iso) globalExcluded.add(iso);
      }
    }
  }
  if (globalExcluded.size > 0) {
    console.log('[CSV import] Dias sem leitura (global):', globalExcluded.size, [...globalExcluded]);
  }

  const books: Book[] = [];
  const historicalLogs: ReadingLog[] = [];
  const errors: string[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < dataLines.length; i++) {
    // Use detected separator
    const f = sep === ';'
      ? parseRow(dataLines[i])
      : dataLines[i].split(sep).map(v => v.replace(/^"|"$/g, '').trim());

    const title        = f[IDX.title]?.trim()       || '';
    const author       = f[IDX.author]?.trim()      || '';
    const genre        = f[IDX.genre]?.trim()       || '';
    const statusLabel  = f[IDX.status]?.trim()      || '';
    const tagsRaw      = f[IDX.tags]?.trim()        || '';
    const totalPages   = parseInt(f[IDX.totalPages]  ?? '') || 0;
    const currentPage  = parseInt(f[IDX.currentPage] ?? '') || 0;
    const pagesReadCol = parseInt(f[IDX.pagesRead]   ?? '');
    const startDateStr = f[IDX.startDate]?.trim()   || '';
    const endDateStr   = f[IDX.endDate]?.trim()     || '';
    const cover        = f[IDX.cover]?.trim()       || '';
    const isbnRaw      = f[IDX.isbn]?.trim()        || '';
    // Normalise scientific notation ISBNs produced by Excel (e.g. "9,79E+12" → "9790000000000")
    const isbn = /^\d+[,.]?\d*[eE]\+?\d+$/.test(isbnRaw)
      ? String(Math.round(parseFloat(isbnRaw.replace(',', '.'))))
      : isbnRaw;
    const store        = IDX.store >= 0 ? (f[IDX.store]?.trim() || '') : '';

    if (!title) {
      errors.push(`Linha ${i + 2}: título ausente, ignorada.`);
      continue;
    }

    const status: Book['status'] = STATUS_REVERSE[statusLabel] ?? 'want';
    const tags = tagsRaw
      ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean)
      : [];
    const startDate = parseDate(startDateStr) || undefined;
    const endDate   = parseDate(endDateStr)   || undefined;

    const rawLanguage = IDX.language >= 0 ? resolveLanguage(f[IDX.language]?.trim() || '') : '';
    const rawFormat   = IDX.format   >= 0 ? (f[IDX.format]?.trim()   || '') : '';
    const parsedFormat: Book['format'] =
      rawFormat === 'Físico' ? 'physical' :
      rawFormat === 'Digital' ? 'digital' : undefined;

    const book: Book = {
      id:          crypto.randomUUID(),
      title,
      author,
      genre,
      status,
      tags,
      pages:       totalPages,
      currentPage,
      cover,
      isbn:        isbn          || undefined,
      store:       store         || undefined,
      language:    rawLanguage   || undefined,
      format:      parsedFormat,
      startDate,
      endDate,
    };
    books.push(book);

    // ── Generate reading logs from this book's pages ──────────────────────
    // Use "Páginas lidas" if valid, fall back to currentPage
    const pagesRead = (pagesReadCol > 0) ? pagesReadCol : (currentPage > 0 ? currentPage : 0);

    // Generate logs for any book with pages read, regardless of status
    // (status may be wrong in external CSVs; pages > 0 is the reliable signal)
    if (pagesRead > 0) {
      const logStart = startDate || todayStr;
      const logEnd   = endDate   || todayStr;
      historicalLogs.push(...makeBookLogs(book.id, book.title, logStart, logEnd, pagesRead, globalExcluded));
    }

    console.log(`[CSV import] "${title}" | status="${statusLabel}"→${status} | pages=${totalPages} | pagesRead=${pagesRead} | rawStart="${startDateStr}"→${startDate} | rawEnd="${endDateStr}"→${endDate} | logs=${pagesRead > 0 ? '✓' : '✗ (0 páginas)'}`);
  }

  // ── Parse HISTÓRICO IMPORTADO section ────────────────────────────────────
  if (histIdx > 0) {
    const histLines = lines.slice(histIdx + 2); // skip separator + "Data;Páginas" header
    for (const line of histLines) {
      const parts = line.split(';');
      const date  = parts[0]?.trim();
      const pages = parseInt(parts[1]) || 0;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && pages > 0) {
        historicalLogs.push({
          id:        crypto.randomUUID(),
          bookId:    '__historical__',
          bookTitle: 'Histórico importado',
          date,
          pages,
        });
      }
    }
  }

  return { books, historicalLogs, errors };
}
