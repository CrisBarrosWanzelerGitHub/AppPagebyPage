import { useState } from 'react';
import type { Book, ReadingLog } from '../types';
import { today } from '../utils/dates';
import styles from './Modal.module.css';
import logStyles from './LogPagesModal.module.css';

interface Props {
  book: Book;
  logs: ReadingLog[];
  onClose: () => void;
  onLog: (log: ReadingLog) => void;
}

export default function LogPagesModal({ book, logs, onClose, onLog }: Props) {
  const lastLog = logs
    .filter(l => l.bookId === book.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const [date, setDate] = useState(today());
  const [currentPage, setCurrentPage] = useState(String(book.currentPage));

  const parsedCurrentPage = parseInt(currentPage) || 0;
  const pagesLeft = Math.max(0, book.pages - parsedCurrentPage);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cp = parsedCurrentPage;
    if (cp <= book.currentPage) return;

    const log: ReadingLog = {
      id: crypto.randomUUID(),
      bookId: book.id,
      bookTitle: book.title,
      date,
      pages: Math.max(0, cp - book.currentPage),
      currentPage: cp,
    };
    onLog(log);
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Registrar leitura</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className={styles.body}>
          <div className={logStyles.bookInfo}>
            {book.cover && <img src={book.cover} alt={book.title} className={logStyles.cover} />}
            <div>
              <div className={logStyles.bookTitle}>{book.title}</div>
              <div className={logStyles.bookMeta}>
                {book.author} · {book.pages} páginas
              </div>
              <div className={logStyles.bookCurrent}>
                Última página: <strong>{book.currentPage}</strong>
                {lastLog && <span> · {lastLog.date}</span>}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.row2}>
              <div className="field">
                <label className="label">Data</label>
                <input
                  className="form-input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={today()}
                />
              </div>
              <div className="field">
                <label className="label">Página atual</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max={book.pages}
                  value={currentPage}
                  onChange={e => setCurrentPage(e.target.value)}
                  placeholder={String(book.currentPage)}
                />
                <p className={logStyles.pageHint}>{pagesLeft} páginas restantes</p>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Registrar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
