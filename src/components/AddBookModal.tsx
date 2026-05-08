import { useState, useMemo } from 'react';
import type { Book } from '../types';
import styles from './Modal.module.css';
import BarcodeScanner from './BarcodeScanner';
import GenreCombobox from './GenreCombobox';

interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    categories?: string[];
    pageCount?: number;
    publishedDate?: string;
    language?: string;
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

/** Extrai ASIN/ISBN-10 de uma URL da Amazon (ex.: /dp/6555520809) */
function extractAmazonASIN(input: string): string | null {
  const match = input.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
}

/** Normaliza título/autor para deduplicação (remove acentos, pontuação, caixa) */
function normalizeKey(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chave de autor tolerante a transliterações diferentes.
 * "Dostoevsky", "Dostoiévski", "Dostoievski", "Dostoévski" → todos viram "dostof".
 * Usa os primeiros 5 chars do sobrenome + inicial do primeiro nome.
 */
function normalizeAuthorKey(author: string): string {
  const norm = normalizeKey(author);
  const words = norm.split(' ').filter(Boolean);
  if (!words.length) return '';
  const surname    = words[words.length - 1].slice(0, 5);
  const firstInit  = words.length > 1 ? (words[0][0] ?? '') : '';
  return surname + firstInit;
}

/** Stop words PT — excluídas do cálculo de relevância */
const PT_STOP = new Set(['e','a','o','as','os','de','da','do','das','dos','em','no','na','por','para','com','um','uma','que','se','ao','pela','pelo','num','uma']);

/**
 * Score de relevância de um resultado em relação à query original.
 * Resultado mais próximo do título exato = score mais alto.
 */
function scoreBook(book: GoogleBook, rawQuery: string): number {
  const qNorm  = normalizeKey(rawQuery);
  const qWords = qNorm.split(' ').filter(w => w.length > 1 && !PT_STOP.has(w));
  const tNorm  = normalizeKey(book.volumeInfo.title || '');
  const tWords = tNorm.split(' ').filter(Boolean);

  let score = 0;
  if (tNorm === qNorm)                                            score += 100; // correspondência exata
  else if (tNorm.startsWith(qNorm))                               score += 70;  // título começa com a query
  else if (qWords.length && qWords.every(w => tWords.includes(w))) score += 50;  // todas as palavras presentes
  else if (qWords.length) {
    const hits = qWords.filter(w => tWords.includes(w)).length;
    score += Math.round((hits / qWords.length) * 25);
  }

  // Bônus por dados completos (desempate)
  if (book.volumeInfo.imageLinks) score += 3;
  if (book.volumeInfo.pageCount)  score += 2;
  if (book.volumeInfo.description) score += 1;
  return score;
}

/**
 * Busca edições em português de uma obra no Open Library.
 * Retorna o livro enriquecido com o ISBN da edição brasileira (para capa Amazon correta).
 * Totalmente gratuito — Open Library não tem limites nem chave de API.
 */
async function enrichWithPortugueseEdition(book: GoogleBook): Promise<GoogleBook> {
  // Só resultados do OL têm ID no formato /works/OL…
  if (!book.id.startsWith('/works/')) return book;
  try {
    const res = await fetch(
      `https://openlibrary.org${book.id}/editions.json?limit=50&fields=isbn_13,isbn_10,languages,number_of_pages,publish_date`,
    );
    if (!res.ok) return book;
    const data = await res.json() as { entries?: Record<string, unknown>[] };
    const editions = data.entries ?? [];

    // Filtra só edições em português (código OL: /languages/por)
    const porEditions = editions.filter(ed => {
      const langs = (ed.languages as Array<{ key: string }> | undefined) ?? [];
      return langs.some(l => l.key === '/languages/por');
    });
    if (!porEditions.length) return book;

    // Edição mais recente primeiro (maior chance de ser a atual das livrarias)
    porEditions.sort((a, b) => {
      const ya = parseInt(String(a.publish_date ?? '0').replace(/\D/g, '').slice(-4)) || 0;
      const yb = parseInt(String(b.publish_date ?? '0').replace(/\D/g, '').slice(-4)) || 0;
      return yb - ya;
    });

    const best    = porEditions[0];
    const isbn13s = (best.isbn_13 as string[] | undefined) ?? [];
    const isbn10s = (best.isbn_10 as string[] | undefined) ?? [];
    const isbn13  = isbn13s[0];
    const isbn10  = isbn10s[0] ?? (isbn13 ? (isbn13ToIsbn10(isbn13) ?? '') : '');

    if (!isbn13 && !isbn10) return book;

    // Coloca o ISBN português na frente dos identificadores (Amazon cover priority)
    const otherIds = (book.volumeInfo.industryIdentifiers ?? []).filter(
      id => id.identifier !== isbn13 && id.identifier !== isbn10,
    );
    const newIds = [
      ...(isbn13 ? [{ type: 'ISBN_13', identifier: isbn13 }] : []),
      ...(isbn10 ? [{ type: 'ISBN_10', identifier: isbn10 }] : []),
      ...otherIds,
    ];

    return {
      ...book,
      volumeInfo: {
        ...book.volumeInfo,
        pageCount: (best.number_of_pages as number | undefined) || book.volumeInfo.pageCount,
        industryIdentifiers: newIds,
      },
    };
  } catch {
    return book; // falha silenciosa — mantém o resultado original
  }
}

/**
 * Mescla entradas duplicadas (mesmo título + autor), combinando o melhor de cada fonte.
 * A ordem de entrada importa: a primeira entrada define idioma/edição base (OL chega primeiro).
 * Entradas subsequentes complementam com dados que a primeira não tem (ex: descrição do Google).
 */
function deduplicateBooks(books: GoogleBook[]): GoogleBook[] {
  const seen = new Map<string, GoogleBook>();
  for (const book of books) {
    const v = book.volumeInfo;
    const key = normalizeKey(v.title || '') + '|' + normalizeAuthorKey((v.authors || [])[0] || '');
    if (!seen.has(key)) {
      seen.set(key, book);
    } else {
      // Mescla: OL (já armazenado) mantém idioma/edição; Google complementa descrição e dados extras
      const existing = seen.get(key)!;
      const ev = existing.volumeInfo;
      seen.set(key, {
        ...existing,
        volumeInfo: {
          ...ev,
          // Páginas: prefere OL (mediana de edições) mas aceita Google se OL não tiver
          pageCount: ev.pageCount ?? v.pageCount,
          // Descrição: OL raramente tem, Google quase sempre tem
          description: ev.description || v.description,
          // Capa: mantém a já existente, complementa se não tiver
          imageLinks: ev.imageLinks ?? v.imageLinks,
          // Idioma: OL é mais confiável — mantém se já tiver
          language: ev.language || v.language,
          // Gênero: OL subject > Google categories
          categories: (ev.categories?.length ? ev.categories : null) ?? (v.categories ?? []),
          // Data de publicação
          publishedDate: ev.publishedDate || v.publishedDate,
          // ISBNs: une os dois conjuntos sem repetir
          industryIdentifiers: [
            ...(ev.industryIdentifiers ?? []),
            ...(v.industryIdentifiers ?? []).filter(id =>
              !(ev.industryIdentifiers ?? []).some(eid => eid.identifier === id.identifier)
            ),
          ],
        },
      });
    }
  }
  return Array.from(seen.values());
}

/** Converte ISBN-13 (prefixo 978) em ISBN-10 para montar URL da Amazon */
function isbn13ToIsbn10(isbn13: string): string | null {
  if (!/^978\d{10}$/.test(isbn13)) return null;
  const core = isbn13.slice(3, 12);
  const sum = core.split('').reduce((acc, d, i) => acc + parseInt(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

const LANGUAGE_NAMES: Record<string, string> = {
  // ISO 639-1 (2 letras — Google Books)
  pt: 'Português', en: 'Inglês',   es: 'Espanhol',
  fr: 'Francês',   de: 'Alemão',   it: 'Italiano',
  ja: 'Japonês',   ko: 'Coreano',  zh: 'Chinês',
  ar: 'Árabe',     ru: 'Russo',    nl: 'Holandês',
  // ISO 639-2 / MARC (3 letras — Open Library)
  por: 'Português', eng: 'Inglês',  spa: 'Espanhol',
  fre: 'Francês',   ger: 'Alemão',  ita: 'Italiano',
  jpn: 'Japonês',   kor: 'Coreano', chi: 'Chinês',
  ara: 'Árabe',     rus: 'Russo',   dut: 'Holandês',
};
function resolveLanguage(code: string): string {
  if (!code) return '';
  const lower = code.toLowerCase().trim();
  // Tenta código exato ('pt'), depois base sem região ('pt' de 'pt-BR')
  return LANGUAGE_NAMES[lower] || LANGUAGE_NAMES[lower.split('-')[0]] || code;
}

interface Props {
  onClose: () => void;
  onAdd: (book: Book) => void;
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

const emptyForm = {
  title: '',
  author: '',
  genre: '',
  pages: '',
  cover: '',
  coverFallback: '', // segunda opção de capa
  description: '',
  status: 'want' as Book['status'],
  tags: '',
  startDate: '',
  endDate: '',
  pagesAdditional: '',
  firstPageNum: '',
  isbn: '',
  format: '' as '' | 'physical' | 'digital',
  store: '',
  language: '',
  quote: '',
};

export default function AddBookModal({ onClose, onAdd, existingTags, existingStores, existingGenres, existingLanguages }: Props) {
  const [query, setQuery] = useState('');
  const [isbn, setIsbn] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [failedCovers, setFailedCovers] = useState<Set<string>>(new Set());
  const [fromSearch, setFromSearch] = useState(false);
  const [formCoverFailed, setFormCoverFailed] = useState(false);

  // Verifica suporte a câmera + BarcodeDetector (mostra botão só se disponível)
  const canScan = useMemo(() =>
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'BarcodeDetector' in window,
  []);

  // ── Open Library ─────────────────────────────────────────────────────────
  async function searchOpenLibrary(q: string): Promise<GoogleBook[]> {
    const base = 'https://openlibrary.org/search.json';
    // isbn incluso para montar capa quando cover_i não estiver disponível; subject para gênero
    const fields = 'key,title,author_name,number_of_pages_median,cover_i,isbn,language,first_publish_year,first_sentence,subject';
    try {
      // title= é muito mais preciso que q= para buscas por título
      // A busca por q= com language=por complementa com edições em português
      const [resTitle, resPt] = await Promise.all([
        fetch(`${base}?title=${q}&limit=10&fields=${fields}`),
        fetch(`${base}?q=${q}&language=por&limit=6&fields=${fields}`),
      ]);
      const [dataTitle, dataPt] = await Promise.all([resTitle.json(), resPt.json()]);

      const toBook = (doc: Record<string, unknown>): GoogleBook => {
        const fs = doc.first_sentence;
        const description = typeof fs === 'string' ? fs
          : fs && typeof fs === 'object' && 'value' in (fs as object) ? String((fs as Record<string,unknown>).value)
          : undefined;
        // Capa: preferência cover_i (Open Library ID), fallback ISBN
        const isbns = (doc.isbn as string[]) ?? [];
        const isbn13ol = isbns.find(s => /^97[89]\d{10}$/.test(s));
        const isbn10ol = isbns.find(s => /^\d{9}[\dX]$/i.test(s));
        let thumbnail: string | undefined;
        if (doc.cover_i) thumbnail = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        else if (isbn13ol) thumbnail = `https://covers.openlibrary.org/b/isbn/${isbn13ol}-L.jpg`;
        else if (isbn10ol) thumbnail = `https://covers.openlibrary.org/b/isbn/${isbn10ol}-L.jpg`;

        // Gênero: pega o primeiro subject do OL que pareça com um gênero literário real
        const subjects = (doc.subject as string[]) ?? [];
        const olGenre = subjects.find(s =>
          s.length > 3 && s.length < 50 &&
          !/^(fiction|nonfiction|protected daisy|juvenile|accessible book|internet archive|open library|in library|overdrive|general|literature|books|large type|e-books|online)/i.test(s) &&
          !/^\d/.test(s) // ignora subjects que começam com número
        );

        return {
          id: String(doc.key ?? Math.random()),
          volumeInfo: {
            title: String(doc.title ?? ''),
            authors: (doc.author_name as string[]) ?? [],
            pageCount: (doc.number_of_pages_median as number) || undefined,
            language: ((doc.language as string[]) ?? [])[0],
            publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
            description,
            imageLinks: thumbnail ? { thumbnail } : undefined,
            categories: olGenre ? [olGenre] : [],
            industryIdentifiers: [
              ...(isbn13ol ? [{ type: 'ISBN_13', identifier: isbn13ol }] : []),
              ...(isbn10ol ? [{ type: 'ISBN_10', identifier: isbn10ol }] : []),
            ],
          },
        };
      };

      // title= primeiro (maior precisão); q=por complementa com edições em português
      const titleItems = ((dataTitle.docs as Record<string, unknown>[]) ?? []).map(toBook);
      const ptItems    = ((dataPt.docs   as Record<string, unknown>[]) ?? []).map(toBook);
      const titleIds = new Set(titleItems.map(b => b.id));
      return [...titleItems, ...ptItems.filter(b => !titleIds.has(b.id))];
    } catch {
      return [];
    }
  }

  // ── Google Books ──────────────────────────────────────────────────────────
  async function tryGoogleBooks(q: string, type: 'query' | 'isbn', key: string): Promise<GoogleBook[] | null> {
    const BOOKS = 'https://www.googleapis.com/books/v1/volumes';
    const keyParam = key ? `&key=${key}` : '';
    try {
      if (type === 'isbn') {
        const res = await fetch(`${BOOKS}?q=isbn:${encodeURIComponent(q)}&maxResults=5${keyParam}`);
        const data = await res.json();
        if (data.error) return null;
        return data.items || [];
      } else {
        const enc = encodeURIComponent(`intitle:${q}`);
        const [resPt, resAll] = await Promise.all([
          fetch(`${BOOKS}?q=${enc}&langRestrict=pt&maxResults=6&orderBy=relevance${keyParam}`),
          fetch(`${BOOKS}?q=${enc}&maxResults=8&orderBy=relevance${keyParam}`),
        ]);
        const [dataPt, dataAll] = await Promise.all([resPt.json(), resAll.json()]);
        if (dataPt.error && dataAll.error) return null;
        const ptItems: GoogleBook[] = (!dataPt.error && dataPt.items) || [];
        const allItems: GoogleBook[] = (!dataAll.error && dataAll.items) || [];
        const seenIds = new Set<string>(ptItems.map(b => b.id));
        return [...ptItems, ...allItems.filter(b => !seenIds.has(b.id))];
      }
    } catch {
      return null;
    }
  }

  async function search(type: 'query' | 'isbn', directQuery?: string) {
    let rawQ = directQuery ?? (type === 'isbn' ? isbn.trim() : query.trim());
    if (!rawQ) return;

    // Detecta URL da Amazon e extrai ASIN automaticamente
    const asin = extractAmazonASIN(rawQ);
    let q = asin ?? rawQ;
    let searchType: 'query' | 'isbn' = asin ? 'isbn' : type;

    setLoading(true);
    setSearchError('');
    setFailedCovers(new Set());
    try {
      if (searchType === 'isbn') {
        // ISBN / ASIN: Google Books é mais preciso
        let items = await tryGoogleBooks(q, 'isbn', '');
        // Se não achou por ISBN, tenta Open Library pelo mesmo código
        if (!items || items.length === 0) {
          const olResults = await searchOpenLibrary(encodeURIComponent(q));
          items = olResults.length > 0 ? olResults : (items ?? []);
        }
        const results = items ?? [];
        setResults(results);
        if (results.length === 0) setSearchError('Nenhum resultado encontrado.');
        return;
      }

      // Busca por texto: Google Books + Open Library em paralelo
      const [googleItems, olItems] = await Promise.all([
        tryGoogleBooks(q, 'query', ''),
        searchOpenLibrary(encodeURIComponent(q)),
      ]);

      // OL primeiro (melhor idioma); após mesclar, ordena por relevância em relação à query.
      const merged = deduplicateBooks([
        ...olItems,
        ...(googleItems || []),
      ])
        .map(book => ({ book, score: scoreBook(book, rawQ) }))
        .sort((a, b) => b.score - a.score)
        .map(({ book }) => book)
        .slice(0, 10);

      if (merged.length === 0) { setSearchError('Nenhum resultado encontrado.'); return; }

      // Enriquece os top 5 com ISBN da edição portuguesa (Open Library Editions API — gratuito).
      // Roda em paralelo; falhas silenciosas mantêm o resultado original.
      const [toEnrich, rest] = [merged.slice(0, 5), merged.slice(5)];
      const enriched = await Promise.all(toEnrich.map(enrichWithPortugueseEdition));
      setResults([...enriched, ...rest]);
    } catch {
      setSearchError('Erro ao buscar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }

  function selectResult(item: GoogleBook) {
    const { volumeInfo: v } = item;
    const googleCover = v.imageLinks?.thumbnail?.replace('http://', 'https://') ?? '';
    const isbn13 = v.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier ?? '';
    const isbn10 = v.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier
      || (isbn13 ? isbn13ToIsbn10(isbn13) : null)
      || '';
    const isbn = isbn13 || isbn10;

    // Capa Open Library como terceiro fallback (ISBN-13 preferido, depois ISBN-10)
    const olCover = isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`
      : isbn10 ? `https://covers.openlibrary.org/b/isbn/${isbn10}-L.jpg`
      : '';

    // Prioridade: Google Books > Amazon > Open Library
    // Google Books é garantido (URL vem da API); Amazon pode falhar se ISBN não estiver indexado
    const amazonCover = isbn10 ? `https://m.media-amazon.com/images/P/${isbn10}.01._SL500_.jpg` : '';
    const cover         = googleCover || amazonCover || olCover;
    const coverFallback = googleCover ? (amazonCover || olCover) : (amazonCover ? olCover : '');

    setForm({
      title: v.title || '',
      author: (v.authors || []).join(', '),
      genre: (v.categories || [])[0] || '',
      pages: String(v.pageCount || ''),
      cover,
      coverFallback,
      description: v.description ? stripHtml(v.description) : '',
      status: 'want',
      tags: '',
      startDate: '',
      endDate: '',
      pagesAdditional: '',
      firstPageNum: '',
      isbn,
      format: '',
      store: '',
      language: v.language ? resolveLanguage(v.language) : '',
      quote: '',
    });
    setFromSearch(true);
    setFormCoverFailed(false);
    setResults([]);
    setShowForm(true);
  }

  function handleManual() {
    setFromSearch(false);
    setForm({ ...emptyForm, title: query.trim() });
    setResults([]);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const pagesAdditional = parseInt(form.pagesAdditional) || 0;
    const firstPage = form.firstPageNum !== '' ? (parseInt(form.firstPageNum) || 1) : 1;
    // startPage é o "page 0 virtual": log na pg X → pages = X - sp
    // ex: firstPage=3, pagesAdditional=10 → sp=-8 → log na pg4 = 4-(-8) = 12 ✓
    const sp = (firstPage - 1) - pagesAdditional;
    const book: Book = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      author: form.author.trim(),
      genre: form.genre.trim(),
      pages: parseInt(form.pages) || 0,
      cover: form.cover.trim(),
      status: 'want',
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      currentPage: 0,
      startPage: sp !== 0 ? sp : undefined,
      firstPageNum: firstPage !== 1 ? firstPage : undefined,
      isbn:     form.isbn.trim()      || undefined,
      format:   form.format           || undefined,
      store:    form.store.trim()     || undefined,
      language: form.language.trim()  || undefined,
      quote:    form.quote.trim()     || undefined,
    };
    onAdd(book);
  }

  function handleBarcodeDetected(code: string) {
    setIsbn(code);
    setShowScanner(false);
    search('isbn', code);
  }

  return (
    <>
    {showScanner && (
      <BarcodeScanner
        onDetected={handleBarcodeDetected}
        onClose={() => setShowScanner(false)}
      />
    )}
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Adicionar livro</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className={styles.body}>
          {!showForm ? (
            <>
              {/* Search Section */}
              <div className={styles.searchSection}>
                <div className="field">
                  <label className="label">Buscar por título ou autor</label>
                  <div className={styles.searchRow}>
                    <input
                      className="form-input"
                      placeholder="Ex: Crime e Castigo"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && search('query')}
                    />
                    <button
                      className="btn-primary"
                      onClick={() => search('query')}
                      disabled={loading || !query.trim()}
                    >
                      {loading ? '...' : 'Buscar'}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label className="label">Buscar por ISBN</label>
                  <div className={styles.searchRow}>
                    <input
                      className="form-input"
                      placeholder="Ex: 9788533613379"
                      value={isbn}
                      onChange={e => setIsbn(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && search('isbn')}
                    />
                    {canScan && (
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => setShowScanner(true)}
                        title="Escanear código de barras"
                        style={{ flexShrink: 0, padding: '0 0.75rem' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                      </button>
                    )}
                    <button
                      className="btn-primary"
                      onClick={() => search('isbn')}
                      disabled={loading || !isbn.trim()}
                    >
                      {loading ? '...' : 'Buscar'}
                    </button>
                  </div>
                </div>

                {searchError && <p className={styles.searchError}>{searchError}</p>}

                {results.length > 0 && (
                  <div className={styles.results}>
                    {results.map(item => {
                      const v = item.volumeInfo;
                      // Cadeia de fallback: Amazon → Google Books → Open Library
                      // Cada fonte é tentada em sequência se a anterior retornar 404
                      const isbn13r = v.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier;
                      const isbn10r = v.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier
                        ?? (isbn13r ? isbn13ToIsbn10(isbn13r) ?? undefined : undefined);
                      const coverSources = [
                        v.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
                        v.imageLinks?.smallThumbnail?.replace('http://', 'https://') || null,
                        isbn10r ? `https://m.media-amazon.com/images/P/${isbn10r}.01._SL500_.jpg` : null,
                        isbn13r ? `https://covers.openlibrary.org/b/isbn/${isbn13r}-M.jpg` : null,
                        isbn10r ? `https://covers.openlibrary.org/b/isbn/${isbn10r}-M.jpg` : null,
                      ].filter(Boolean) as string[];
                      const year = v.publishedDate?.substring(0, 4);
                      const desc = v.description ? stripHtml(v.description) : '';
                      return (
                        <button key={item.id} className={styles.resultItem} onClick={() => selectResult(item)}>
                          {coverSources.length > 0 && !failedCovers.has(item.id) ? (
                            <img
                              src={coverSources[0]}
                              alt=""
                              className={styles.resultCover}
                              data-fi="0"
                              onError={e => {
                                const img = e.target as HTMLImageElement;
                                const next = parseInt(img.dataset.fi ?? '0') + 1;
                                if (next < coverSources.length) {
                                  img.dataset.fi = String(next);
                                  img.src = coverSources[next];
                                } else {
                                  setFailedCovers(prev => new Set([...prev, item.id]));
                                }
                              }}
                            />
                          ) : (
                            <div className={styles.resultCoverPlaceholder}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c5bab2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                              </svg>
                            </div>
                          )}
                          <div className={styles.resultInfo}>
                            <div className={styles.resultTitle}>{v.title}</div>
                            <div className={styles.resultAuthor}>
                              {(v.authors || []).join(', ')}
                              {year && <span className={styles.resultYear}> · {year}</span>}
                            </div>
                            {v.pageCount && (
                              <div className={styles.resultPages}>{v.pageCount} páginas{v.categories?.[0] ? ` · ${v.categories[0]}` : ''}</div>
                            )}
                            {desc && (
                              <div
                                className={styles.resultDescription}
                                onWheel={e => e.stopPropagation()}
                                onClick={e => e.stopPropagation()}
                              >
                                {desc}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.divider}>
                <span>ou</span>
              </div>

              <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleManual}>
                Adicionar manualmente
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Cabeçalho: label + input largura total; abaixo: capa à esq, descrição à dir */}
              <div className="field" style={{ marginBottom: '0.75rem' }}>
                <label className="label">Título *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  style={{ marginBottom: (form.cover || form.description || fromSearch) ? '0.5rem' : 0 }}
                />
                {(form.cover || form.description || fromSearch) && (
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    {form.cover && !formCoverFailed ? (
                      <img
                        src={form.cover}
                        alt="Capa"
                        style={{ width: 72, height: 100, objectFit: 'cover', borderRadius: 5, border: '0.5px solid var(--border)', flexShrink: 0 }}
                        onError={() => {
                          if (form.coverFallback) {
                            setForm(f => ({ ...f, cover: f.coverFallback, coverFallback: '' }));
                          } else {
                            setFormCoverFailed(true);
                          }
                        }}
                      />
                    ) : fromSearch ? (
                      <div style={{ width: 72, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--off-white)', borderRadius: 5, border: '0.5px solid var(--border)', flexShrink: 0 }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c5bab2" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                      </div>
                    ) : null}
                    {form.description && (
                      <div
                        className={styles.resultDescription}
                        style={{ marginTop: 0, maxHeight: '120px', flex: 1 }}
                        onWheel={e => e.stopPropagation()}
                      >
                        {form.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="field">
                <label className="label">Autor</label>
                <input className="form-input" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </div>
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
                  <input className="form-input" type="number" min="1" value={form.pages} onChange={e => setForm(f => ({ ...f, pages: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label className="label">Capa <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(URL da imagem — clique direito em uma imagem → "Copiar endereço")</span></label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={form.cover}
                    onChange={e => setForm(f => ({ ...f, cover: e.target.value }))}
                    placeholder="https://exemplo.com/capa.jpg"
                  />
                  {form.cover && (
                    <img
                      src={form.cover}
                      alt="Capa"
                      style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 4, border: '0.5px solid var(--border)', flexShrink: 0 }}
                      onError={e => {
                        const img = e.target as HTMLImageElement;
                        if (form.coverFallback) {
                          setForm(f => ({ ...f, cover: f.coverFallback, coverFallback: '' }));
                        } else {
                          img.style.display = 'none';
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="field">
                <label className="label">Tags (separadas por vírgula)</label>
                <input className="form-input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="favorito, emprestado, urgente…" />
                {existingTags && existingTags.length > 0 && (
                  <div className={styles.tagSuggestions}>
                    {existingTags.map(tag => {
                      const active = getTagArray(form.tags).includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`${styles.tagChip} ${active ? styles.tagChipActive : ''}`}
                          onClick={() => setForm(f => ({ ...f, tags: toggleTag(f.tags, tag) }))}
                        >{tag}</button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className={styles.row2}>
                <div className="field">
                  <label className="label">Páginas adicionais <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
                  <input className="form-input" type="number" min="0" value={form.pagesAdditional} onChange={e => setForm(f => ({ ...f, pagesAdditional: e.target.value }))} placeholder="0" />
                  <p className={styles.fieldHint}>Páginas sem numeração (prefácio, índice…) que devem contar no total.</p>
                </div>
                <div className="field">
                  <label className="label">Número da primeira página</label>
                  <input className="form-input" type="number" min="1" value={form.firstPageNum} onChange={e => setForm(f => ({ ...f, firstPageNum: e.target.value }))} placeholder="1" />
                  <p className={styles.fieldHint}>Se o livro começa na pg. 3, preencha 3. Padrão: 1.</p>
                </div>
              </div>
              <div className="field">
                <label className="label">ISBN <span style={{ fontWeight: 400, color: 'var(--warm-gray)' }}>(opcional)</span></label>
                <input className="form-input" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} placeholder="978..." />
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
                <input
                  className="form-input"
                  value={form.store}
                  onChange={e => setForm(f => ({ ...f, store: e.target.value }))}
                  placeholder="Ex: Livraria Travessa, Amazon, Biblioteca..."
                />
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
                <input
                  className="form-input"
                  value={form.language}
                  onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  placeholder="Ex: Português, English, Español..."
                />
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

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  ← Voltar
                </button>
                <button type="submit" className="btn-primary">
                  Adicionar livro
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
