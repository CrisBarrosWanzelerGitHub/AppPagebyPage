import { useState, useRef, useEffect, useId } from 'react';
import styles from './GenreCombobox.module.css';

const PREDEFINED = [
  'Acadêmico',
  'Antropologia',
  'Arquitetura',
  'Arte',
  'Autoajuda',
  'Autobiografia',
  'Aventura',
  'Biografia',
  'Chick-lit',
  'Clássicos',
  'Conto',
  'Crônica',
  'Desenvolvimento pessoal',
  'Design',
  'Didático',
  'Distopia',
  'Divulgação científica',
  'Economia',
  'Ensaio',
  'Erótico',
  'Esoterismo',
  'Espiritualidade',
  'Esportes',
  'Fantasia',
  'Ficção',
  'Ficção científica',
  'Filosofia',
  'Finanças',
  'Fotografia',
  'Gastronomia',
  'Graphic novel',
  'História',
  'HQ / Gibi',
  'Humor',
  'Infantil',
  'Jornalismo literário',
  'Mangá',
  'Memórias',
  'Mistério',
  'Moda',
  'Negócios',
  'Poesia',
  'Policial',
  'Política',
  'Psicologia / Psicanálise',
  'Realismo mágico',
  'Religião',
  'Romance',
  'Saúde e bem-estar',
  'Sociologia',
  'Suspense',
  'Teatro / Dramaturgia',
  'Terror',
  'Técnico',
  'Thriller',
  'True Crime',
  'Viagem',
  'Young Adult (YA)',
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  extraOptions?: string[];
}

export default function GenreCombobox({ value, onChange, extraOptions = [] }: Props) {
  const [query, setQuery]   = useState(value);
  const [open, setOpen]     = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);
  const inputId  = useId();

  // Keep query in sync when value is set externally (e.g. selecting a book result)
  useEffect(() => { setQuery(value); }, [value]);

  // Predefined (já ordenada) + gêneros extras da biblioteca não incluídos na lista
  const extras = extraOptions.filter(g => g && !PREDEFINED.includes(g)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const allOptions = [...PREDEFINED, ...extras];

  const filtered = query.trim()
    ? allOptions.filter(g => g.toLowerCase().includes(query.trim().toLowerCase()))
    : allOptions;

  // Scroll active item into view
  useEffect(() => {
    if (active >= 0 && listRef.current) {
      const item = listRef.current.children[active] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  // Close on outside click / blur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commitOrRevert();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

  function commitOrRevert() {
    if (query.trim() === '') {
      onChange('');
      return;
    }
    // Exact match (case-insensitive) → commit
    const match = allOptions.find(g => g.toLowerCase() === query.trim().toLowerCase());
    if (match) {
      onChange(match);
      setQuery(match);
    } else {
      // Revert to last confirmed value
      setQuery(value);
    }
  }

  function select(genre: string) {
    onChange(genre);
    setQuery(genre);
    setOpen(false);
    setActive(-1);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        setActive(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setActive(i => Math.min(i + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActive(i => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (active >= 0 && filtered[active]) select(filtered[active]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setQuery(value);
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <input
        id={inputId}
        className={`form-input ${styles.input}`}
        value={query}
        placeholder="Selecione ou filtre digitando…"
        autoComplete="off"
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />
      {value && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => { onChange(''); setQuery(''); setOpen(false); }}
          tabIndex={-1}
          aria-label="Limpar gênero"
        >×</button>
      )}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className={styles.dropdown}
          role="listbox"
        >
          {filtered.map((g, i) => (
            <li
              key={g}
              role="option"
              aria-selected={g === value}
              className={`${styles.option} ${g === value ? styles.optionSelected : ''} ${i === active ? styles.optionActive : ''}`}
              onMouseDown={e => { e.preventDefault(); select(g); }}
              onMouseEnter={() => setActive(i)}
            >
              {g}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
