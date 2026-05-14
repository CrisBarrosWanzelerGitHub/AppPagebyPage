import { useState } from 'react';
import type { Book } from '../types';
import styles from './Modal.module.css';
import GenreCombobox from './GenreCombobox';

interface Props {
  book: Book;
  onClose: () => void;
  onSave: (book: Book) => void;
  existingTags?: string[];
  existingStores?: string[];
  existingGenres?: string[];
  existingLanguages?: string[];
}

function getTagArray(s: string): string[] {
  return s.split(',').map(t => t.trim()).filter(Boolean);
}
function toggleTag(current: string, tag: string): string {
  const arr = getTagArray(current);
  if (arr.includes(tag)) return arr.filter(t => t !== tag).join(', ');
  return current.trim() ? `${current.trim()}, ${tag}` : tag;
}

// Reverse-engineer pagesAdditional and firstPageNum from stored values
function deriveReadFields(book: Book): { pagesAdditional: string; firstPageNum: string } {
  const firstPage  = book.firstPageNum ?? 1;
  const sp         = book.startPage ?? 0;
  const additional = (firstPage - 1) - sp; // inverse of sp = (firstPage-1) - additional
  return {
    firstPageNum:   String(firstPage),
    pagesAdditional: additional > 0 ? String(additional) : '',
  };
}

