import { useState, useRef, useEffect } from 'react';
import type { AppState, Book, Goals, ReadingLog } from '../types';
import { exportData, exportBackup, downloadTemplate } from '../utils/export';
import { makeHistoricalLogsForPeriod, makeHistoricalLogsForMonth } from '../utils/import';
import { parseLibraryCSV } from '../utils/csvImport';
import { today } from '../utils/dates';
import styles from './Settings.module.css';

interface Props {
  state: AppState;
  setGoals: (goals: Goals) => void;
  resetData: () => void;
  addLogs: (logs: ReadingLog[]) => void;
  addBooks: (books: Book[]) => void;
  deleteLogs: (ids: string[]) => void;
  importData: (books: Book[], logs: ReadingLog[]) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  [key: string]: unknown;
}

interface CsvPreview {
  found: number;
  skipped: number;
  toAdd: Book[];
  histLogs: import('../types').ReadingLog[];
  errors: string[];
  fileName: string;
}

type HistMode = 'period' | 'month';

interface PeriodEntry { start: string; end: string; pages: string; }
interface MonthEntry  { year: string; month: string; pages: string; }

const NOW    = new Date();
const CUR_Y  = NOW.getFullYear();
const CUR_M  = NOW.getMonth() + 1; // 1-12

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export default function Settings({ state, setGoals, resetData, addLogs, addBooks, deleteLogs, importData, showToast }: Props) {
  const { goals, books, logs } = state;



  // ── Goals ────────────────────────────────────────────────────────────────
  const [yearPages,  setYearPages]  = useState(String(goals.yearPages));
  const [monthPages, setMonthPages] = useState(String(goals.monthPages));

  // ── Monthly goals grid ───────────────────────────────────────────────────
  const [monthlyGoalsYear, setMonthlyGoalsYear] = useState(CUR_Y);
  const [monthlyGoalsInputs, setMonthlyGoalsInputs] = useState<string[]>(() =>
    Array.from({ length: 12 }, (_, i) => {
      const key = `${CUR_Y}-${String(i + 1).padStart(2, '0')}`;
      const v = goals.monthlyGoals?.[key];
      return v !== undefined ? String(v) : '';
    })
  );
  // Tracks which month indices were set specifically (vs. auto-filled from default)
  const [manualMonths, setManualMonths] = useState<Set<number>>(() => {
    const s = new Set<number>();
    Array.from({ length: 12 }, (_, i) => {
      const key = `${CUR_Y}-${String(i + 1).padStart(2, '0')}`;
      if (goals.monthlyGoals?.[key] !== undefined) s.add(i);
    });
    return s;
  });

  // ── Undo snapshot ────────────────────────────────────────────────────────
  // Captura o estado na montagem e é atualizado só ao clicar em "Salvar metas mensais"
  // (nunca ao pressionar Enter nos inputs — garante que o undo reverta para o último save explícito)
  const undoSnapshotRef = useRef({
    monthlyGoals: goals.monthlyGoals,
    monthPages:   goals.monthPages,
  });

  // Sync inputs + manual set when year changes or goals.monthlyGoals updates
  useEffect(() => {
    setMonthlyGoalsInputs(Array.from({ length: 12 }, (_, i) => {
      const key = `${monthlyGoalsYear}-${String(i + 1).padStart(2, '0')}`;
      const v = goals.monthlyGoals?.[key];
      return v !== undefined ? String(v) : '';
    }));
    const s = new Set<number>();
    Array.from({ length: 12 }, (_, i) => {
      const key = `${monthlyGoalsYear}-${String(i + 1).padStart(2, '0')}`;
      if (goals.monthlyGoals?.[key] !== undefined) s.add(i);
    });
    setManualMonths(s);
  }, [monthlyGoalsYear, goals.monthlyGoals]);

  // Atualiza o snapshot de undo quando o ano muda (novo contexto de edição)
  useEffect(() => {
    undoSnapshotRef.current = { monthlyGoals: goals.monthlyGoals, monthPages: goals.monthPages };
  // Intencionalmente depende só do ano — não queremos atualizar o snapshot a cada save automático
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyGoalsYear]);

  // ── Quick history import ─────────────────────────────────────────────────
  const [histMode, setHistMode] = useState<HistMode>('period');
  const [periods, setPeriods] = useState<PeriodEntry[]>([
    { start: `${CUR_Y}-01-01`, end: today(), pages: '' },
  ]);
  const [months, setMonths] = useState<MonthEntry[]>([
    { year: String(CUR_Y), month: String(CUR_M), pages: '' },
  ]);

  // ── CSV import ───────────────────────────────────────────────────────────
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  // ── Export / Reset ───────────────────────────────────────────────────────
  const [exporting, setExporting]             = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ─── Test data ────────────────────────────────────────────────────────────
  const [showTestConfirm, setShowTestConfirm] = useState(false);

  function loadTestData() {
    // Não usa crypto.randomUUID() — exige HTTPS; aqui usamos Math.random()
    let _c = 0;
    const uid = () => `test-${Date.now()}-${++_c}-${Math.random().toString(36).slice(2)}`;

    const daysAgo = (n: number) => {
      const d = new Date(); d.setDate(d.getDate() - n);
      return d.toISOString().split('T')[0];
    };

    const b1 = uid(), b2 = uid(), b3 = uid(), b4 = uid(), b5 = uid(), b6 = uid();

    const testBooks: Book[] = [
      { id: b1, title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'História', pages: 464,
        cover: 'https://covers.openlibrary.org/b/id/8739161-M.jpg',
        status: 'reading', tags: ['não-ficção', 'história'], startDate: daysAgo(20), currentPage: 200 },
      { id: b2, title: 'Duna', author: 'Frank Herbert', genre: 'Ficção Científica', pages: 688,
        cover: 'https://covers.openlibrary.org/b/id/8225263-M.jpg',
        status: 'reading', tags: ['sci-fi', 'ficção'], startDate: daysAgo(12), currentPage: 130 },
      { id: b3, title: '1984', author: 'George Orwell', genre: 'Distopia', pages: 328,
        cover: 'https://covers.openlibrary.org/b/id/8575708-M.jpg',
        status: 'reading', tags: ['clássico', 'ficção'], startDate: daysAgo(7), currentPage: 70 },
      { id: b4, title: 'O Guia do Mochileiro das Galáxias', author: 'Douglas Adams', genre: 'Humor', pages: 193,
        cover: 'https://covers.openlibrary.org/b/id/7222246-M.jpg',
        status: 'reading', tags: ['ficção', 'humor'], startDate: daysAgo(4), currentPage: 45 },
      { id: b5, title: 'O Pequeno Príncipe', author: 'Antoine de Saint-Exupéry', genre: 'Literatura', pages: 96,
        cover: 'https://covers.openlibrary.org/b/id/9281477-M.jpg',
        status: 'done', tags: ['clássico'], startDate: daysAgo(55), endDate: daysAgo(40), currentPage: 96 },
      { id: b6, title: 'Cem Anos de Solidão', author: 'Gabriel García Márquez', genre: 'Realismo Mágico', pages: 448,
        cover: 'https://covers.openlibrary.org/b/id/8232932-M.jpg',
        status: 'done', tags: ['clássico', 'ficção'], startDate: daysAgo(100), endDate: daysAgo(56), currentPage: 448 },
    ];

    const testLogs: ReadingLog[] = [
      // Sapiens
      { id: uid(), bookId: b1, bookTitle: 'Sapiens', date: daysAgo(20), pages: 22, currentPage: 22 },
      { id: uid(), bookId: b1, bookTitle: 'Sapiens', date: daysAgo(17), pages: 28, currentPage: 50 },
      { id: uid(), bookId: b1, bookTitle: 'Sapiens', date: daysAgo(14), pages: 35, currentPage: 85 },
      { id: uid(), bookId: b1, bookTitle: 'Sapiens', date: daysAgo(11), pages: 30, currentPage: 115 },
      { id: uid(), bookId: b1, bookTitle: 'Sapiens', date: daysAgo(7),  pages: 40, currentPage: 155 },
      { id: uid(), bookId: b1, bookTitle: 'Sapiens', date: daysAgo(4),  pages: 25, currentPage: 180 },
      { id: uid(), bookId: b1, bookTitle: 'Sapiens', date: daysAgo(1),  pages: 20, currentPage: 200 },
      // Duna
      { id: uid(), bookId: b2, bookTitle: 'Duna', date: daysAgo(12), pages: 45, currentPage: 45 },
      { id: uid(), bookId: b2, bookTitle: 'Duna', date: daysAgo(9),  pages: 30, currentPage: 75 },
      { id: uid(), bookId: b2, bookTitle: 'Duna', date: daysAgo(6),  pages: 35, currentPage: 110 },
      { id: uid(), bookId: b2, bookTitle: 'Duna', date: daysAgo(3),  pages: 20, currentPage: 130 },
      // 1984
      { id: uid(), bookId: b3, bookTitle: '1984', date: daysAgo(7),  pages: 35, currentPage: 35 },
      { id: uid(), bookId: b3, bookTitle: '1984', date: daysAgo(4),  pages: 20, currentPage: 55 },
      { id: uid(), bookId: b3, bookTitle: '1984', date: daysAgo(2),  pages: 15, currentPage: 70 },
      // Guia do Mochileiro
      { id: uid(), bookId: b4, bookTitle: 'O Guia do Mochileiro das Galáxias', date: daysAgo(4), pages: 30, currentPage: 30 },
      { id: uid(), bookId: b4, bookTitle: 'O Guia do Mochileiro das Galáxias', date: daysAgo(1), pages: 15, currentPage: 45 },
      // Pequeno Príncipe (concluído)
      { id: uid(), bookId: b5, bookTitle: 'O Pequeno Príncipe', date: daysAgo(55), pages: 40, currentPage: 40 },
      { id: uid(), bookId: b5, bookTitle: 'O Pequeno Príncipe', date: daysAgo(50), pages: 30, currentPage: 70 },
      { id: uid(), bookId: b5, bookTitle: 'O Pequeno Príncipe', date: daysAgo(40), pages: 26, currentPage: 96 },
      // Cem Anos de Solidão (concluído)
      { id: uid(), bookId: b6, bookTitle: 'Cem Anos de Solidão', date: daysAgo(100), pages: 60, currentPage: 60 },
      { id: uid(), bookId: b6, bookTitle: 'Cem Anos de Solidão', date: daysAgo(90),  pages: 80, currentPage: 140 },
      { id: uid(), bookId: b6, bookTitle: 'Cem Anos de Solidão', date: daysAgo(80),  pages: 70, currentPage: 210 },
      { id: uid(), bookId: b6, bookTitle: 'Cem Anos de Solidão', date: daysAgo(70),  pages: 75, currentPage: 285 },
      { id: uid(), bookId: b6, bookTitle: 'Cem Anos de Solidão', date: daysAgo(60),  pages: 90, currentPage: 375 },
      { id: uid(), bookId: b6, bookTitle: 'Cem Anos de Solidão', date: daysAgo(56),  pages: 73, currentPage: 448 },
    ];

    importData(testBooks, testLogs);
    setShowTestConfirm(false);
    showToast('Dados de teste carregados!');
  }

  // ─── Goals ────────────────────────────────────────────────────────────────
  function handleSaveGoals(e: React.FormEvent) {
    e.preventDefault();
    const y = parseInt(yearPages);
    if (!y || y < 1) {
      showToast('Informe um valor válido para a meta anual.', 'error');
      return;
    }
    setGoals({ yearPages: y, monthPages: goals.monthPages, monthlyGoals: goals.monthlyGoals });
    showToast('Meta anual salva!');
  }

  // ─── Monthly goal grid ─────────────────────────────────────────────────────

  /** Reverte metas mensais para o snapshot (último "Salvar" explícito ou estado inicial) */
  function handleUndoMonthlyGoals() {
    const snap = undoSnapshotRef.current;
    // Reverte tanto os dados salvos quanto os inputs visuais
    setGoals({
      yearPages:    goals.yearPages,
      monthPages:   snap.monthPages,
      monthlyGoals: snap.monthlyGoals,
    });
    setMonthlyGoalsInputs(Array.from({ length: 12 }, (_, i) => {
      const key = `${monthlyGoalsYear}-${String(i + 1).padStart(2, '0')}`;
      const v = snap.monthlyGoals?.[key];
      return v !== undefined ? String(v) : '';
    }));
    const s = new Set<number>();
    Array.from({ length: 12 }, (_, i) => {
      const key = `${monthlyGoalsYear}-${String(i + 1).padStart(2, '0')}`;
      if (snap.monthlyGoals?.[key] !== undefined) s.add(i);
    });
    setManualMonths(s);
    setMonthPages(String(snap.monthPages));
    showToast('Alterações desfeitas.');
  }

  function handleClearMonthlyGoals() {
    const updated: Record<string, number> = { ...(goals.monthlyGoals ?? {}) };
    for (let m = 1; m <= 12; m++) {
      delete updated[`${monthlyGoalsYear}-${String(m).padStart(2, '0')}`];
    }
    setGoals({ ...goals, monthlyGoals: Object.keys(updated).length > 0 ? updated : undefined });
    setMonthlyGoalsInputs(Array(12).fill(''));
    setManualMonths(new Set<number>());
    showToast(`Metas de ${monthlyGoalsYear} removidas.`);
  }

  /** Salva metas mensais com os valores fornecidos (sem depender de estado do React) */
  function saveMonthlyGoalsNow(defaultVal: string, inputs: string[]) {
    const m = parseInt(defaultVal);
    if (!m || m < 1) {
      showToast('Informe um valor válido para a meta padrão mensal.', 'error');
      return;
    }
    const updated: Record<string, number> = { ...(goals.monthlyGoals ?? {}) };
    inputs.forEach((val, i) => {
      const key = `${monthlyGoalsYear}-${String(i + 1).padStart(2, '0')}`;
      const num = parseInt(val);
      if (num > 0) updated[key] = num;
      else delete updated[key];
    });
    setGoals({
      yearPages: goals.yearPages,
      monthPages: m,
      monthlyGoals: Object.keys(updated).length > 0 ? updated : undefined,
    });
    showToast('Metas mensais salvas!');
  }

  function handleSaveMonthlyGoals(e: React.FormEvent) {
    e.preventDefault();
    const m = parseInt(monthPages);
    if (!m || m < 1) { saveMonthlyGoalsNow(monthPages, monthlyGoalsInputs); return; }
    // Calcula o estado que vai ser salvo e atualiza o snapshot de undo
    const updated: Record<string, number> = { ...(goals.monthlyGoals ?? {}) };
    monthlyGoalsInputs.forEach((val, i) => {
      const key = `${monthlyGoalsYear}-${String(i + 1).padStart(2, '0')}`;
      const num = parseInt(val);
      if (num > 0) updated[key] = num; else delete updated[key];
    });
    undoSnapshotRef.current = {
      monthlyGoals: Object.keys(updated).length > 0 ? updated : undefined,
      monthPages:   m,
    };
    saveMonthlyGoalsNow(monthPages, monthlyGoalsInputs);
  }

  // ─── Period entries ────────────────────────────────────────────────────────
  function removePeriod(i: number) {
    setPeriods(p => p.filter((_, idx) => idx !== i));
  }
  function updatePeriod(i: number, field: keyof PeriodEntry, value: string) {
    setPeriods(p => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  // ─── Month entries ─────────────────────────────────────────────────────────
  function removeMonth(i: number) {
    setMonths(m => m.filter((_, idx) => idx !== i));
  }
  function updateMonth(i: number, field: keyof MonthEntry, value: string) {
    setMonths(m => m.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  // ─── Submit history ────────────────────────────────────────────────────────
  function handleHistSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newLogs: ReadingLog[] = [];

    if (histMode === 'period') {
      for (const en of periods) {
        const p = parseInt(en.pages);
        if (!en.start || !en.end || !p || p <= 0) continue;
        if (en.end < en.start) { showToast('Data final deve ser maior que a inicial.', 'error'); return; }
        newLogs.push(...makeHistoricalLogsForPeriod(en.start, en.end, p));
      }
    } else {
      for (const en of months) {
        const p = parseInt(en.pages);
        const y = parseInt(en.year);
        const m = parseInt(en.month);
        if (!y || !m || !p || p <= 0) continue;
        newLogs.push(...makeHistoricalLogsForMonth(y, m, p));
      }
    }

    if (newLogs.length === 0) {
      showToast('Preencha pelo menos uma entrada válida.', 'error');
      return;
    }
    addLogs(newLogs);
    showToast(`${newLogs.length} registro(s) adicionado(s) ao histórico!`);
    // Reset form
    setPeriods([{ start: `${CUR_Y}-01-01`, end: today(), pages: '' }]);
    setMonths([{ year: String(CUR_Y), month: String(CUR_M), pages: '' }]);
  }

  // ─── CSV import ────────────────────────────────────────────────────────────
  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      showToast('Selecione um arquivo .csv exportado pelo Pagebypage.', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { books: parsed, historicalLogs, errors } = parseLibraryCSV(text);
      const existingTitles = new Set(books.map(b => b.title.toLowerCase().trim()));
      const toAdd = parsed.filter(b => !existingTitles.has(b.title.toLowerCase().trim()));
      const skipped = parsed.length - toAdd.length;
      setCsvPreview({ found: parsed.length, skipped, toAdd, histLogs: historicalLogs, errors, fileName: file.name });
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  function handleCsvImportConfirm() {
    if (!csvPreview || (csvPreview.toAdd.length === 0 && csvPreview.histLogs.length === 0)) return;
    setCsvImporting(true);
    if (csvPreview.toAdd.length > 0) addBooks(csvPreview.toAdd);
    if (csvPreview.histLogs.length > 0) addLogs(csvPreview.histLogs);
    const parts: string[] = [];
    if (csvPreview.toAdd.length > 0) parts.push(`${csvPreview.toAdd.length} livro(s)`);
    if (csvPreview.histLogs.length > 0) parts.push(`${csvPreview.histLogs.length} registro(s) de histórico`);
    showToast(`${parts.join(' e ')} importado(s) com sucesso!`);
    setCsvPreview(null);
    setCsvImporting(false);
  }

  // ─── Export / Reset ────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      await exportData(books, logs);
      showToast('Biblioteca exportada com sucesso!');
    } catch {
      showToast('Erro ao exportar dados.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleBackup() {
    setExporting(true);
    try {
      await exportBackup(books, logs);
      showToast('Backup gerado com sucesso!');
    } catch {
      showToast('Erro ao gerar backup.', 'error');
    } finally {
      setExporting(false);
    }
  }

  function handleReset() {
    resetData();
    setShowResetConfirm(false);
    setYearPages('5000');
    setMonthPages('420');
    showToast('Dados resetados.');
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>

      {/* ─── Goals ──────────────────────────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Metas de leitura</h2>
        <form onSubmit={handleSaveGoals}>
          <div className="field">
            <label className="label">Meta de páginas por ano</label>
            <input className="form-input" type="text" inputMode="numeric" value={yearPages}
              onChange={e => setYearPages(e.target.value)}
              placeholder="ex: 5000 ou 365×20"
              onBlur={() => {
                try {
                  const result = Math.round(Function('"use strict"; return (' + yearPages + ')')());
                  if (result > 0) setYearPages(String(result));
                } catch { /* mantém o valor atual se inválido */ }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }} />
            <div className={styles.hint}>
              {Math.round(parseInt(yearPages) / 365) || 0} páginas/dia — aceita número ou fórmula (ex: <code>365*20</code>)
            </div>
          </div>
          <div className={styles.actions}>
            <button type="submit" className="btn-primary" onMouseDown={e => e.preventDefault()}>Salvar meta anual</button>
          </div>
        </form>
      </div>

      {/* ─── Monthly Goals ──────────────────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Metas mensais</h2>
        <p className={styles.desc}>
          Defina uma meta para cada mês. Campos em branco usam a meta padrão configurada abaixo.
        </p>
        <form onSubmit={handleSaveMonthlyGoals}>
          <div className={styles.inlineGoalRow}>
            <span className={styles.inlineGoalLabel}>
              Meta padrão{' '}
              <span style={{ fontWeight: 400 }}>(meses sem meta específica)</span>
            </span>
            <input
              className={`form-input ${styles.inlineGoalInput}`}
              type="text"
              inputMode="numeric"
              value={monthPages}
              onChange={e => setMonthPages(e.target.value)}
              placeholder="420"
              onBlur={() => {
                let resolved = monthPages;
                try {
                  const result = Math.round(Function('"use strict"; return (' + monthPages + ')')());
                  if (result > 0) { resolved = String(result); setMonthPages(resolved); }
                } catch { /* mantém o valor atual se inválido */ }
                const num = parseInt(resolved);
                if (num > 0) {
                  setMonthlyGoalsInputs(prev => prev.map(v => v === '' ? resolved : v));
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  let resolved = monthPages;
                  try {
                    const result = Math.round(Function('"use strict"; return (' + monthPages + ')')());
                    if (result > 0) { resolved = String(result); setMonthPages(resolved); }
                  } catch { /* mantém o valor atual se inválido */ }
                  const num = parseInt(resolved);
                  if (num > 0) {
                    // Preenche TODOS os meses (não só os vazios) e marca como manual
                    const allFilled = Array.from({ length: 12 }, () => resolved);
                    setMonthlyGoalsInputs(allFilled);
                    setManualMonths(new Set([0,1,2,3,4,5,6,7,8,9,10,11]));
                    saveMonthlyGoalsNow(resolved, allFilled);
                  }
                }
              }}
            />
            <select
              className="form-select"
              style={{ width: '90px', flexShrink: 0 }}
              value={monthlyGoalsYear}
              onChange={e => setMonthlyGoalsYear(parseInt(e.target.value))}
            >
              {Array.from({ length: CUR_Y - 2019 + 2 }, (_, i) => 2020 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className={styles.hint} style={{ marginBottom: '1rem' }}>
            {Math.round(parseInt(monthPages) / 30) || 0} págs/dia — aceita fórmula (ex: <code>30*15</code>)
          </div>
          <div className={styles.monthGoalGrid}>
            {MONTHS.map((name, i) => (
              <div key={i} className={styles.monthGoalItem}>
                <label className="label">{name}</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  placeholder={String(goals.monthPages)}
                  value={monthlyGoalsInputs[i]}
                  style={{ color: manualMonths.has(i) ? 'var(--text)' : 'var(--warm-gray)' }}
                  onChange={e => {
                    const val = e.target.value;
                    setMonthlyGoalsInputs(prev => {
                      const next = [...prev];
                      next[i] = val;
                      return next;
                    });
                    setManualMonths(prev => {
                      const s = new Set<number>(prev);
                      if (val === '') s.delete(i); else s.add(i);
                      return s;
                    });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Lê os inputs atuais direto do estado (onChange já rodou)
                      const curr = monthlyGoalsInputs.map((v, j) => j === i ? e.currentTarget.value : v);
                      saveMonthlyGoalsNow(monthPages, curr);
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <div className={styles.actions} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="submit" className="btn-primary" onMouseDown={e => e.preventDefault()}>Salvar metas mensais</button>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {/* Desfazer — reverte para o último "Salvar" explícito */}
              <button
                type="button"
                className={styles.trashBtn}
                onClick={handleUndoMonthlyGoals}
                title="Desfazer: volta ao último estado salvo"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 14 4 9l5-5"/>
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
                </svg>
              </button>
              {/* Limpar todas as metas do ano */}
              <button
                type="button"
                className={styles.trashBtn}
                onClick={handleClearMonthlyGoals}
                title={`Limpar todas as metas de ${monthlyGoalsYear}`}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── Quick history import ────────────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Adicionar leituras anteriores</h2>
        <p className={styles.desc}>
          Já leu antes de começar a usar o app? Informe o período e a quantidade de páginas.
          As páginas serão distribuídas uniformemente entre os dias do intervalo.
        </p>

        {/* Mode toggle */}
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${histMode === 'period' ? styles.modeBtnActive : ''}`}
            onClick={() => setHistMode('period')}
          >
            Por período
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${histMode === 'month' ? styles.modeBtnActive : ''}`}
            onClick={() => setHistMode('month')}
          >
            Por mês
          </button>
        </div>

        <form onSubmit={handleHistSubmit}>

          {histMode === 'period' ? (
            <>
              {/* Column headers */}
              <div className={styles.histHeader}>
                <span className="label" style={{ flex: '1 1 140px' }}>De</span>
                <span className="label" style={{ flex: '1 1 140px' }}>Até</span>
                <span className="label" style={{ flex: '0 0 110px' }}>Páginas lidas</span>
                <span style={{ width: '2rem', flexShrink: 0 }} />
              </div>

              {periods.map((en, i) => (
                <div key={i} className={styles.histRow}>
                  <input
                    className="form-input"
                    type="date"
                    value={en.start}
                    max={today()}
                    onChange={e => updatePeriod(i, 'start', e.target.value)}
                    style={{ flex: '1 1 140px' }}
                  />
                  <input
                    className="form-input"
                    type="date"
                    value={en.end}
                    max={today()}
                    min={en.start}
                    onChange={e => updatePeriod(i, 'end', e.target.value)}
                    style={{ flex: '1 1 140px' }}
                  />
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    placeholder="ex: 800"
                    value={en.pages}
                    onChange={e => updatePeriod(i, 'pages', e.target.value)}
                    style={{ flex: '0 0 110px' }}
                  />
                  <button
                    type="button"
                    className="btn-icon danger"
                    onClick={() => removePeriod(i)}
                    title="Remover"
                    disabled={periods.length === 1}
                  >×</button>
                </div>
              ))}

              <div className={styles.histFooter}>
                <button type="submit" className="btn-primary" onMouseDown={e => e.preventDefault()}>Adicionar</button>
              </div>
            </>
          ) : (
            <>
              {/* Column headers */}
              <div className={styles.histHeader}>
                <span className="label" style={{ flex: '1 1 140px' }}>Mês</span>
                <span className="label" style={{ flex: '0 0 90px' }}>Ano</span>
                <span className="label" style={{ flex: '0 0 110px' }}>Páginas lidas</span>
                <span style={{ width: '2rem', flexShrink: 0 }} />
              </div>

              {months.map((en, i) => (
                <div key={i} className={styles.histRow}>
                  <select
                    className="form-select"
                    value={en.month}
                    onChange={e => updateMonth(i, 'month', e.target.value)}
                    style={{ flex: '1 1 140px' }}
                  >
                    {MONTHS.map((name, idx) => (
                      <option key={idx + 1} value={String(idx + 1)}>{name}</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    type="number"
                    min="2000"
                    max={CUR_Y}
                    value={en.year}
                    onChange={e => updateMonth(i, 'year', e.target.value)}
                    style={{ flex: '0 0 90px' }}
                  />
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    placeholder="ex: 320"
                    value={en.pages}
                    onChange={e => updateMonth(i, 'pages', e.target.value)}
                    style={{ flex: '0 0 110px' }}
                  />
                  <button
                    type="button"
                    className="btn-icon danger"
                    onClick={() => removeMonth(i)}
                    title="Remover"
                    disabled={months.length === 1}
                  >×</button>
                </div>
              ))}

              <div className={styles.histFooter}>
                <button type="submit" className="btn-primary" onMouseDown={e => e.preventDefault()}>Adicionar</button>
              </div>
            </>
          )}
        </form>

        {/* ─── Viewer inline ───────────────────────────────────────── */}
        {(() => {
          const histLogs = logs.filter(l => l.bookId === '__historical__');
          if (histLogs.length === 0) return null;
          const totalPages = histLogs.reduce((s, l) => s + l.pages, 0);

          const byMonth = new Map<string, ReadingLog[]>();
          for (const log of histLogs) {
            const key = log.date.substring(0, 7);
            if (!byMonth.has(key)) byMonth.set(key, []);
            byMonth.get(key)!.push(log);
          }
          const sorted = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));

          function monthLabel(key: string) {
            const [y, m] = key.split('-');
            return `${MONTHS[parseInt(m) - 1]} ${y}`;
          }

          return (
            <>
              <hr className={styles.histDivider} />
              <div className={styles.histViewerHeader}>
                <span className={styles.histViewerLabel}>{totalPages.toLocaleString('pt-BR')} páginas importadas</span>
              </div>
              <div className={styles.histViewer}>
                {sorted.map(([key, monthLogs]) => {
                  const pages = monthLogs.reduce((s, l) => s + l.pages, 0);
                  return (
                    <div key={key} className={styles.histViewerRow}>
                      <span className={styles.histViewerMonth}>{monthLabel(key)}</span>
                      <span className={styles.histViewerPages}>{pages.toLocaleString('pt-BR')} págs.</span>
                      <button
                        className="btn-icon danger"
                        title="Remover mês"
                        onClick={() => {
                          deleteLogs(monthLogs.map(l => l.id));
                          showToast(`Histórico de ${monthLabel(key)} removido.`);
                        }}
                      >×</button>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>

      {/* ─── Import CSV ──────────────────────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Importar biblioteca</h2>
        <p className={styles.desc}>
          Adiciona livros a partir de um arquivo <code>.csv</code> exportado pelo Pagebypage.
          Livros com o mesmo título já existentes serão ignorados.
        </p>
        {csvPreview ? (
              <>
                <div className={styles.csvPreviewBox}>
                  <div className={styles.csvPreviewRow}>
                    <span className={styles.csvStat}>{csvPreview.found}</span>
                    <span className={styles.csvStatLabel}>livros encontrados no arquivo</span>
                  </div>
                  {csvPreview.skipped > 0 && (
                    <div className={styles.csvPreviewRow}>
                      <span className={`${styles.csvStat} ${styles.csvStatSkipped}`}>{csvPreview.skipped}</span>
                      <span className={styles.csvStatLabel}>já existem na biblioteca (serão ignorados)</span>
                    </div>
                  )}
                  <div className={styles.csvPreviewRow}>
                    <span className={`${styles.csvStat} ${styles.csvStatAdd}`}>{csvPreview.toAdd.length}</span>
                    <span className={styles.csvStatLabel}>serão adicionados</span>
                  </div>
                  {csvPreview.errors.length > 0 && (
                    <div className={styles.csvErrors}>
                      {csvPreview.errors.map((err, i) => <div key={i}>{err}</div>)}
                    </div>
                  )}
                </div>
                <div className={styles.confirmActions}>
                  <button
                    className="btn-secondary"
                    onClick={() => setCsvPreview(null)}
                    disabled={csvImporting}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleCsvImportConfirm}
                    disabled={csvImporting || (csvPreview.toAdd.length === 0 && csvPreview.histLogs.length === 0)}
                  >
                    {csvImporting
                      ? 'Importando...'
                      : (csvPreview.toAdd.length === 0 && csvPreview.histLogs.length === 0)
                        ? 'Nada a importar'
                        : `Importar`}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.actions}>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv"
                  className={styles.hiddenInput}
                  onChange={handleCsvFileChange}
                />
                <button
                  className="btn-secondary"
                  onClick={() => downloadTemplate()}
                  title="Baixa um CSV de exemplo com o formato esperado"
                >
                  ⬇ Baixar modelo
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => csvFileInputRef.current?.click()}
                >
                  📂 Selecionar arquivo .csv
                </button>
              </div>
            )}
      </div>

      {/* ─── Export ─────────────────────────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Exportar dados</h2>
        <p className={styles.desc}>
          Exporte a biblioteca em <code>.csv</code> para abrir no Excel ou Google Sheets,
          ou faça um backup completo em <code>.zip</code> com todos os registros de leitura.
        </p>
        <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
          <span
            className={styles.tooltipWrapper}
            data-tooltip="Lista de livros com informações e dados de leitura em .csv. Ideal para Excel ou Google Sheets."
          >
            <button className="btn-secondary" onClick={handleExport} disabled={exporting || books.length === 0}>
              {exporting ? 'Gerando...' : '⬇ Exportar .csv'}
            </button>
          </span>
          <span
            className={styles.tooltipWrapper}
            data-tooltip="Backup completo com livros e registros de leitura em .zip."
          >
            <button className="btn-primary" onClick={handleBackup} disabled={exporting || books.length === 0}>
              {exporting ? 'Gerando...' : '⬇ Backup completo (.zip)'}
            </button>
          </span>
        </div>
      </div>

      {/* ─── Dados de Teste ─────────────────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Dados de teste</h2>
        <p className={styles.desc}>
          Popula o app com 4 livros em leitura, 2 concluídos e histórico de atividade —
          útil para testar o visual sem precisar cadastrar dados reais.
          Os dados atuais serão substituídos.
        </p>
        {!showTestConfirm ? (
          <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowTestConfirm(true)}>
              Carregar dados de teste
            </button>
          </div>
        ) : (
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>
              Isso vai substituir os dados atuais ({books.length} livros, {logs.filter(l => l.bookId !== '__historical__').length} registros). Continuar?
            </p>
            <div className={styles.confirmActions}>
              <button className="btn-secondary" onClick={() => setShowTestConfirm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={loadTestData}>Sim, carregar</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Danger Zone ────────────────────────────────────────────── */}
      <div className={`card ${styles.section} ${styles.dangerSection}`}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Zona de perigo</h2>
        <p className={styles.desc}>
          Esta ação irá apagar <strong>todos</strong> os seus livros, registros e metas. Não há como desfazer.
        </p>
        {!showResetConfirm ? (
          <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
            <button className="btn-danger" onClick={() => setShowResetConfirm(true)}>
              Resetar todos os dados
            </button>
          </div>
        ) : (
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>Tem certeza? Esta ação é irreversível.</p>
            <div className={styles.confirmActions}>
              <button className="btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancelar</button>
              <button className="btn-danger" onClick={handleReset}>Sim, apagar tudo</button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
