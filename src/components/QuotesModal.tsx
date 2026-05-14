import { useState } from 'react';
import type { Book } from '../types';
import mStyles from './Modal.module.css';
import styles from './QuotesModal.module.css';

interface Props {
  book: Book;
  onSave: (quotes: string[]) => void;
  onClose: () => void;
}

export default function QuotesModal({ book, onSave, onClose }: Props) {
  // Inicializa a partir do array novo (quotes) ou migra do campo legado (quote)
  const initial: string[] = book.quotes?.length
    ? [...book.quotes]
    : book.quote?.trim() ? [book.quote.trim()] : [];

  const [quotes, setQuotes] = useState<string[]>(initial);
  const [draft, setDraft] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  function addQuote() {
    const t = draft.trim();
    if (!t) return;
    setQuotes(q => [...q, t]);
    setDraft('');
  }

  function deleteQuote(i: number) {
    setQuotes(q => q.filter((_, idx) => idx !== i));
    if (editIdx === i) { setEditIdx(null); setEditVal(''); }
  }

  function startEdit(i: number) {
    setEditIdx(i);
    setEditVal(quotes[i]);
  }

  function saveEdit() {
    if (editIdx === null) return;
    const t = editVal.trim();
    if (t) {
      setQuotes(q => q.map((item, i) => i === editIdx ? t : item));
    } else {
      deleteQuote(editIdx);
    }
    setEditIdx(null);
    setEditVal('');
  }

  function handleSave() {
    // Inclui o rascunho atual mesmo que não tenha clicado em "Adicionar"
    const pending = draft.trim();
    const all = [...quotes, ...(pending ? [pending] : [])].filter(q => q.trim());
    onSave(all);
    onClose();
  }

  return (
    <div
      className={mStyles.overlay}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={mStyles.modal}>

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className={mStyles.header}>
          <div>
            <h2 className={mStyles.title}>Trechos marcantes</h2>
            <p className={styles.bookName}>{book.title}</p>
          </div>
          <button className={mStyles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {/* ─── Body ───────────────────────────────────────────────────── */}
        <div className={`${mStyles.body} ${styles.body}`}>

          {/* Lista de quotes existentes */}
          {quotes.length === 0 && editIdx === null && (
            <p className={styles.empty}>
              Nenhum trecho ainda. Adicione algo que te marcou neste livro.
            </p>
          )}

          {quotes.map((q, i) => (
            <div key={i} className={styles.quoteItem}>
              {editIdx === i ? (
                <div className={styles.editBlock}>
                  <textarea
                    className={`form-input ${styles.editTextarea}`}
                    rows={3}
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setEditIdx(null); setEditVal(''); }}
                    >
                      Cancelar
                    </button>
                    <button type="button" className="btn-primary" onMouseDown={e => e.preventDefault()} onClick={saveEdit}>
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <blockquote className={styles.quoteText}>"{q}"</blockquote>
                  <div className={styles.quoteActions}>
                    <button
                      className={styles.quoteBtn}
                      onClick={() => startEdit(i)}
                      title="Editar"
                      aria-label="Editar trecho"
                    >✎</button>
                    <button
                      className={`${styles.quoteBtn} ${styles.quoteBtnDanger}`}
                      onClick={() => deleteQuote(i)}
                      title="Excluir"
                      aria-label="Excluir trecho"
                    >×</button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Separador */}
          {quotes.length > 0 && (
            <div className={styles.divider} />
          )}

          {/* Adicionar novo */}
          <div className={styles.addSection}>
            <label className="label">Adicionar trecho</label>
            <textarea
              className={`form-input ${styles.draftTextarea}`}
              rows={5}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Uma frase ou passagem que te marcou…"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  addQuote();
                }
              }}
            />
            <div className={styles.addRow}>
              <span className={styles.addHint}>⌘ + Enter para adicionar</span>
              <button
                type="button"
                className="btn-primary"
                onClick={addQuote}
                disabled={!draft.trim()}
              >
                Adicionar
              </button>
            </div>
          </div>

        </div>

        {/* ─── Footer ─────────────────────────────────────────────────── */}
        <div
          className={mStyles.actions}
          style={{ padding: '1rem 1.5rem 1.5rem', marginTop: 0 }}
        >
          <button type="button" className="btn-secondary" onMouseDown={e => e.preventDefault()} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onMouseDown={e => e.preventDefault()} onClick={handleSave}>
            Salvar trechos
          </button>
        </div>

      </div>
    </div>
  );
}
