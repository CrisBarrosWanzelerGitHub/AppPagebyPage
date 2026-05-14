import { useState, useMemo, useRef, useEffect } from 'react';
import type { LibraryPlace } from '../types';
import styles from './Libraries.module.css';

interface Props {
  libraries: LibraryPlace[];
  addLibrary:    (lib: LibraryPlace) => void;
  updateLibrary: (lib: LibraryPlace) => void;
  deleteLibrary: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'delete', opts?: { undo?: () => void }) => void;
  [key: string]: unknown;
}

const EMPTY_FORM = { name: '', url: '', address: '', note: '', tags: [] as string[] };


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

export default function Libraries({ libraries, addLibrary, updateLibrary, deleteLibrary, showToast }: Props) {
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<LibraryPlace | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [tagInput, setTagInput]   = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  // Rola o formulário para o campo de visão quando abre (celular)
  useEffect(() => {
    if (showForm && formCardRef.current) {
      setTimeout(() => {
        formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  }, [showForm]);

  // Todas as tags usadas nas bibliotecas salvas
  const allTags = useMemo(() => {
    const set = new Set<string>();
    libraries.forEach(l => l.tags?.forEach(t => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [libraries]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTagInput('');
    setShowForm(true);
  }

  function openEdit(lib: LibraryPlace) {
    setEditing(lib);
    setForm({ name: lib.name, url: lib.url ?? '', address: lib.address ?? '', note: lib.note ?? '', tags: lib.tags ?? [] });
    setTagInput('');
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setTagInput('');
  }

  // Adiciona tag via Enter ou vírgula
  function commitTagInput() {
    const raw = tagInput.replace(/^#/, '').trim().toLowerCase();
    if (!raw) return;
    if (!form.tags.includes(raw)) {
      setForm(f => ({ ...f, tags: [...f.tags, raw] }));
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  }

  function toggleSuggestion(tag: string) {
    if (form.tags.includes(tag)) {
      removeTag(tag);
    } else {
      setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    }
  }

  function handleSave() {
    const name = form.name.trim();
    if (!name) return;
    // Commita qualquer digitação pendente no campo de tag
    const pendingTag = tagInput.replace(/^#/, '').trim().toLowerCase();
    const tags = pendingTag && !form.tags.includes(pendingTag)
      ? [...form.tags, pendingTag]
      : form.tags;

    const lib: LibraryPlace = {
      ...(editing ?? { id: crypto.randomUUID() }),
      name,
      url:     form.url.trim()     || undefined,
      address: form.address.trim() || undefined,
      note:    form.note.trim()    || undefined,
      tags:    tags.length > 0 ? tags : undefined,
    };

    if (editing) {
      updateLibrary(lib);
      showToast('Biblioteca atualizada!');
    } else {
      addLibrary(lib);
      showToast('Biblioteca adicionada!');
    }
    cancel();
  }

  function handleDelete(id: string) {
    const lib = libraries.find(l => l.id === id);
    deleteLibrary(id);
    setConfirmDelete(null);
    showToast('Biblioteca removida.', 'delete', {
      undo: lib ? () => addLibrary(lib) : undefined,
    });
  }

  const sorted = [...libraries]
    .filter(l => !filterTag || l.tags?.includes(filterTag))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  return (
    <div className={styles.root}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.heading}>Bibliotecas e plataformas</h2>
          <p className={styles.sub}>Locais prediletos para encontrar livros.</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Adicionar</button>
      </div>

      {/* ─── Tag filter ─────────────────────────────────────────────── */}
      {allTags.length > 0 && (
        <div className={styles.tagFilterRow}>
          <button
            className={`${styles.tagFilterChip} ${filterTag === null ? styles.tagFilterChipActive : ''}`}
            onClick={() => setFilterTag(null)}
            title="Todas as tags"
          >
            <ClearFilterIcon />
          </button>
          {allTags.map(t => (
            <button
              key={t}
              className={`${styles.tagFilterChip} ${filterTag === t ? styles.tagFilterChipActive : ''}`}
              onClick={() => setFilterTag(filterTag === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* ─── Form ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className={`card ${styles.formCard}`} ref={formCardRef}>
          <h3 className={styles.formTitle}>{editing ? 'Editar' : 'Nova biblioteca'}</h3>

          <div className="field">
            <label className="label">Nome *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: MEC Livros, Biblioteca Municipal…" />
          </div>

          <div className="field">
            <label className="label">URL</label>
            <input className="form-input" type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" />
          </div>

          <div className="field">
            <label className="label">Endereço <span className={styles.optional}>(opcional)</span></label>
            <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, cidade…" />
          </div>

          <div className="field">
            <label className="label">Nota <span className={styles.optional}>(opcional)</span></label>
            <textarea
              className={`form-input ${styles.noteArea}`}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder={'Ex: Prazo de 14 dias renováveis uma única vez.\nRequer cadastro no site.\nRetira pessoalmente na biblioteca municipal.'}
              rows={3}
            />
          </div>

          {/* ── Tags ── */}
          <div className="field">
            <label className="label">Tags <span className={styles.optional}>(opcional)</span></label>

            {/* Chips das tags já adicionadas */}
            {form.tags.length > 0 && (
              <div className={styles.tagChipRow}>
                {form.tags.map(t => (
                  <span key={t} className={styles.tagChip}>
                    #{t}
                    <button className={styles.tagChipRemove} onClick={() => removeTag(t)} aria-label={`Remover tag ${t}`}>×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Input para digitar nova tag */}
            <input
              className="form-input"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTagInput(); }
                if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
                  removeTag(form.tags[form.tags.length - 1]);
                }
              }}
              onBlur={commitTagInput}
              placeholder="Digite e pressione Enter para adicionar…"
            />

            {/* Sugestões das tags já existentes nas outras bibliotecas */}
            {allTags.filter(t => !form.tags.includes(t)).length > 0 && (
              <div className={styles.tagSuggestions}>
                {allTags.filter(t => !form.tags.includes(t)).map(t => (
                  <button
                    key={t}
                    type="button"
                    className={styles.tagSuggestionChip}
                    onClick={() => toggleSuggestion(t)}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button className="btn-secondary" onMouseDown={e => e.preventDefault()} onClick={cancel}>Cancelar</button>
            <button className="btn-primary" onMouseDown={e => e.preventDefault()} onClick={handleSave} disabled={!form.name.trim()}>
              {editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {/* ─── List ───────────────────────────────────────────────────── */}
      {sorted.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon">◫</div>
          <p>
            {filterTag
              ? `Nenhuma biblioteca com a tag #${filterTag}.`
              : 'Nenhuma biblioteca salva ainda.\nAdicione locais onde você encontra livros.'}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {sorted.map(lib => (
            <div key={lib.id} className={`card ${styles.item}`}>
              <div className={styles.itemMain}>
                <div className={styles.itemName}>
                  {lib.url ? (
                    <a href={lib.url} target="_blank" rel="noopener noreferrer" className={styles.itemLink}>
                      {lib.name}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  ) : (
                    <span>{lib.name}</span>
                  )}
                </div>
                {lib.address && <p className={styles.itemMeta}>📍 {lib.address}</p>}
                {lib.note    && <p className={styles.itemNote}>{lib.note}</p>}
                {lib.tags && lib.tags.length > 0 && (
                  <div className={styles.itemTags}>
                    {lib.tags.map(t => (
                      <span key={t} className={styles.itemTag}>#{t}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.itemActions}>
                <button className="btn-icon" title="Editar" onClick={() => openEdit(lib)}>✎</button>
                {confirmDelete === lib.id ? (
                  <>
                    <button className="btn-icon danger" title="Confirmar exclusão" onClick={() => handleDelete(lib.id)}>✓</button>
                    <button className="btn-icon" title="Cancelar" onClick={() => setConfirmDelete(null)}>✕</button>
                  </>
                ) : (
                  <button className="btn-icon danger" title="Remover" onClick={() => setConfirmDelete(lib.id)}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
