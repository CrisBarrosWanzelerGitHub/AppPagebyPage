import { useState, useEffect, useMemo } from 'react';
import type { AppState, Book, ReadingLog, LibraryPlace } from '../types';
import {
  getPagesInYear,
  getPagesInMonth,
  getAvgPagesPerDayYear,
  getAvgPagesPerDayMonth,
  getProjectedYearPages,
  getProjectedMonthPages,
  getDailyTargetYear,
  getMonthGoal,
} from '../utils/metrics';
import { remainingDaysInYear, remainingDaysInMonth, today } from '../utils/dates';
import EditBookModal from './EditBookModal';
import DeleteBookModal from './DeleteBookModal';
import QuotesModal from './QuotesModal';
import { BookCard } from './Library';
import styles from './Dashboard.module.css';

interface Props {
  state: AppState;
  addLog: (log: ReadingLog) => void;
  updateBook: (book: Book) => void;
  deleteBook: (id: string) => void;
  startReread: (bookId: string) => void;
  abandonReread: (bookId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'delete', options?: { undo?: () => void; onExpire?: () => void; countdown?: number; onConfirm?: () => void; confirmLabel?: string }) => void;
  onNavigateToLog?: (bookId?: string) => void;
  onNavigateToLibraries?: () => void;
  onNavigateToPerformance?: () => void;
  [key: string]: unknown;
}

function ClearFilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z"/>
      <line x1="17" y1="7" x2="22" y2="2"/>
      <line x1="22" y1="7" x2="17" y2="2"/>
    </svg>
  );
}

