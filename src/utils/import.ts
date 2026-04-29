import JSZip from 'jszip';
import type { Book, ReadingLog } from '../types';

/** Converte DD/MM/YYYY → YYYY-MM-DD */
function fromDisplayDate(ddmmyyyy: string): string {
  if (!ddmmyyyy) return '';
  const parts = ddmmyyyy.trim().split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Parser CSV simples que respeita campos com aspas */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const STATUS_MAP: Record<string, Book['status']> = {
  'Quero ler': 'want',
  'Lendo': 'reading',
  'Lido': 'done',
  'Abandonado': 'abandoned',
};

export async function importFromZip(
  file: File
): Promise<{ books: Book[]; logs: ReadingLog[] }> {
  const zip = await JSZip.loadAsync(file);
  const books: Book[] = [];
  const logs: ReadingLog[] = [];

  const booksFile = zip.file('pagebypage_livros.csv');
  if (booksFile) {
    const raw = await booksFile.async('string');
    const lines = raw.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 9) continue;
      const [title, author, genre, pages, status, tags, startDate, endDate, currentPage] = cols;
      if (!title.trim()) continue;
      books.push({
        id: crypto.randomUUID(),
        title: title.trim(),
        author: author.trim(),
        genre: genre.trim(),
        pages: parseInt(pages) || 0,
        cover: '',
        status: STATUS_MAP[status.trim()] ?? 'want',
        tags: tags ? tags.split(';').map(t => t.trim()).filter(Boolean) : [],
        startDate: fromDisplayDate(startDate) || undefined,
        endDate: fromDisplayDate(endDate) || undefined,
        currentPage: parseInt(currentPage) || 0,
      });
    }
  }

  const logsFile = zip.file('pagebypage_registros.csv');
  if (logsFile) {
    const raw = await logsFile.async('string');
    const lines = raw.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue;
      const [date, bookTitle, pagesRead, currentPage] = cols;
      const parsedDate = fromDisplayDate(date);
      if (!parsedDate || !bookTitle.trim()) continue;
      const matchedBook = books.find(b => b.title === bookTitle.trim());
      logs.push({
        id: crypto.randomUUID(),
        bookId: matchedBook?.id ?? '__imported__',
        bookTitle: bookTitle.trim(),
        date: parsedDate,
        pages: parseInt(pagesRead) || 0,
        currentPage: parseInt(currentPage) || undefined,
      });
    }
  }

  return { books, logs };
}

// ─── Distribuição de páginas ao longo de um período ───────────────────────────

/** Gera uma lista de datas (YYYY-MM-DD) entre start e end (inclusive) */
function daysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(start + 'T12:00:00');
  const last   = new Date(end   + 'T12:00:00');
  while (cursor <= last) {
    days.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function makeHistoricalLogsForMonth(
  year: number,
  month: number,
  totalPages: number,
): ReadingLog[] {
  if (totalPages <= 0) return [];
  const todayStr  = new Date().toISOString().split('T')[0];
  const lastDayNum = new Date(year, month, 0).getDate();
  const lastDay   = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
  const date      = lastDay <= todayStr ? lastDay : todayStr;
  return [{
    id: crypto.randomUUID(),
    bookId: '__historical__',
    bookTitle: 'Histórico importado',
    date,
    pages: totalPages,
  }];
}

export function makeHistoricalLogsForPeriod(
  startDate: string,
  endDate: string,
  totalPages: number,
): ReadingLog[] {
  if (totalPages <= 0) return [];
  const days = daysInRange(startDate, endDate);
  if (days.length === 0) return [];

  // Group days by YYYY-MM
  const byMonth = new Map<string, string[]>();
  for (const day of days) {
    const key = day.substring(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(day);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const entries  = Array.from(byMonth.entries());
  const logs: ReadingLog[] = [];
  let pagesAssigned = 0;

  entries.forEach(([monthKey, monthDays], idx) => {
    const [y, m] = monthKey.split('-').map(Number);
    const lastDayNum = new Date(y, m, 0).getDate();
    const lastDay    = `${monthKey}-${String(lastDayNum).padStart(2, '0')}`;
    const date       = lastDay <= todayStr ? lastDay : todayStr;

    let pages: number;
    if (idx === entries.length - 1) {
      pages = totalPages - pagesAssigned;
    } else {
      pages = Math.round(totalPages * (monthDays.length / days.length));
      pagesAssigned += pages;
    }

    if (pages > 0) {
      logs.push({
        id: crypto.randomUUID(),
        bookId: '__historical__',
        bookTitle: 'Histórico importado',
        date,
        pages,
      });
    }
  });

  return logs;
}