export default function EditBookModal({ book, onClose, onSave, existingTags, existingStores, existingGenres, existingLanguages }: Props) {
  const derived = deriveReadFields(book);

  const [form, setForm] = useState({
    title:           book.title,
    author:          book.author,
    genre:           book.genre,
    pages:           String(book.pages),
    cover:           book.cover,
    status:          book.status,
    tags:            book.tags.join(', '),
    startDate:       book.startDate || '',
    endDate:         book.endDate   || '',
    currentPage:     String(book.currentPage),
    isbn:            book.isbn || '',
    pagesAdditional: derived.pagesAdditional,
    firstPageNum:    derived.firstPageNum,
    format:          (book.format || '') as '' | 'physical' | 'digital',
    store:           book.store    || '',
    language:        book.language || '',
    quote:           book.quote    || '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    const pagesAdditional = parseInt(form.pagesAdditional) || 0;
    const firstPage       = form.firstPageNum !== '' ? (parseInt(form.firstPageNum) || 1) : 1;
    const sp              = (firstPage - 1) - pagesAdditional;

    const newPages      = parseInt(form.pages) || 0;
    const rawCurrentPage = parseInt(form.currentPage) || 0;
    // Livro "lido" deve sempre estar na última página — ajusta automaticamente se o total mudou
    const finalCurrentPage = form.status === 'done' && newPages > 0
      ? newPages
      : rawCurrentPage;

    const updated: Book = {
      ...book,
      title:      form.title.trim(),
      author:     form.author.trim(),
      genre:      form.genre.trim(),
      pages:      newPages,
      cover:      form.cover.trim(),
      status:     form.status as Book['status'],
      tags:       form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      startDate:  form.startDate  || undefined,
      endDate:    form.status === 'done'
                    ? (form.endDate || new Date().toISOString().split('T')[0])
                    : (form.endDate || undefined),
      currentPage: finalCurrentPage,
      startPage:   sp !== 0 ? sp : undefined,
      firstPageNum: firstPage !== 1 ? firstPage : undefined,
      isbn:        form.isbn.trim()     || undefined,
      format:      form.format          || undefined,
      store:       form.store.trim()    || undefined,
      language:    form.language.trim() || undefined,
      quote:       form.quote.trim()    || undefined,
    };
    onSave(updated);
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Editar livro</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className={styles.body}>
          <form id="edit-book-form" onSubmit={handleSubmit}>

            {/* Título */}
            <div className="field">
              <label className="label">Título *</label>
              <input className="form-input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>

            {/* Autor */}
            <div className="field">
              <label className="label">Autor</label>
              <input className="form-input" value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
            </div>

            {/* Gênero + Páginas */}
            <div className={styles.row2}>
              <div className="field">
                <label className="label">Gênero</label>
                <GenreCombobox
                  value={form.genre}
                  onChange={genre => setForm(f => ({ ...f, genre }))}
                  extraOptions={existingGenres}
                />
              </div>
              <div className="field">
                <label className="label">Páginas</label>
                <input className="form-input" type="number" min="1" value={form.pages}
                  onChange={e => setForm(f => ({ ...f, pages: e.target.value }))} />
              </div>
            </div>

            {/* Capa */}
            <div className="field">
              <label className="label">Capa <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(URL da imagem — clique direito → "Copiar endereço")</span></label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <input className="form-input" style={{ flex: 1 }} value={form.cover}
                  onChange={e => setForm(f => ({ ...f, cover: e.target.value }))}
                  placeholder="https://exemplo.com/capa.jpg" />
                {form.cover && (
                  <img src={form.cover} alt="Capa"
                    style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 4, border: '0.5px solid var(--border)', flexShrink: 0 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
            </div>

            {/* Status + Página atual */}
            <div className={styles.row2}>
              <div className="field">
                <label className="label">Status</label>
                <select className="form-select" value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as Book['status'] }))}>
                  <option value="want">Quero ler</option>
                  <option value="reading">Lendo</option>
                  <option value="done">Lido</option>
                  <option value="abandoned">Abandonado</option>
                </select>
              </div>
              <div className="field">
                <label className="label">Página atual</label>
                <input className="form-input" type="number" min="0" value={form.currentPage}
                  onChange={e => setForm(f => ({ ...f, currentPage: e.target.value }))} />
              </div>
            </div>

            {/* Datas */}
            <div className={styles.row2}>
              <div className="field">
                <label className="label">Data de início</label>
                <input className="form-input" type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Data de término</label>
                <input className="form-input" type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {/* Tags */}
            <div className="field">
              <label className="label">Tags (separadas por vírgula)</label>
              <input className="form-input" value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="favorito, emprestado, urgente…" />
              {existingTags && existingTags.length > 0 && (
                <div className={styles.tagSuggestions}>
                  {existingTags.map(tag => {
                    const active = getTagArray(form.tags).includes(tag);
                    return (
                      <button key={tag} type="button"
                        className={`${styles.tagChip} ${active ? styles.tagChipActive : ''}`}
                        onClick={() => setForm(f => ({ ...f, tags: toggleTag(f.tags, tag) }))}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Páginas adicionais + Número da primeira página */}
            <div className={styles.row2}>
              <div className="field">
                <label className="label">Páginas adicionais <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
                <input className="form-input" type="number" min="0"
                  value={form.pagesAdditional}
                  onChange={e => setForm(f => ({ ...f, pagesAdditional: e.target.value }))}
                  placeholder="0" />
                <p className={styles.fieldHint}>Páginas sem numeração (prefácio, índice…) que devem contar no total.</p>
              </div>
              <div className="field">
                <label className="label">Número da primeira página</label>
                <input className="form-input" type="number" min="1"
                  value={form.firstPageNum}
                  onChange={e => setForm(f => ({ ...f, firstPageNum: e.target.value }))}
                  placeholder="1" />
                <p className={styles.fieldHint}>Se o livro começa na pg. 3, preencha 3. Padrão: 1.</p>
              </div>
            </div>

            {/* ISBN */}
            <div className="field">
              <label className="label">ISBN <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
              <input className="form-input" value={form.isbn}
                onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))}
                placeholder="978..." />
            </div>

            {/* Formato + Local */}
            <div className="field">
              <label className="label">Formato <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
              <div className={styles.formatToggle}>
                {(['physical', 'digital'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    className={`${styles.formatBtn} ${form.format === f ? styles.formatBtnActive : ''}`}
                    onClick={() => setForm(fm => ({ ...fm, format: fm.format === f ? '' : f }))}
                  >
                    {f === 'physical' ? '📖 Físico' : '📱 Digital'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">Onde encontrar / plataforma <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
              <input className="form-input" value={form.store}
                onChange={e => setForm(f => ({ ...f, store: e.target.value }))}
                placeholder="Ex: Livraria Travessa, Amazon, Biblioteca..." />
              {existingStores && existingStores.length > 0 && (
                <div className={styles.tagSuggestions}>
                  {existingStores.map(store => (
                    <button
                      key={store}
                      type="button"
                      className={`${styles.tagChip} ${form.store === store ? styles.tagChipActive : ''}`}
                      onClick={() => setForm(f => ({ ...f, store: f.store === store ? '' : store }))}
                    >{store}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label className="label">Idioma <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
              <input className="form-input" value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                placeholder="Ex: Português, English, Español..." />
              {existingLanguages && existingLanguages.length > 0 && (
                <div className={styles.tagSuggestions}>
                  {existingLanguages.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      className={`${styles.tagChip} ${form.language === lang ? styles.tagChipActive : ''}`}
                      onClick={() => setForm(f => ({ ...f, language: f.language === lang ? '' : lang }))}
                    >{lang}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Trecho marcante */}
            <div className="field">
              <label className="label">Trecho marcante <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
              <textarea
                className="form-input"
                rows={3}
                value={form.quote}
                onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
                placeholder="Uma frase ou passagem que te marcou neste livro…"
                style={{ resize: 'vertical' }}
              />
            </div>

          </form>
        </div>

        {/* Footer — fora do scroll, sempre visível no celular */}
        <div className={styles.footer}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="edit-book-form" className="btn-primary">Salvar alterações</button>
        </div>
      </div>
    </div>
  );
}
