import { useState, useEffect, useMemo, Fragment } from 'react';
import type { AppState, Book, ReadingLog } from '../types';
import { getBookPercent } from '../utils/metrics';
import { today, toDisplayDate } from '../utils/dates';
import AddBookModal from './AddBookModal';
import EditBookModal from './EditBookModal';
import DeleteBookModal from './DeleteBookModal';
import QuotesModal from './QuotesModal';
import styles from './Library.module.css';

type FilterStatus = 'all' | 'reading' | 'rereading' | 'done' | 'want' | 'abandoned';

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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

const STATUS_LABELS: Record<Book['status'], string> = {
  want: 'Quero ler',
  reading: 'Lendo',
  rereading: 'Reler',   // label do filtro; ribbon usa 'Lendo' igual à leitura normal
  done: 'Lido',
  abandoned: 'Abandonado',
};

interface Props {
  state: AppState;
  addBook: (book: Book) => void;
  updateBook: (book: Book) => void;
  deleteBook: (id: string) => void;
  addLog: (log: ReadingLog) => void;
  startReread: (bookId: string) => void;
  abandonReread: (bookId: string) => void;
  setWantOrder: (order: string[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'delete', options?: { undo?: () => void; onExpire?: () => void; countdown?: number }) => void;
  onNavigateToLog?: (bookId?: string) => void;
  initialStatus?: FilterStatus;
  [key: string]: unknown;
}

export default function Library({
  state,
  addBook,
  updateBook,
  deleteBook,
  addLog,
  startReread,
  abandonReread,
  setWantOrder,
  showToast,
  onNavigateToLog,
  initialStatus,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(initialStatus ?? 'all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterStore, setFilterStore] = useState<string | null>(null);
  const [filterGenre, setFilterGenre] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePanel, setActivePanel] = useState<'status' | 'genre' | 'tag' | 'store' | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [quotesBook, setQuotesBook] = useState<Book | null>(null);

  // ── Task 3: drag-and-drop state (Quero Ler) ──
  const [dragId, setDragId]       = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Task 4: period filter for Lidos ──
  const [doneFrom, setDoneFrom] = useState('');
  const [doneTo,   setDoneTo]   = useState('');

  const { books } = state;
  const wantOrder = state.wantOrder ?? [];

  const q = searchQuery.trim().toLowerCase();

  // Livros que passam pelo filtro de status + busca textual
  // (base para derivar quais tags/locais fazem sentido mostrar)
  const booksForFilters = books.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)
      && !(b.store ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  // Tags, locais e gêneros disponíveis no subconjunto atual
  const allTags = Array.from(
    new Set(booksForFilters.flatMap(b => b.tags))
  ).sort();

  const allStores = Array.from(
    new Set(booksForFilters.map(b => b.store).filter((s): s is string => !!s))
  ).sort();

  const allGenres = Array.from(
    new Set(booksForFilters.map(b => b.genre).filter(Boolean))
  ).sort();

  // Limpa filtros que deixaram de existir no subconjunto
  useEffect(() => {
    if (filterTag && !allTags.includes(filterTag)) setFilterTag(null);
  }, [allTags, filterTag]);

  useEffect(() => {
    if (filterStore && !allStores.includes(filterStore)) setFilterStore(null);
  }, [allStores, filterStore]);

  useEffect(() => {
    if (filterGenre && !allGenres.includes(filterGenre)) setFilterGenre(null);
  }, [allGenres, filterGenre]);

  const filtered = booksForFilters.filter(b => {
    if (filterTag && !b.tags.includes(filterTag)) return false;
    if (filterStore && b.store !== filterStore) return false;
    if (filterGenre && b.genre !== filterGenre) return false;
    return true;
  });

  // Último livro adicionado à biblioteca (independente de filtros)
  const lastAddedId = useMemo(
    () => state.books.length > 0 ? state.books[state.books.length - 1].id : null,
    [state.books],
  );

  // Task 4: anos disponíveis nos livros Lidos (baseado em endDate)
  const doneYears = useMemo(() => {
    const years = new Set<number>();
    books.forEach(b => {
      if (b.status === 'done' && b.endDate) {
        const y = parseInt(b.endDate.split('-')[0]);
        if (!isNaN(y)) years.add(y);
      }
    });
    return [...years].sort((a, b) => b - a); // decrescente
  }, [books]);

  // Task 4: filtro por período (from/to) no subconjunto "done"
  // Se a data final não for selecionada, usa hoje como limite
  const filteredWithYear = useMemo(() => {
    if (filterStatus !== 'done' || (!doneFrom && !doneTo)) return filtered;
    const effectiveTo = doneTo || today();
    return filtered.filter(b => {
      if (!b.endDate) return false;
      if (doneFrom && b.endDate < doneFrom) return false;
      if (b.endDate > effectiveTo) return false;
      return true;
    });
  }, [filtered, filterStatus, doneFrom, doneTo]);

  // Ordenação: manual para Quero Ler (sem outros filtros ativos), alfabética nos demais
  const isWantReorderMode = filterStatus === 'want' && !filterTag && !filterGenre && !filterStore && !q;

  const sortedFiltered = useMemo(() => {
    const source = filterStatus === 'done' ? filteredWithYear : filtered;
    if (isWantReorderMode) {
      // Ordem manual persistida em wantOrder
      const orderMap = new Map(wantOrder.map((id, i) => [id, i]));
      return [...source].sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 99999;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 99999;
        if (ai !== bi) return ai - bi;
        return a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
      });
    }
    return [...source].sort((a, b) => {
      if (a.id === lastAddedId) return -1;
      if (b.id === lastAddedId) return 1;
      return a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
    });
  }, [filtered, filteredWithYear, filterStatus, isWantReorderMode, wantOrder, lastAddedId]);

