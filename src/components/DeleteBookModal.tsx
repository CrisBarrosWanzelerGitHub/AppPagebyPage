import type { Book, ReadingLog } from '../types';
import modalStyles from './Modal.module.css';

interface Props {
  book: Book;
  logs: ReadingLog[];
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteBookModal({ book, logs, onCancel, onConfirm }: Props) {
  const bookLogs  = logs.filter(l => l.bookId === book.id);
  const totalRead = bookLogs.reduce((s, l) => s + l.pages, 0);

  return (
    <div className={modalStyles.overlay} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={modalStyles.modal} style={{ maxWidth: 400 }}>
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>Excluir livro</h2>
          <button className={modalStyles.closeBtn} onClick={onCancel} aria-label="Fechar">×</button>
        </div>
        <div className={modalStyles.body}>
          <p style={{ fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>
            Você está prestes a excluir <strong>"{book.title}"</strong>.
          </p>
          {bookLogs.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--danger)', lineHeight: 1.5, marginTop: '0.75rem', background: 'var(--danger-light)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.85rem' }}>
              ⚠ Isso também excluirá <strong>{bookLogs.length} {bookLogs.length === 1 ? 'registro' : 'registros'}</strong> e{' '}
              <strong>{totalRead.toLocaleString('pt-BR')} páginas lidas</strong> permanentemente.
            </p>
          )}
          <p style={{ fontSize: '0.82rem', color: 'var(--warm-gray)', marginTop: '0.75rem' }}>
            Esta ação não pode ser desfeita.
          </p>
          <div className={modalStyles.actions}>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn-danger" onClick={onConfirm}>
              Excluir definitivamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
