import { useState, useMemo, useEffect } from 'react';
import type { AppState, Book, ReadingLog } from '../types';
import { today, toDisplayDate } from '../utils/dates';
import styles from './LogTab.module.css';

interface Props {
  state: AppState;
  addLog: (log: ReadingLog) => void;
  addLogs: (logs: ReadingLog[]) => void;
  deleteLog: (id: string) => void;
  updateBook: (book: Book) => void;
  startReread?: (bookId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'delete', options?: { undo?: () => void; onExpire?: () => void; countdown?: number; onConfirm?: () => void; confirmLabel?: string }) => void;
  initialBookId?: string;
  [key: string]: unknown;
}

export default function LogTab({ state, addLog, deleteLog, updateBook, startReread, showToast, initialBookId }: Props) {
  const { books, logs } = state;

  const [selectedBookId, setSelectedBookId] = useState(initialBookId || '');
  const [date, setDate] = useState(today());
  const [currentPageInput, setCurrentPageInput] = useState('');
  const [historyFilterId, setHistoryFilterId] = useState(initialBookId || '');
  const [onlyReading, setOnlyReading] = useState(true);
  const [logPage, setLogPage] = useState(0);
  const PAGE_SIZE = 100;

  // When navigating from BookCard, pre-select and filter
  useEffect(() => {
    if (initialBookId) {
      setSelectedBookId(initialBookId);
      setHistoryFilterId(initialBookId);
    }
  }, [initialBookId]);

  // Book map for remaining pages lookup
  const bookMap = useMemo(() => new Map(books.map(b => [b.id, b])), [books]);

  // Books shown in the log selector — filtered to reading/rereading by default
  const selectableBooks = useMemo(() => {
    if (!onlyReading) return books;
    const reading = books.filter(b => b.status === 'reading' || b.status === 'rereading' || b.status === 'want');
    // Always keep the currently selected book in the list even if its status changed
    if (selectedBookId && !reading.some(b => b.id === selectedBookId)) {
      const sel = books.find(b => b.id === selectedBookId);
      if (sel) return [...reading, sel];
    }
    return reading;
  }, [books, onlyReading, selectedBookId]);

  const selectedBook = books.find(b => b.id === selectedBookId) || null;

  // Book is done when currentPage has reached total pages
  const isBookDone = !!(selectedBook && selectedBook.pages > 0 && selectedBook.currentPage >= selectedBook.pages);

  // Derived values — input is the new current page; system calculates pages read
  const minPage = selectedBook
    ? (selectedBook.currentPage > 0 ? selectedBook.currentPage : (selectedBook.startPage ?? 0))
    : 0;
  // Visible min/placeholder: use firstPageNum when no logs yet to avoid showing negative numbers
  const inputMin = selectedBook?.currentPage === 0 && selectedBook?.firstPageNum != null
    ? selectedBook.firstPageNum
    : minPage + 1;
  const parsedCurrentPage  = parseInt(currentPageInput) || 0;
  const pagesReadThisSession = parsedCurrentPage > minPage ? parsedCurrentPage - minPage : 0;
  const remainingPages = selectedBook && selectedBook.pages > 0
    ? Math.max(0, selectedBook.pages - parsedCurrentPage)
    : null;

  // Last log for selected book
  const lastLog = useMemo(() => {
    if (!selectedBook) return null;
    return logs
      .filter(l => l.bookId === selectedBook.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }, [selectedBook, logs]);

  function handleBookChange(id: string) {
    setSelectedBookId(id);
    setCurrentPageInput('');
    setHistoryFilterId(id);
    setLogPage(0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBook || !date) return;

    const cp = parsedCurrentPage;
    const pr = pagesReadThisSession;

    if (pr <= 0) {
      showToast('Informe uma página maior que a atual.', 'error');
      return;
    }

    const log: ReadingLog = {
      id: crypto.randomUUID(),
      bookId: selectedBook.id,
      bookTitle: selectedBook.title,
      date,
      pages: pr,
      currentPage: cp,
    };

    const newStatus: Book['status'] =
      cp >= selectedBook.pages && selectedBook.pages > 0
        ? 'done'
        : cp > 0
        ? 'reading'
        : selectedBook.status;
    const updatedBook: Book = {
      ...selectedBook,
      currentPage: cp,
      status: newStatus,
      endDate: newStatus === 'done' && !selectedBook.endDate ? date : selectedBook.endDate,
      startDate: selectedBook.startDate || date,
    };

    addLog(log);
    updateBook(updatedBook);

    setCurrentPageInput('');
    showToast('Leitura registrada!');

    if (cp >= selectedBook.pages && selectedBook.pages > 0) {
      showToast('Parabéns! Livro concluído!');
    }
  }

  // Sort logs newest first; reverse first so same-date entries keep insertion order (newest on top)
  const sortedLogs = [...logs]
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(l => !historyFilterId || l.bookId === historyFilterId);

  const totalPages = Math.ceil(sortedLogs.length / PAGE_SIZE);
  const safePage   = Math.min(logPage, Math.max(0, totalPages - 1));
  const pagedLogs  = sortedLogs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function handleDeleteLog(log: ReadingLog) {
    const book = bookMap.get(log.bookId);
    const wasDone = book?.status === 'done';

    // Pre-compute remaining logs at the moment the user triggers deletion
    const remainingLogs = logs.filter(l => l.id !== log.id && l.bookId === log.bookId);

    const doDelete = () => {
      deleteLog(log.id);

      // Se o livro estava "Lido", reverter para "Lendo" com currentPage consistente
      if (wasDone && book) {
        const lastWithPage = [...remainingLogs]
          .filter(l => l.currentPage != null)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        // currentPage deve ser < pages para não disparar o auto-correct de isFullyRead
        const raw = lastWithPage?.currentPage ?? (book.pages > 0 ? book.pages - 1 : Math.max(0, book.currentPage - 1));
        const newCurrentPage = book.pages > 0 ? Math.min(raw, book.pages - 1) : raw;
        const newStatus: Book['status'] = newCurrentPage > 0 ? 'reading' : 'want';

        updateBook({
          ...book,
          status: newStatus,
          currentPage: newCurrentPage,
          endDate: undefined,
        });
      }
    };

    showToast('Excluindo em 10 segundos…', 'delete', {
      countdown: 10000,
      onExpire:  doDelete,
      onConfirm: doDelete,
      confirmLabel: 'Confirmar exclusão',
    });
  }

  return (
    <div className={styles.root}>
      {/* ─── Form ────────────────────────────────────────────────────── */}
      <div className={`card ${styles.formCard}`}>
        <div className={styles.cardTitleRow}>
          {selectedBookId && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => handleBookChange('')}
              aria-label="Voltar"
            >
              ←
            </button>
          )}
          <h2 className={styles.cardTitle}>Registrar leitura</h2>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="field">
            <div className={styles.bookFieldHeader}>
              <label className="label">Livro</label>
              <label className={styles.readingToggle}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={onlyReading}
                  onChange={e => setOnlyReading(e.target.checked)}
                />
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleThumb} />
                </span>
                <span className={styles.toggleLabel}>Lendo e quero ler</span>
              </label>
            </div>
            <select
              className="form-select"
              value={selectedBookId}
              onChange={e => handleBookChange(e.target.value)}
              required
            >
              <option value="">
                {onlyReading && selectableBooks.length === 0
                  ? 'Nenhum livro em leitura ou quero ler'
                  : 'Selecione um livro...'}
              </option>
              {selectableBooks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.title}
                  {b.status === 'reading' ? ' (lendo)' : b.status === 'rereading' ? ' (relendo)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedBook && (
            <div className={styles.bookHint}>
              {selectedBook.cover && (
                <img src={selectedBook.cover} alt="" className={styles.hintCover} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.hintTop}>
                  <div className={styles.hintAuthor}>{selectedBook.author}</div>
                  <span className={`${styles.statusBadge} ${
                    selectedBook.status === 'reading'   ? styles.badgeReading   :
                    selectedBook.status === 'done'      ? styles.badgeDone      :
                    selectedBook.status === 'abandoned' ? styles.badgeAbandoned :
                    styles.badgeWant
                  }`}>
                    {selectedBook.status === 'reading'   ? 'Lendo'      :
                     selectedBook.status === 'done'      ? 'Lido'       :
                     selectedBook.status === 'abandoned' ? 'Abandonado' :
                     'Quero ler'}
                  </span>
                </div>
                <div className={styles.hintMeta}>
                  Página atual: <strong>{selectedBook.currentPage}</strong> / {selectedBook.pages}
                  {lastLog && <> · Último registro: {toDisplayDate(lastLog.date)}</>}
                </div>
              </div>
            </div>
          )}

          {isBookDone ? (
            <div className={styles.doneNotice}>
              <div className={styles.doneNoticeText}>
                <strong>Livro concluído!</strong>
                <span>Quer começar uma releitura?</span>
              </div>
              {selectedBook?.status === 'done' && startReread && (
                <button
                  type="button"
                  className={styles.doneRereadBtn}
                  onClick={() => {
                    startReread(selectedBook.id);
                    showToast('Releitura iniciada!', 'success');
                    handleBookChange('');
                  }}
                >
                  Iniciar releitura
                </button>
              )}
            </div>
          ) : (
            <div className={styles.formRow}>
              <div className="field">
                <label className="label">Data</label>
                <input
                  className="form-input"
                  type="date"
                  value={date}
                  max={today()}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Página atual</label>
                <input
                  className="form-input"
                  type="number"
                  min={inputMin}
                  max={selectedBook?.pages || undefined}
                  value={currentPageInput}
                  onChange={e => setCurrentPageInput(e.target.value)}
                  placeholder={String(inputMin)}
                  disabled={!selectedBook}
                />
              </div>
            </div>
          )}

          {!isBookDone && selectedBook && pagesReadThisSession > 0 && (
            <div className={styles.calcHint}>
              <span>+<strong>{pagesReadThisSession}</strong> páginas lidas</span>
              {remainingPages !== null && (
                <span>Restam <strong>{remainingPages}</strong></span>
              )}
            </div>
          )}

          <div className={styles.formFooter}>
            <button type="submit" className="btn-primary" disabled={!selectedBook || isBookDone}>
              Salvar registro
            </button>
          </div>
        </form>
      </div>

      {/* ─── History Table ────────────────────────────────────────────── */}
      <div className={`card ${styles.historyCard}`}>
        <div className={styles.historyHeader}>
          <h2 className={styles.cardTitle}>Histórico de registros</h2>
          <select
            className="form-select"
            style={{ maxWidth: 200, fontSize: '0.82rem' }}
            value={historyFilterId}
            onChange={e => setHistoryFilterId(e.target.value)}
          >
            <option value="">Todos os livros</option>
            {books.map(b => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        </div>

        {sortedLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <div className="empty-icon">✎</div>
            <p>{logs.length === 0 ? 'Nenhum registro ainda. Comece a registrar sua leitura!' : 'Nenhum registro encontrado.'}</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Livro</th>
                    <th>Págs. lidas</th>
                    <th>Pág. Atual</th>
                    <th>Restantes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLogs.map(log => {
                    const logBook = bookMap.get(log.bookId);
                    const remaining = logBook && logBook.pages > 0 && log.currentPage != null
                      ? Math.max(0, logBook.pages - log.currentPage)
                      : null;
                    return (
                      <tr key={log.id}>
                        <td>{toDisplayDate(log.date)}</td>
                        <td className={styles.logBook}>{log.bookTitle}</td>
                        <td><strong>{log.pages}</strong></td>
                        <td>{log.currentPage ?? '—'}</td>
                        <td style={{ color: remaining === 0 ? 'var(--gold)' : 'var(--warm-gray)' }}>
                          {remaining === null ? '—' : remaining === 0 ? '✓' : remaining.toLocaleString('pt-BR')}
                        </td>
                        <td>
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDeleteLog(log)}
                            title="Excluir registro"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sortedLogs.length)} de {sortedLogs.length} registros
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.paginationBtn}
                    onClick={() => setLogPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                  >
                    ← Anterior
                  </button>
                  <span className={styles.paginationPage}>
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    className={styles.paginationBtn}
                    onClick={() => setLogPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
