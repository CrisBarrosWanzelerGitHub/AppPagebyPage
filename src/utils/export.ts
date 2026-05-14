import JSZip from 'jszip';
import type { Book, ReadingLog } from '../types';
import { toDisplayDate } from './dates';

const BOM = '\uFEFF'; // UTF-8 BOM so Excel opens with correct encoding

/** Escape a single CSV cell (semicolon separator for better Excel-PT-BR compat) */
function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes(',')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Force-quote a field so Excel always treats it as text (e.g. ISBNs) */
function escText(value: string | undefined | null): string {
  if (!value) return '';
  return `"${String(value).replace(/"/g, '""')}"`;
}

const STATUS_MAP: Record<Book['status'], string> = {
  want:       'Quero ler',
  reading:    'Lendo',
  rereading:  'Relendo',
  done:       'Lido',
  abandoned:  'Abandonado',
};

function generateHistoricalSection(logs: ReadingLog[]): string {
  const histLogs = logs
    .filter(l => l.bookId === '__historical__')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (histLogs.length === 0) return '';
  const header = '\n\n;;HISTÓRICO IMPORTADO;;\nData;Páginas';
  const rows = histLogs.map(l => `${l.date};${l.pages}`);
  return header + '\n' + rows.join('\n');
}

function generateLibraryCSV(books: Book[], logs: ReadingLog[]): string {
  const headers = [
    'Livro',
    'Autor',
    'Gênero',
    'Status',
    'Tags',
    'Total de páginas',
    'Página atual',
    'Páginas lidas (sessão atual)',
    'Páginas restantes',
    '% lido',
    'Data início',
    'Data fim',
    'Nº de registros',
    'Releituras concluídas',
    'Total de páginas (todas as leituras)',
    'Capa (URL)',
    'ISBN',
    'Onde encontrar / plataforma',
    'Idioma',
    'Formato',
    'Dias sem leitura — lista global (DD/MM/AAAA, uma por linha)',
  ].join(';');

  const rows = books.map(b => {
    const startPage         = b.startPage ?? 0;
    const pagesRead         = Math.max(0, b.currentPage - startPage);
    const pagesRemaining    = b.pages > 0 ? Math.max(0, b.pages - b.currentPage) : '';
    const pctRead           = b.pages > 0 ? `${Math.round((b.currentPage / b.pages) * 100)}%` : '';
    const logCount          = logs.filter(l => l.bookId === b.id).length;
    const endDate           = b.status === 'done' ? toDisplayDate(b.endDate || '') : '';
    const rereadsCompleted  = b.readSessions?.length ?? 0;
    const sessionPagesTotal = (b.readSessions ?? []).reduce((sum, s) => sum + s.totalPages, 0);
    const allTimePagesRead  = sessionPagesTotal + pagesRead;

    return [
      esc(b.title),
      esc(b.author),
      esc(b.genre),
      esc(STATUS_MAP[b.status]),
      esc(b.tags.join('; ')),
      esc(b.pages),
      esc(b.currentPage),
      esc(pagesRead),
      esc(pagesRemaining),
      esc(pctRead),
      esc(toDisplayDate(b.startDate || '')),
      esc(endDate),
      esc(logCount),
      esc(rereadsCompleted),
      esc(allTimePagesRead),
      esc(b.cover),
      escText(b.isbn),
      esc(b.store),
      esc(b.language),
      esc(b.format === 'physical' ? 'Físico' : b.format === 'digital' ? 'Digital' : ''),
      '', // Dias sem leitura — preencher manualmente na planilha (uma data por linha)
    ].join(';');
  });

  return BOM + [headers, ...rows].join('\n') + generateHistoricalSection(logs);
}

export async function downloadTemplate(): Promise<void> {
  const headers = [
    'Livro',
    'Autor',
    'Gênero',
    'Status',
    'Tags',
    'Total de páginas',
    'Página atual',
    'Páginas lidas (sessão atual)',
    'Páginas restantes',
    '% lido',
    'Data início',
    'Data fim',
    'Nº de registros',
    'Releituras concluídas',
    'Total de páginas (todas as leituras)',
    'Capa (URL)',
    'ISBN',
    'Onde encontrar / plataforma',
    'Idioma',
    'Formato',
    'Dias sem leitura — lista global (DD/MM/AAAA, uma por linha)',
  ].join(';');

  const examples = [
    // Dom Casmurro: lido, com 1 releitura concluída (total 512 págs entre as duas leituras); 07/01/2024 = dia sem leitura
    'Dom Casmurro;Machado de Assis;Romance;Lido;clássico;256;256;256;0;100%;01/01/2024;15/01/2024;12;1;512;;9788525406958;;Português;Físico;07/01/2024',
    // O Senhor dos Anéis: lendo pela 1ª vez, início em 10/01/2024
    'O Senhor dos Anéis;J.R.R. Tolkien;Fantasia;Lendo;favorito;1200;340;340;860;28%;10/01/2024;;8;0;340;;;;;;',
    // Sapiens: quero ler
    'Sapiens;Yuval Noah Harari;História;Quero ler;;464;0;0;464;0%;;;0;0;0;;;;;;;',
  ].join('\n');

  const csv = BOM + [headers, examples].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'pagebypage_modelo.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportBackup(books: Book[], logs: ReadingLog[]): Promise<void> {
  const zip     = new JSZip();
  const dateStr = new Date().toISOString().split('T')[0];

  // JSON completo — preserva todos os campos (readSessions, cover, isbn, store, etc.)
  zip.file('books.json', JSON.stringify(books, null, 2));
  zip.file('logs.json',  JSON.stringify(logs,  null, 2));

  // CSV legível no Excel
  zip.file('biblioteca.csv', generateLibraryCSV(books, logs));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = `pagebypage_backup_${dateStr}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportData(books: Book[], logs: ReadingLog[]): Promise<void> {
  const csv     = generateLibraryCSV(books, logs);
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];

  const a = document.createElement('a');
  a.href = url;
  a.download = `pagebypage_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