  function handleDelete(book: Book) {
    setDeleteTarget(book);
  }

  // ── Task 3: drag-and-drop handlers for Quero Ler ──
  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    // Ghost invisível — evita o browser renderizar o verso 3D de cabeça pra baixo
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:absolute;top:-1000px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => ghost.remove());
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const ids = sortedFiltered.map(b => b.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx   = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragId);
    setWantOrder(next);
    setDragId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }

  function handleStatusChange(book: Book, status: Book['status']) {
    const snapshot = { ...book }; // guarda estado anterior para undo
    const updated  = { ...book, status };

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

    // 'rereading' via select: zera o progresso mas NÃO arquiva sessão (não conta como releitura)
    if (status === 'rereading') {
      updated.currentPage = 0;
      updated.startPage   = undefined;
      updated.startDate   = undefined;
      updated.endDate     = undefined;
    }

    // 'abandoned': mantém currentPage, startDate e endDate como estão

    updateBook(updated);
    showToast('Status atualizado.', 'success', { undo: () => updateBook(snapshot) });
  }

  function handleLog(log: ReadingLog) {
    addLog(log);
    const book = books.find(b => b.id === log.bookId);
    if (book && log.currentPage !== undefined) {
      const newStatus: Book['status'] =
        log.currentPage >= book.pages && book.pages > 0
          ? 'done'
          : log.currentPage > 0
          ? 'reading'   // 'rereading' vira 'reading' assim que o primeiro log é registrado
          : book.status;
      const updated: Book = {
        ...book,
        currentPage: log.currentPage,
        status: newStatus,
        endDate: newStatus === 'done' && !book.endDate ? log.date : book.endDate,
        startDate: book.startDate || log.date,
      };
      updateBook(updated);
      if (newStatus === 'done') showToast('Parabéns! Livro concluído!');
      else showToast('Leitura registrada!');
    } else {
      showToast('Leitura registrada!');
    }
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

  return (
    <div className={styles.root}>
      {/* ─── Search ───────────────────────────────────────────────────── */}
      <div className={styles.searchBox}>
        <span className={styles.searchIcon} aria-hidden="true">⌕</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar por título ou autor..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Limpar busca">×</button>
        )}
      </div>

      {/* ─── Filter Pills ─────────────────────────────────────────────── */}
      <div className={styles.filterPills}>
        <button
          className={`${styles.filterPill} ${activePanel === 'status' ? styles.filterPillOpen : ''} ${filterStatus !== 'all' ? styles.filterPillActive : ''}`}
          onClick={() => setActivePanel(p => p === 'status' ? null : 'status')}
        >
          <span>Status</span>
          {filterStatus !== 'all' && (
            <span className={styles.pillValue}>{STATUS_LABELS[filterStatus as Book['status']]}</span>
          )}
          <ChevronIcon open={activePanel === 'status'} />
        </button>

        {allGenres.length > 0 && (
          <button
            className={`${styles.filterPill} ${activePanel === 'genre' ? styles.filterPillOpen : ''} ${filterGenre ? styles.filterPillActive : ''}`}
            onClick={() => setActivePanel(p => p === 'genre' ? null : 'genre')}
          >
            <span>Gênero</span>
            {filterGenre && <span className={styles.pillValue}>{filterGenre}</span>}
            <ChevronIcon open={activePanel === 'genre'} />
          </button>
        )}

        {allTags.length > 0 && (
          <button
            className={`${styles.filterPill} ${activePanel === 'tag' ? styles.filterPillOpen : ''} ${filterTag ? styles.filterPillActive : ''}`}
            onClick={() => setActivePanel(p => p === 'tag' ? null : 'tag')}
          >
            <span>Tag</span>
            {filterTag && <span className={styles.pillValue}>{filterTag}</span>}
            <ChevronIcon open={activePanel === 'tag'} />
          </button>
        )}

        {allStores.length > 0 && (
          <button
            className={`${styles.filterPill} ${activePanel === 'store' ? styles.filterPillOpen : ''} ${filterStore ? styles.filterPillActive : ''}`}
            onClick={() => setActivePanel(p => p === 'store' ? null : 'store')}
          >
            <span>Local</span>
            {filterStore && <span className={styles.pillValue}>{filterStore}</span>}
            <ChevronIcon open={activePanel === 'store'} />
          </button>
        )}

        {(filterStatus !== 'all' || filterGenre || filterTag || filterStore) && (
          <button
            className={styles.clearAllBtn}
            onClick={() => { setFilterStatus('all'); setFilterGenre(null); setFilterTag(null); setFilterStore(null); setActivePanel(null); }}
            title="Limpar todos os filtros"
          >
            <ClearFilterIcon />
          </button>
        )}
      </div>

      {/* ─── Filter Panel ─────────────────────────────────────────────── */}
      {activePanel === 'status' && (
        <div className={styles.filterPanel}>
          <button
            className={`${styles.tagChip} ${styles.clearFilterBtn} ${filterStatus === 'all' ? styles.tagChipActive : ''}`}
            onClick={() => setFilterStatus('all')}
            title="Todos os status"
          >
            <ClearFilterIcon />
          </button>
          {(['reading', 'rereading', 'done', 'want', 'abandoned'] as FilterStatus[]).map(s => (
            <button
              key={s}
              className={`${styles.filterBtn} ${filterStatus === s ? styles.filterBtnActive : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {STATUS_LABELS[s as Book['status']]}
              <span className={styles.filterCount}>
                {books.filter(b => b.status === s).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {activePanel === 'genre' && (
        <div className={styles.filterPanel}>
          <button
            className={`${styles.tagChip} ${styles.clearFilterBtn} ${!filterGenre ? styles.tagChipActive : ''}`}
            onClick={() => setFilterGenre(null)}
            title="Todos os gêneros"
          >
            <ClearFilterIcon />
          </button>
          {allGenres.map(genre => (
            <button
              key={genre}
              className={`${styles.tagChip} ${filterGenre === genre ? styles.tagChipActive : ''}`}
              onClick={() => setFilterGenre(filterGenre === genre ? null : genre)}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {activePanel === 'tag' && (
        <div className={styles.filterPanel}>
          <button
            className={`${styles.tagChip} ${styles.clearFilterBtn} ${!filterTag ? styles.tagChipActive : ''}`}
            onClick={() => setFilterTag(null)}
            title="Todas as tags"
          >
            <ClearFilterIcon />
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`${styles.tagChip} ${filterTag === tag ? styles.tagChipActive : ''}`}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {activePanel === 'store' && (
        <div className={styles.filterPanel}>
          <button
            className={`${styles.tagChip} ${styles.clearFilterBtn} ${!filterStore ? styles.tagChipActive : ''}`}
            onClick={() => setFilterStore(null)}
            title="Todos os locais"
          >
            <ClearFilterIcon />
          </button>
          {allStores.map(store => (
            <button
              key={store}
              className={`${styles.tagChip} ${filterStore === store ? styles.tagChipActive : ''}`}
              onClick={() => setFilterStore(filterStore === store ? null : store)}
            >
              {store}
            </button>
          ))}
        </div>
      )}

      {/* ─── Summary Bar ──────────────────────────────────────────────── */}
      {sortedFiltered.length > 0 && (() => {
        const totalPages = sortedFiltered.reduce((s, b) => s + b.pages, 0);
        const avgPages   = Math.round(totalPages / sortedFiltered.length);
        return (
          <div className={styles.librarySummary}>
            <span className={styles.summaryItem}>
              <span className={styles.summaryValue}>{sortedFiltered.length}</span>
              <span className={styles.summaryLabel}>{sortedFiltered.length === 1 ? 'livro' : 'livros'}</span>
            </span>
            <span className={styles.summarySep}>·</span>
            <span className={styles.summaryItem}>
              <span className={styles.summaryValue}>{totalPages.toLocaleString('pt-BR')}</span>
              <span className={styles.summaryLabel}>páginas</span>
            </span>
            <span className={styles.summarySep}>·</span>
            <span className={styles.summaryItem}>
              <span className={styles.summaryLabel}>média</span>
              <span className={styles.summaryValue}>{avgPages.toLocaleString('pt-BR')}</span>
              <span className={styles.summaryLabel}>págs/livro</span>
            </span>
          </div>
        );
      })()}

      {/* ─── Task 4: Period filter (Lidos) ───────────────────────────── */}
      {filterStatus === 'done' && (
        <div className={styles.donePeriodRow}>
          {/* Atalhos de ano */}
          {doneYears.map(y => {
            const yFrom = `${y}-01-01`;
            const yTo   = `${y}-12-31`;
            const active = doneFrom === yFrom && doneTo === yTo;
            return (
              <button
                key={y}
                className={`${styles.doneYearChip} ${active ? styles.doneYearChipActive : ''}`}
                onClick={() => {
                  if (active) { setDoneFrom(''); setDoneTo(''); }
                  else        { setDoneFrom(yFrom); setDoneTo(yTo); }
                }}
              >
                {y}
              </button>
            );
          })}

          {/* Separador */}
          {doneYears.length > 0 && <span className={styles.donePeriodSep}>·</span>}

          {/* Inputs de data */}
          <div className={styles.doneDateRange}>
            <input
              type="date"
              className={styles.doneDateInput}
              value={doneFrom}
              onChange={e => setDoneFrom(e.target.value)}
              title="A partir de"
              aria-label="Data inicial"
            />
            <span className={styles.doneDateDash}>–</span>
            <input
              type="date"
              className={styles.doneDateInput}
              value={doneTo}
              onChange={e => setDoneTo(e.target.value)}
              title="Até"
              aria-label="Data final"
            />
            {(doneFrom || doneTo) && (
              <button
                className={styles.doneDateClear}
                onClick={() => { setDoneFrom(''); setDoneTo(''); }}
                aria-label="Limpar período"
              >×</button>
            )}
          </div>
        </div>
      )}

      {/* ─── Task 3: Reorder hint (Quero Ler) ────────────────────────── */}
      {isWantReorderMode && sortedFiltered.length > 1 && (
        <p className={styles.wantReorderHint}>Arraste os cards para reordenar sua lista</p>
      )}

      {/* ─── Book List ────────────────────────────────────────────────── */}
      {sortedFiltered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◫</div>
          <p>
            {books.length === 0
              ? 'Acrescente livros na sua vida'
              : 'Nenhum livro encontrado com esses filtros.'}
          </p>
        </div>
      ) : (
        <div className={styles.bookList}>
          {sortedFiltered.map(book => {
            const isNew = book.id === lastAddedId;
            const card = (
              <BookCard
                book={book}
                logs={state.logs}
                isNew={isNew}
                onEdit={() => setEditBook(book)}
                onLog={handleLog}
                onDelete={() => handleDelete(book)}
                onStatusChange={handleStatusChange}
                onStartReread={handleStartReread}
                onAbandonReread={handleAbandonReread}
                onNavigateToLog={onNavigateToLog}
                onOpenQuotes={() => setQuotesBook(book)}
              />
            );

            // ── Task 3: Quero Ler draggable wrapper ──
            if (isWantReorderMode) {
              return (
                <div
                  key={book.id}
                  className={`${styles.wantDragItem} ${dragOverId === book.id && dragId !== book.id ? styles.wantDragItemOver : ''} ${dragId === book.id ? styles.wantDragItemDragging : ''}`}
                  draggable
                  onDragStart={e => handleDragStart(e, book.id)}
                  onDragOver={e => handleDragOver(e, book.id)}
                  onDrop={() => handleDrop(book.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.wantDragHandle} aria-hidden="true">
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
                      <circle cx="3.5" cy="3" r="1.5"/><circle cx="8.5" cy="3" r="1.5"/>
                      <circle cx="3.5" cy="8" r="1.5"/><circle cx="8.5" cy="8" r="1.5"/>
                      <circle cx="3.5" cy="13" r="1.5"/><circle cx="8.5" cy="13" r="1.5"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>{card}</div>
                </div>
              );
            }

            if (!isNew) return <Fragment key={book.id}>{card}</Fragment>;

            return (
              <Fragment key={book.id}>
                {/* ── Último adicionado ── */}
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                  {/* Sidebar "Novo" */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '0.5rem',
                    width: '3.25rem', flexShrink: 0,
                    color: 'var(--warm-gray)',
                  }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Novo</span>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5bab2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>{card}</div>
                </div>

                {/* Divisor entre "Novo" e a lista alfabética */}
                {sortedFiltered.length > 1 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    paddingLeft: '3.25rem',
                    color: 'var(--warm-gray)', fontSize: '0.7rem', fontWeight: 500,
                    letterSpacing: '0.05em',
                  }}>
                    <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                    <span>A — Z</span>
                    <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      {/* ─── Modals ───────────────────────────────────────────────────── */}
      {showAdd && (
        <AddBookModal
          existingTags={allTags}
          existingStores={allStores}
          existingGenres={Array.from(new Set(books.map(b => b.genre).filter(Boolean))).sort()}
          existingLanguages={Array.from(new Set(books.map(b => b.language).filter(Boolean) as string[])).sort()}
          onClose={() => setShowAdd(false)}
          onAdd={(book) => {
            addBook(book);
            setShowAdd(false);
            showToast('Livro adicionado!');
          }}
        />
      )}
      {editBook && (
        <EditBookModal
          book={editBook}
          existingTags={allTags}
          existingStores={allStores}
          existingGenres={Array.from(new Set(books.map(b => b.genre).filter(Boolean))).sort()}
          existingLanguages={Array.from(new Set(books.map(b => b.language).filter(Boolean) as string[])).sort()}
          onClose={() => setEditBook(null)}
          onSave={(book) => {
            updateBook(book);
            setEditBook(null);
            showToast('Livro atualizado!');
          }}
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

// ─── BookCard ───────────────────────────────────────────────────────────────

export function BookCard({
  book,
  logs,
  isNew: _isNew,
  onEdit,
  onLog,
  onDelete,
  onStatusChange,
  onStartReread,
  onAbandonReread,
  onNavigateToLog,
  onOpenQuotes,
}: {
  book: Book;
  logs: ReadingLog[];
  isNew?: boolean;
  onEdit: () => void;
  onLog: (log: ReadingLog) => void;
  onDelete: () => void;
  onStatusChange: (book: Book, status: Book['status']) => void;
  onStartReread: (book: Book) => void;
  onAbandonReread?: (book: Book) => void;
  onNavigateToLog?: (bookId?: string) => void;
  onOpenQuotes?: () => void;
}) {
  const isDone      = book.status === 'done';
  const isRereading = book.status === 'rereading';
  const isFullyRead = isDone || (book.pages > 0 && book.currentPage >= book.pages);
  const sp          = book.startPage ?? 0;
  const pagesRead   = isDone ? Math.max(0, book.pages - sp) : Math.max(0, book.currentPage - sp);
  const pct         = isDone ? 100 : getBookPercent(book);
  const pagesLeft   = isDone ? 0 : Math.max(0, book.pages - book.currentPage);

  // Previsão de término com base na média dos últimos 14 dias de leitura
  const estimatedEndDate = useMemo(() => {
    if (book.pages <= 0 || pagesLeft <= 0) return null;
    if (book.status !== 'reading' && book.status !== 'rereading') return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const recent = logs.filter(l => l.bookId === book.id && l.date >= cutoffStr);
    if (recent.length === 0) return null;
    const pagesSum   = recent.reduce((s, l) => s + l.pages, 0);
    const uniqueDays = new Set(recent.map(l => l.date)).size;
    if (uniqueDays === 0) return null;
    const avg = pagesSum / uniqueDays;
    if (avg <= 0) return null;
    const daysNeeded = Math.ceil(pagesLeft / avg);
    const end = new Date();
    end.setDate(end.getDate() + daysNeeded);
    const dd = String(end.getDate()).padStart(2, '0');
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const yy = String(end.getFullYear()).slice(2);
    return `${dd}/${mm}/${yy}`;
  }, [book.id, book.pages, book.status, pagesLeft, logs]);

  // Quantas vezes o livro foi lido (inclui a leitura atual)
  const readCount = (book.readSessions?.length ?? 0) + 1;

  // Status "Lendo" só disponível se há páginas registradas ou o livro já está nesse status
  const hasReadPages = book.currentPage > 0 || logs.some(l => l.bookId === book.id && l.pages > 0);

  // Cover error state (shows placeholder when URL fails to load)
  const [coverError, setCoverError] = useState(false);

  // Flip state
  const [flipped, setFlipped] = useState(false);
  const [logDate, setLogDate] = useState(today());
  const [inputMode, setInputMode] = useState<'page' | 'pct'>('page');
  const [logCurrentPage, setLogCurrentPage] = useState('');
  const [logPct, setLogPct] = useState('');

  // Auto-correct: livro fisicamente 100% lido mas status não atualizado (ex: importado via CSV)
  useEffect(() => {
    if (book.pages > 0 && book.currentPage >= book.pages &&
        book.status !== 'done' && book.status !== 'rereading') {
      onStatusChange(book, 'done');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.currentPage, book.pages, book.status]);

  // Reset back form when flipping to front or when book updates after a log
  useEffect(() => {
    if (!flipped) {
      setLogCurrentPage('');
      setLogPct('');
      setLogDate(today());
    }
  }, [flipped, book.currentPage]);

  // If never logged yet (currentPage=0), use startPage as baseline
  const minBackPage     = book.currentPage > 0 ? book.currentPage : (book.startPage ?? 0);
  const inputPlaceholder = book.currentPage === 0 && book.firstPageNum != null
    ? book.firstPageNum
    : minBackPage + 1;
  const effectiveMin    = inputPlaceholder;

  // Computed page from whichever mode is active
  const computedPage = inputMode === 'page'
    ? (parseInt(logCurrentPage) || 0)
    : book.pages > 0 ? Math.min(book.pages, Math.round((parseFloat(logPct) || 0) / 100 * book.pages)) : 0;

  // Current progress as % (for placeholder / validation in pct mode)
  const currentPct = book.pages > 0 ? Math.round(book.currentPage / book.pages * 100) : 0;

  const backPagesAdded = computedPage > minBackPage ? computedPage - minBackPage : 0;
  const backPagesLeft  = Math.max(0, book.pages - computedPage);

  const isInputValid = inputMode === 'page'
    ? computedPage >= effectiveMin && computedPage > minBackPage
    : (parseFloat(logPct) || 0) > currentPct && computedPage > minBackPage;

  const lastLog = logs
    .filter(l => l.bookId === book.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button, select, input, label, a')) return;
    setFlipped(f => !f);
  }

  function handleBackSubmit() {
    if (!isInputValid) return;
    const log: ReadingLog = {
      id: crypto.randomUUID(),
      bookId: book.id,
      bookTitle: book.title,
      date: logDate,
      pages: computedPage - minBackPage,
      currentPage: computedPage,
    };
    onLog(log);
    setFlipped(false);
  }

  return (
    <div className={styles.bookCard} onClick={handleCardClick}>
      <div className={`${styles.cardFlipInner} ${flipped ? styles.flipped : ''}`}>

        {/* ── Front face ──────────────────────────────────────────────── */}
        <div className={styles.cardFront} style={{ position: 'relative' }}>
          {/* Cover */}
          <div className={styles.cardCover}>
            {book.status !== 'want' && (
              <div className={`${styles.statusRibbon} ${styles[isRereading ? 'ribbon_reading' : `ribbon_${book.status}`]}`}>
                {isRereading ? 'Lendo' : STATUS_LABELS[book.status]}
              </div>
            )}
            {book.cover && !coverError ? (
              <img src={book.cover} alt={book.title} onError={() => setCoverError(true)} />
            ) : (
              <div className={styles.cardCoverPlaceholder}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c5bab2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className={styles.cardInfo}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleGroup}>
                <div className={styles.cardTitle}>{book.title}</div>
                <div className={styles.cardAuthor}>{book.author}</div>
              </div>
              <div className={styles.cardHeaderRight}>
                <div className={styles.cardIconActions}>
                  <button
                    className={styles.iconBtn}
                    onClick={e => { e.stopPropagation(); setFlipped(true); }}
                    title="Registrar leitura"
                  >+</button>
                  <button
                    className={styles.iconBtn}
                    onClick={e => { e.stopPropagation(); onEdit(); }}
                    title="Editar livro"
                  >✎</button>
                  {onOpenQuotes && (
                    <button
                      className={`${styles.iconBtn} ${styles.quoteIconBtn} ${(book.quotes?.length || book.quote) ? styles.quoteIconBtnActive : ''}`}
                      onClick={e => { e.stopPropagation(); onOpenQuotes(); }}
                      title="Trechos marcantes"
                      aria-label="Trechos marcantes"
                    >
                      ❝
                      {(book.quotes?.length || book.quote) ? (
                        <span className={styles.quoteIconDot} aria-hidden="true" />
                      ) : null}
                    </button>
                  )}
                  <button
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    title="Excluir livro"
                    aria-label="Excluir livro"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <path d="M1.5 3.5h10M4.5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v3.5M7.5 6v3.5M2.5 3.5l.65 6.6a.6.6 0 00.6.4h5.5a.6.6 0 00.6-.4l.65-6.6H2.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.cardMeta}>
              {book.genre && <span>{book.genre}</span>}
              {readCount > 1 && (
                <span className={styles.rereadCount}>{readCount}ª leitura</span>
              )}
              {book.format && (
                <span className={styles.formatBadge}>
                  {book.format === 'physical' ? '📖 Físico' : '📱 Digital'}
                </span>
              )}
            </div>
            {book.store && (
              <div className={styles.storeLabel}>
                <span className={styles.storeIcon}>📍</span>{book.store}
              </div>
            )}

            <div className={styles.cardStats}>
              <div className={`${styles.statItem} ${styles.statItemMuted}`}>
                <span className={styles.statLabel}>Páginas</span>
                <span className={styles.statValue}>{book.pages}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Lidas</span>
                <span className={styles.statValue}>{pagesRead}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Restantes</span>
                <span className={styles.statValue}>{pagesLeft}</span>
              </div>
              <div className={`${styles.statItem} ${styles.statItemAccent}`}>
                <span className={styles.statLabel}>Lido</span>
                <span className={`${styles.statValue} ${styles.statPct}`}>{pct}%</span>
              </div>
            </div>

            {(book.status === 'reading' || isRereading) && (
              <div className={styles.cardProgress}>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${pct}%`, background: isRereading ? 'var(--gold)' : 'var(--olive)' }}
                  />
                </div>
              </div>
            )}
            {/* Previsão + tags na mesma linha para não aumentar o card */}
            {(estimatedEndDate || book.tags.length > 0) && (
              <div className={styles.estimateLine}>
                {estimatedEndDate && (
                  <span className={styles.cardEstimate}>
                    Previsão: <strong>{estimatedEndDate}</strong>
                  </span>
                )}
                {book.tags.length > 0 && (
                  <div className={styles.cardTags}>
                    {book.tags.map(tag => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={styles.cardActions}>
              <select
                className={`form-select ${styles.statusSelect}`}
                value={book.status}
                onChange={e => onStatusChange(book, e.target.value as Book['status'])}
                onClick={e => e.stopPropagation()}
              >
                {isFullyRead ? (
                  <>
                    <option value="done">Lido</option>
                    <option value="rereading">Reler</option>
                  </>
                ) : (
                  <>
                    <option value="want">Quero ler</option>
                    {(hasReadPages || book.status === 'reading') && <option value="reading">Lendo</option>}
                    {(hasReadPages || book.status === 'rereading') && <option value="rereading">Reler</option>}
                    <option value="done">Lido</option>
                    <option value="abandoned">Abandonado</option>
                  </>
                )}
              </select>

              {/* Datas ao lado do status */}
              {(book.status === 'done' || book.status === 'reading' || book.status === 'rereading') && book.startDate && (
                <span className={styles.cardDateRange} onClick={e => e.stopPropagation()}>
                  {toDisplayDate(book.startDate)}
                  {' → '}
                  {book.status === 'done' ? (book.endDate ? toDisplayDate(book.endDate) : 'Hoje') : 'Hoje'}
                </span>
              )}
            </div>
          </div>
          <span className={styles.flipHint} aria-hidden="true">↻</span>
        </div>

        {/* ── Back face (log form) ─────────────────────────────────────── */}
        <div className={styles.cardBack}>
          <div className={styles.backInfo}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className={styles.backBookTitle} style={{ flex: 1, minWidth: 0 }}>{book.title}</div>
              <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                {isDone && (
                  <button
                    className={styles.rereadIconBtn}
                    title="Reler este livro"
                    onClick={e => { e.stopPropagation(); onStartReread(book); }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"/>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                      <polyline points="7 23 3 19 7 15"/>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                  </button>
                )}
                {onAbandonReread && !isDone && (book.readSessions?.length ?? 0) > 0 && (
                  <button
                    className={styles.abandonRereadBtn}
                    title="Remove a releitura em andamento e restaura o livro como Lido"
                    onClick={e => { e.stopPropagation(); onAbandonReread(book); setFlipped(false); }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Desistir da releitura
                  </button>
                )}
                {onNavigateToLog && (
                  <button
                    className={styles.iconBtn}
                    title="Ver registros deste livro"
                    onClick={e => { e.stopPropagation(); onNavigateToLog(book.id); }}
                  >≡</button>
                )}
              </div>
            </div>
            <div className={styles.backBookMeta}>
              {book.author} · pg. {book.currentPage} / {book.pages}
              {lastLog && <> · último: {toDisplayDate(lastLog.date)}</>}
            </div>
          </div>

          {/* Toggle acima do grid para não desalinhar as colunas */}
          <div className={styles.backToggleRow} onClick={e => e.stopPropagation()}>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.modeBtn} ${inputMode === 'page' ? styles.modeBtnActive : ''}`}
                onClick={() => { setInputMode('page'); setLogPct(''); }}
              >Pág</button>
              <button
                type="button"
                className={`${styles.modeBtn} ${inputMode === 'pct' ? styles.modeBtnActive : ''}`}
                onClick={() => { setInputMode('pct'); setLogCurrentPage(''); }}
                disabled={!book.pages}
              >%</button>
            </div>
          </div>

          <div className={styles.backFields}>
            <div>
              <label className="label">Data</label>
              <input
                className="form-input"
                type="date"
                value={logDate}
                max={today()}
                onChange={e => setLogDate(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div>
              <label className="label">{inputMode === 'page' ? 'Nova página' : 'Progresso (%)'}</label>
              {inputMode === 'page' ? (
                <input
                  className="form-input"
                  type="number"
                  min={inputPlaceholder}
                  max={book.pages || undefined}
                  value={logCurrentPage}
                  onChange={e => setLogCurrentPage(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleBackSubmit(); }}
                  placeholder={String(inputPlaceholder)}
                />
              ) : (
                <input
                  className="form-input"
                  type="number"
                  min={Math.min(100, currentPct + 1)}
                  max={100}
                  value={logPct}
                  onChange={e => setLogPct(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleBackSubmit(); }}
                  placeholder={`${Math.min(100, currentPct + 1)}%`}
                />
              )}
            </div>
          </div>

          {isInputValid && (
            <p className={styles.backHint}>
              {inputMode === 'pct' && <span>pg. {computedPage} · </span>}
              +{backPagesAdded} páginas · {backPagesLeft} restantes
            </p>
          )}

          <div className={styles.backActions}>
            <button
              type="button"
              className="btn-secondary"
              onClick={e => { e.stopPropagation(); setFlipped(false); }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={e => { e.stopPropagation(); handleBackSubmit(); }}
              disabled={!isInputValid}
            >
              Registrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