export default function Dashboard({ state, addLog, updateBook, deleteBook, startReread, abandonReread, showToast, onNavigateToLog, onNavigateToLibraries, onNavigateToPerformance }: Props) {
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [quotesBook, setQuotesBook] = useState<Book | null>(null);
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { goals, books, logs } = state;

  // ─── Year selector ────────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    logs.forEach(l => years.add(parseInt(l.date.split('-')[0])));
    return [...years].sort((a, b) => a - b);
  }, [logs, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => {
    if (logs.length === 0) return currentYear;
    return Math.max(...logs.map(l => parseInt(l.date.split('-')[0])));
  });

  // Keep selectedYear valid when logs change
  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedYear(availableYears[availableYears.length - 1] ?? currentYear);
    }
  }, [availableYears, selectedYear, currentYear]);

  const year  = selectedYear;
  const month = year === currentYear ? currentMonth : 12;

  const yearPages   = getPagesInYear(logs, year);
  const monthPages  = getPagesInMonth(logs, year, month);
  const avgYear     = getAvgPagesPerDayYear(logs, year);
  const avgMonth    = getAvgPagesPerDayMonth(logs, year, month);
  const projYear    = getProjectedYearPages(logs, year);
  const projMonth   = getProjectedMonthPages(logs, year, month);
  const currentMonthGoal = getMonthGoal(goals, year, month);
  const targetYear  = getDailyTargetYear(logs, goals, year);
  // Use currentMonthGoal (respects per-month overrides) instead of goals.monthPages
  const targetMonth = useMemo(() => {
    const remaining = currentMonthGoal - monthPages;
    if (remaining <= 0 || currentMonthGoal === 0) return 0;
    const days = remainingDaysInMonth(year, month);
    return days === 0 ? 0 : Math.ceil(remaining / days);
  }, [currentMonthGoal, monthPages, year, month]);
  const monthPct = currentMonthGoal    > 0 ? Math.min(100, Math.round((monthPages / currentMonthGoal)    * 100)) : 0;

  const daysLeftYear  = remainingDaysInYear(year);
  const daysLeftMonth = remainingDaysInMonth(year, month);
  const projYearPct  = goals.yearPages  > 0 ? Math.round((projYear  / goals.yearPages)  * 100) : 0;
  const projMonthPct = goals.monthPages > 0 ? Math.round((projMonth / goals.monthPages) * 100) : 0;

  // ── Date when each goal was actually hit (scans logs in order) ────────────
  const yearCompletionDate = useMemo(() => {
    if (goals.yearPages === 0) return null;
    const sorted = [...logs].filter(l => l.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    for (const l of sorted) { cum += l.pages; if (cum >= goals.yearPages) return l.date; }
    return null;
  }, [logs, year, goals.yearPages]);

  const monthPad = String(month).padStart(2, '0');
  const monthCompletionDate = useMemo(() => {
    if (currentMonthGoal === 0) return null;
    const sorted = [...logs].filter(l => l.date.startsWith(`${year}-${monthPad}`)).sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    for (const l of sorted) { cum += l.pages; if (cum >= currentMonthGoal) return l.date; }
    return null;
  }, [logs, year, monthPad, currentMonthGoal]);
  // ─────────────────────────────────────────────────────────────────────────

  // Ordena por data + posição do último log (mais recente primeiro; desempate pelo índice no array)
  const readingBooks = useMemo(() => {
    const all = books.filter(b => b.status === 'reading' || b.status === 'rereading');
    const lastLog = new Map<string, { date: string; idx: number }>();
    logs.forEach((log, idx) => {
      const cur = lastLog.get(log.bookId);
      if (!cur || log.date > cur.date || (log.date === cur.date && idx > cur.idx)) {
        lastLog.set(log.bookId, { date: log.date, idx });
      }
    });
    return [...all].sort((a, b) => {
      const la = lastLog.get(a.id);
      const lb = lastLog.get(b.id);
      if (!la && !lb) return 0;
      if (!la) return 1;
      if (!lb) return -1;
      if (lb.date !== la.date) return lb.date.localeCompare(la.date);
      return lb.idx - la.idx; // mesma data → quem foi registrado por último sobe
    });
  }, [books, logs]);
  const wantBooks    = books.filter(b => b.status === 'want');
  const doneBooks    = books.filter(b => b.status === 'done');

  const [filterTag, setFilterTag] = useState<string | null>(null);
  const readingTags = Array.from(new Set(readingBooks.flatMap(b => b.tags))).sort();
  const filteredReadingBooks = filterTag
    ? readingBooks.filter(b => b.tags.includes(filterTag))
    : readingBooks;

  function handleLog(log: ReadingLog) {
    addLog(log);
    const book = books.find(b => b.id === log.bookId);
    if (book && log.currentPage !== undefined) {
      const newStatus: Book['status'] =
        log.currentPage >= book.pages && book.pages > 0
          ? 'done'
          : log.currentPage > 0
          ? 'reading'
          : book.status;
      updateBook({
        ...book,
        currentPage: log.currentPage,
        status: newStatus,
        endDate: newStatus === 'done' && !book.endDate ? log.date : book.endDate,
        startDate: book.startDate || log.date,
      });
      if (newStatus === 'done') showToast('Parabéns! Livro concluído!');
      else showToast('Leitura registrada!');
    } else {
      showToast('Leitura registrada!');
    }
  }

  function handleStatusChange(book: Book, status: Book['status']) {
    const snapshot = { ...book };
    const updated: Book = { ...book, status };
    if (status === 'want') {
      updated.currentPage = 0;
      updated.startDate   = undefined;
      updated.endDate     = undefined;
    }
    if (status === 'reading' && !book.startDate) {
      updated.startDate = new Date().toISOString().split('T')[0];
    }
    if (status === 'done') {
      const todayStr = today();
      if (!book.endDate) updated.endDate = todayStr;
      if (book.pages > 0) {
        const remaining = book.pages - book.currentPage;
        updated.currentPage = book.pages;
        if (remaining > 0) {
          addLog({
            id: crypto.randomUUID(),
            bookId: book.id,
            bookTitle: book.title,
            date: todayStr,
            pages: book.pages,
            currentPage: book.pages,
          });
        }
      }
    }
    if (status === 'rereading') {
      updated.currentPage = 0;
      updated.startPage   = undefined;
      updated.startDate   = undefined;
      updated.endDate     = undefined;
    }
    updateBook(updated);
    showToast('Status atualizado.', 'success', { undo: () => updateBook(snapshot) });
  }

  function handleStartReread(book: Book) {
    const snapshot = { ...book };
    startReread(book.id);
    showToast('Releitura iniciada!', 'success', { undo: () => updateBook(snapshot) });
  }

  function handleAbandonReread(book: Book) {
    const snapshot = { ...book };
    abandonReread(book.id);
    showToast('Releitura cancelada.', 'success', { undo: () => updateBook(snapshot) });
  }

  function handleDelete(book: Book) {
    setDeleteTarget(book);
  }

  return (
    <div className={styles.root}>
      {/* ─── Year Progress Track ─────────────────────────────────────────── */}
      <YearProgressTrack
        goalPages={goals.yearPages}
        actualPages={yearPages}
        daysLeft={daysLeftYear}
        year={year}
        currentYear={currentYear}
        projPages={projYear}
        projPct={projYearPct}
        avgYear={avgYear}
        requiredAvgYear={targetYear}
        yearCompletionDate={yearCompletionDate}
        monthActual={monthPages}
        monthGoal={currentMonthGoal}
        monthPct={monthPct}
        daysLeftMonth={daysLeftMonth}
        projMonth={projMonth}
        projMonthPct={projMonthPct}
        avgMonth={avgMonth}
        requiredAvgMonth={targetMonth}
        monthCompletionDate={monthCompletionDate}
      />

      {/* ─── Currently Reading ──────────────────────────────────────────── */}
      {readingBooks.length > 0 && (
        <div className={styles.section}>
          <p className="section-title">Lendo agora</p>
          {readingTags.length > 0 && (
            <div className={styles.readingTagChips}>
              <button
                className={`${styles.readingTagChip} ${filterTag === null ? styles.readingTagChipActive : ''}`}
                onClick={() => setFilterTag(null)}
                title="Todas as tags"
              >
                <ClearFilterIcon />
              </button>
              {readingTags.map(tag => (
                <button
                  key={tag}
                  className={`${styles.readingTagChip} ${filterTag === tag ? styles.readingTagChipActive : ''}`}
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className={styles.readingList}>
            {filteredReadingBooks.map(book => (
              <BookCard
                key={book.id}
                book={book}
                logs={logs}
                onLog={handleLog}
                onStatusChange={handleStatusChange}
                onStartReread={handleStartReread}
                onAbandonReread={handleAbandonReread}
                onDelete={() => handleDelete(book)}
                onNavigateToLog={onNavigateToLog}
                onEdit={() => setEditingBook(book)}
                onOpenQuotes={() => setQuotesBook(book)}
              />
            ))}
          </div>
        </div>
      )}

      {readingBooks.length === 0 && (
        books.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">▤</div>
            <p>Adicione livros na Biblioteca para começar a acompanhar sua leitura.</p>
          </div>
        ) : (
          <div className={styles.wantSection}>
            {(wantBooks.length > 0 || doneBooks.length > 0) && (
              <p className={styles.wantTitle}>
                {wantBooks.length > 0 ? 'Que tal começar?' : 'Que tal reler um favorito?'}
              </p>
            )}

            {wantBooks.length > 0 ? (
              <div className={styles.wantList}>
                {wantBooks.map(book => (
                  <button
                    key={book.id}
                    className={styles.wantChip}
                    onClick={() => onNavigateToLog && onNavigateToLog(book.id)}
                  >
                    {book.title}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {doneBooks.length > 0 && (
                  <div className={styles.wantList}>
                    {doneBooks.slice(0, 8).map(book => (
                      <button
                        key={book.id}
                        className={styles.wantChip}
                        onClick={() => handleStartReread(book)}
                      >
                        {book.title}
                      </button>
                    ))}
                  </div>
                )}
                <a
                  href="https://meclivros.mec.gov.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mecLink}
                  title="Encontre livros gratuitos no MEC"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span>Livros gratuitos · MEC</span>
                </a>
              </>
            )}
          </div>
        )
      )}
      {/* ─── Bibliotecas prediletas ─────────────────────────────────────── */}
      <LibrariesSection libraries={state.libraries ?? []} onNavigate={onNavigateToLibraries} />

      {/* ─── Convite para Performance ────────────────────────────────── */}
      {onNavigateToPerformance && (
        <div className={styles.perfInvite}>
          <p className={styles.perfInviteText}>
            Cada página que você lê vira parte de uma <em>história</em> única — a sua.
          </p>
          <button className={styles.perfInviteLink} onClick={onNavigateToPerformance}>
            Ver meu desempenho →
          </button>
        </div>
      )}

      {/* ─── Divisor ─────────────────────────────────────────────────── */}
      <div className={styles.sectionDivider} />

      {/* ─── Suporte ─────────────────────────────────────────────────── */}
      <div className={styles.supportSection}>
        <p className={styles.supportHint}>Tem uma ideia, um elogio ou algo que poderia melhorar?<br />Adoro receber mensagens — de verdade.</p>
        <a href="mailto:pagebypageapp@gmail.com" className={styles.supportLink}>
          ✉ Falar com a equipe, Page by Page.
        </a>
      </div>

      {editingBook && (
        <EditBookModal
          book={editingBook}
          existingTags={Array.from(new Set(books.flatMap(b => b.tags))).sort()}
          existingGenres={Array.from(new Set(books.map(b => b.genre).filter(Boolean))).sort()}
          onClose={() => setEditingBook(null)}
          onSave={(b) => { updateBook(b); setEditingBook(null); showToast('Livro atualizado!'); }}
        />
      )}
      {deleteTarget && (
        <DeleteBookModal
          book={deleteTarget}
          logs={state.logs}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteBook(deleteTarget.id);
            setDeleteTarget(null);
            showToast('Livro excluído.');
          }}
        />
      )}
      {quotesBook && (
        <QuotesModal
          book={quotesBook}
          onClose={() => setQuotesBook(null)}
          onSave={(quotes) => {
            updateBook({ ...quotesBook, quotes, quote: undefined });
            setQuotesBook(null);
            showToast('Trechos salvos!');
          }}
        />
      )}
    </div>
  );
}


// ─── Libraries Section ───────────────────────────────────────────────────────
function LibrariesSection({ libraries, onNavigate }: { libraries: LibraryPlace[]; onNavigate?: () => void }) {
  const sorted = [...libraries].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  return (
    <div
      className={`card ${styles.libSection} ${onNavigate ? styles.libSectionClickable : ''}`}
      onClick={onNavigate}
      role={onNavigate ? 'button' : undefined}
      tabIndex={onNavigate ? 0 : undefined}
      onKeyDown={onNavigate ? (e => (e.key === 'Enter' || e.key === ' ') && onNavigate()) : undefined}
    >
      <div className={styles.libHeader}>
        <span className={styles.libTitle}>Bibliotecas prediletas</span>
        <span className={styles.libManageHint}>
          {libraries.length === 0 ? 'Adicionar ›' : 'Gerenciar ›'}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className={styles.libEmpty}>
          Salve suas bibliotecas e plataformas aqui para encontrá-las rapidamente.
        </p>
      ) : (
        <div className={styles.libList}>
          {sorted.map(lib => (
            <div key={lib.id} className={styles.libItem}>
              {lib.url ? (
                <a
                  href={lib.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.libLink}
                  onClick={e => e.stopPropagation()}
                >
                  <span className={styles.libDot} aria-hidden="true">◫</span>
                  <span>{lib.name}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.6 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              ) : (
                <span className={styles.libItemPlain}>
                  <span className={styles.libDot} aria-hidden="true">◫</span>
                  <span>{lib.name}</span>
                </span>
              )}
              {lib.address && (
                <span className={styles.libAddress}>📍 {lib.address}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Year Progress Track ─────────────────────────────────────────────────────
function YearProgressTrack({
  goalPages, actualPages, daysLeft, year, currentYear, projPages, projPct,
  avgYear, requiredAvgYear, yearCompletionDate,
  monthActual, monthGoal, monthPct, daysLeftMonth, projMonth, projMonthPct,
  avgMonth, requiredAvgMonth, monthCompletionDate,
}: {
  goalPages: number; actualPages: number; daysLeft: number;
  year: number; currentYear: number; projPages: number; projPct: number;
  avgYear: number; requiredAvgYear: number; yearCompletionDate: string | null;
  monthActual: number; monthGoal: number; monthPct: number;
  daysLeftMonth: number; projMonth: number; projMonthPct: number;
  avgMonth: number; requiredAvgMonth: number; monthCompletionDate: string | null;
}) {
  const [showGrayTip,   setShowGrayTip]   = useState(false);
  const [showOrangeTip, setShowOrangeTip] = useState(false);
  const [expanded,      setExpanded]      = useState(false);

  if (goalPages === 0) return null;

  const isLeap    = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const totalDays = isLeap ? 366 : 365;
  const daysPast  = year === currentYear ? totalDays - daysLeft : totalDays;

  const expectedByNow = Math.round(goalPages * daysPast / totalDays);
  const onTrack       = actualPages >= expectedByNow;

  const grayPct   = Math.min(100, Math.round(daysPast / totalDays * 100));
  const orangePct = Math.min(100, Math.round(actualPages / goalPages * 100));
  const yearPct   = Math.round(actualPages / goalPages * 100);

  const pinColor = onTrack ? 'var(--accent-surface)' : 'var(--danger)';
  const pctColor = onTrack ? 'var(--accent-text)'    : 'var(--danger)';

  return (
    // Task 5 — click anywhere to toggle
    <div
      className={`card ${styles.trackCard}`}
      onClick={() => setExpanded(e => !e)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(v => !v)}
    >
      {/* ── Year label + chevron — right aligned ── */}
      <div className={styles.trackTopRow}>
        <span className={styles.trackYearBadge}>{year}</span>
        <span className={styles.trackChevron} aria-hidden="true">{expanded ? '▴' : '▾'}</span>
      </div>

      {/* ── Track visual ── */}
      <div className={styles.trackWrap}>
        <div className={styles.trackLine} />

        {/* Gray pin — expected position today */}
        <button
          className={styles.trackPin}
          style={{ left: `clamp(1%, ${grayPct}%, 99%)` }}
          onMouseEnter={() => setShowGrayTip(true)}
          onMouseLeave={() => setShowGrayTip(false)}
          onClick={e => e.stopPropagation()}
          aria-label={`Esperado até hoje: ${expectedByNow.toLocaleString('pt-BR')} páginas`}
        >
          <PinSvg color="var(--text-muted)" />
          <span className={styles.trackPinPct} style={{ color: 'var(--text-muted)' }}>
            {grayPct}%
          </span>
          {showGrayTip && (
            <span className={styles.trackTooltip}>
              {expectedByNow.toLocaleString('pt-BR')} págs esperadas
            </span>
          )}
        </button>

        {/* Orange / Red pin — actual pages (task 2: hover tooltip) */}
        <button
          className={styles.trackPin}
          style={{ left: `clamp(1%, ${orangePct}%, 99%)` }}
          onMouseEnter={() => setShowOrangeTip(true)}
          onMouseLeave={() => setShowOrangeTip(false)}
          onClick={e => e.stopPropagation()}
          aria-label={`${yearPct}% da meta: ${actualPages.toLocaleString('pt-BR')} páginas lidas`}
        >
          <PinSvg color={pinColor} />
          <span className={styles.trackPinPct} style={{ color: pctColor }}>
            {yearPct}%
          </span>
          {showOrangeTip && (
            <span className={styles.trackTooltip}>
              {actualPages.toLocaleString('pt-BR')} págs lidas
            </span>
          )}
        </button>
      </div>

      {/* ── Labels ── */}
      <div className={styles.trackLabels}>
        <span>Meta: {goalPages.toLocaleString('pt-BR')} páginas</span>
        <span className={styles.trackLabelsCenter}>
          Estimativa: {projPages.toLocaleString('pt-BR')} · {projPct}% da meta
        </span>
      </div>

      {/* ── Expanded: year + month detail ── */}
      {expanded && (
        <div className={styles.trackExpanded}>
          <GoalBlock
            title={`Meta anual ${year}`}
            current={actualPages}
            goal={goalPages}
            pct={yearPct}
            daysLeft={daysLeft}
            projPages={projPages}
            projPct={projPct}
            avgPerDay={avgYear}
            requiredAvg={requiredAvgYear}
            completedOn={yearCompletionDate}
          />
          <div className={styles.trackDivider} />
          <GoalBlock
            title="Meta mensal"
            current={monthActual}
            goal={monthGoal}
            pct={monthPct}
            daysLeft={daysLeftMonth}
            projPages={projMonth}
            projPct={projMonthPct}
            avgPerDay={avgMonth}
            requiredAvg={requiredAvgMonth}
            completedOn={monthCompletionDate}
          />
        </div>
      )}
    </div>
  );
}

function GoalBlock({ title, current, goal, pct, daysLeft, projPages, projPct, avgPerDay, requiredAvg, completedOn }: {
  title: string; current: number; goal: number; pct: number;
  daysLeft: number; projPages: number; projPct: number; avgPerDay: number;
  requiredAvg: number; completedOn: string | null;
}) {
  const goalHit     = pct >= 100;
  const projOnTrack = projPct >= 100;
  const pagesLeft   = Math.max(0, goal - current);

  // dd/MM/yy from a YYYY-MM-DD string
  const fmtStr = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };

  // dd/MM/yy from a Date object
  const fmtDate = (dt: Date) => {
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear()).slice(2);
    return `${dd}/${mm}/${yy}`;
  };

  // Estimated completion date
  let estLabel: string | null = null;
  let estOnTime               = true;

  if (!goalHit && pagesLeft > 0) {
    if (avgPerDay > 0) {
      const today      = new Date();
      const deadline   = new Date();
      deadline.setDate(today.getDate() + daysLeft);
      const est        = new Date();
      est.setDate(today.getDate() + Math.ceil(pagesLeft / avgPerDay));
      estOnTime = est <= deadline;
      estLabel  = fmtDate(est);
    } else {
      estLabel  = 'sem leituras registradas';
      estOnTime = false;
    }
  }

  return (
    <div className={styles.goalBlock}>
      <span className={styles.goalBlockTitle}>{title}</span>

      <div className="progress-bar" style={{ height: '5px', marginTop: '0.25rem' }}>
        <div
          className="progress-bar-fill"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: goalHit ? 'var(--accent-surface)' : undefined,
          }}
        />
      </div>

      <div className={styles.goalBlockRow}>
        <span className={styles.goalBlockVal}>
          {current.toLocaleString('pt-BR')}
          <span className={styles.goalBlockOf}> / {goal.toLocaleString('pt-BR')} págs</span>
        </span>
        <span
          className={styles.goalBlockPct}
          style={{ color: goalHit ? 'var(--accent-text)' : 'var(--text-primary)' }}
        >
          {pct}%
        </span>
      </div>

      <div className={styles.goalBlockMeta}>
        <span>{goalHit ? 'Meta atingida' : `${pagesLeft.toLocaleString('pt-BR')} págs restantes`}</span>
        <span>{daysLeft} dias restantes</span>
      </div>

      {/* Completion / estimated date */}
      {goalHit && completedOn ? (
        <div className={styles.goalBlockEst} style={{ color: 'var(--accent-text)' }}>
          ✓ Concluída em <strong>{fmtStr(completedOn)}</strong>
        </div>
      ) : goalHit ? (
        <div className={styles.goalBlockEst} style={{ color: 'var(--accent-text)' }}>
          ✓ Meta concluída
        </div>
      ) : estLabel ? (
        <div
          className={styles.goalBlockEst}
          style={{ color: estOnTime ? 'var(--text-secondary)' : 'var(--danger)' }}
        >
          Conclusão: <strong>{estLabel}</strong>
          {!estOnTime && ' · fora do prazo'}
        </div>
      ) : null}

      {/* Avg reading vs required (task 4) */}
      {!goalHit && (
        <div className={styles.goalBlockAvgRow}>
          <span
            className={styles.goalBlockDot}
            style={{
              background: requiredAvg > 0 && avgPerDay >= requiredAvg
                ? '#22c55e'
                : requiredAvg > 0
                ? '#ef4444'
                : 'var(--text-disabled)',
            }}
          />
          <span>{avgPerDay.toFixed(1)} págs/dia</span>
          {requiredAvg > 0 && (
            <span className={styles.goalBlockAvgReq}> · necessário: {requiredAvg} págs/dia</span>
          )}
        </div>
      )}

      <div
        className={styles.goalBlockProj}
        style={{ color: projOnTrack ? 'var(--accent-text)' : 'var(--text-muted)' }}
      >
        Projeção: {projPages.toLocaleString('pt-BR')} págs · {projPct}%
      </div>
    </div>
  );
}

function PinSvg({ color }: { color: string }) {
  return (
    <svg width="22" height="30" viewBox="0 0 22 30" fill="none" aria-hidden="true">
      <path
        d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 19 11 19S22 19.25 22 11C22 4.925 17.075 0 11 0z"
        fill={color}
      />
      <circle cx="11" cy="10.5" r="3.8" fill="white" fillOpacity="0.75" />
    </svg>
  );
}

