import { useState, useMemo } from 'react';
import type { Book } from '../types';
import styles from './Modal.module.css';
import BarcodeScanner from './BarcodeScanner';
import GenreCombobox from './GenreCombobox';

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  // campos internos de scoring
  _source?: 'google' | 'ol';
  _score?: number;
  _editionCount?: number;
  _hasClassicSignal?: boolean;
  _languages?: string[];
  _searchText?: string;
  _displayTitle?: string;
  _displayAuthors?: string[];
}

// ─── Constantes de inteligência literária ────────────────────────────────────
// Portadas do projeto "Busca Livros" (Projetos Codex)

const STOP_WORDS = new Set(['a', 'as', 'o', 'os', 'de', 'da', 'das', 'do', 'dos', 'e', 'em']);

const KNOWN_TITLE_ALIASES: Record<string, string[]> = {
  'annie ernaux': ['annie ernaux os anos', 'annie ernaux o acontecimento', 'annie ernaux paixao simples'],
  'ocean vuong': ['ocean vuong sobre a terra somos belos por um instante', 'ocean vuong time is a mother', 'ocean vuong night sky with exit wounds'],
  'tolstoi': ['war and peace', 'anna karenina', 'the death of ivan ilyich', 'resurrection', 'leo tolstoy'],
  'tolstoy': ['war and peace', 'anna karenina', 'the death of ivan ilyich', 'resurrection', 'leo tolstoy'],
  'lev tolstoi': ['war and peace', 'anna karenina', 'the death of ivan ilyich', 'resurrection', 'leo tolstoy'],
  'leon tolstoi': ['war and peace', 'anna karenina', 'the death of ivan ilyich', 'resurrection', 'leo tolstoy'],
  'victor hugo': ['victor hugo les miserables', 'victor hugo notre dame de paris'],
  'dostoievski': ['crime and punishment', 'the brothers karamazov', 'the idiot', 'notes from underground', 'fyodor dostoevsky'],
  'dostoievsky': ['crime and punishment', 'the brothers karamazov', 'the idiot', 'notes from underground', 'fyodor dostoevsky'],
  'dostoievisky': ['crime and punishment', 'the brothers karamazov', 'the idiot', 'notes from underground', 'fyodor dostoevsky'],
  'dostoevsky': ['crime and punishment', 'the brothers karamazov', 'the idiot', 'notes from underground', 'fyodor dostoevsky'],
  'crime castigo': ['crime and punishment', 'fyodor dostoevsky crime punishment'],
  'pequeno principe': ['the little prince', 'le petit prince', 'antoine de saint exupery little prince'],
  'irmaos karamazov': ['the brothers karamazov', 'fyodor dostoevsky brothers karamazov'],
  'memorias subsolo': ['notes from underground', 'fyodor dostoevsky notes underground'],
  'noites brancas': ['white nights', 'fyodor dostoevsky white nights', 'belye nochi'],
  'idiota': ['the idiot', 'fyodor dostoevsky idiot'],
  'demonios': ['demons', 'the devils', 'the possessed', 'fyodor dostoevsky demons'],
  'jogador': ['the gambler', 'fyodor dostoevsky gambler'],
  'gente pobre': ['poor folk', 'fyodor dostoevsky poor folk'],
  'humilhados ofendidos': ['humiliated and insulted', 'the insulted and injured', 'fyodor dostoevsky humiliated insulted'],
  'os anos': ['les annees', 'les années', 'annie ernaux les années'],
  'paixao simples': ['passion simple', 'annie ernaux passion simple'],
  'acontecimento': ['l evenement', "l'événement", 'annie ernaux evenement'],
  'vergonha': ['la honte', 'annie ernaux la honte'],
  'lugar': ['la place', 'annie ernaux la place'],
  'mulher': ['une femme', 'annie ernaux une femme'],
  'mulher gelada': ['la femme gelee', 'la femme gelée', 'annie ernaux la femme gelee'],
  'memoria menina': ['memoire de fille', 'mémoire de fille', 'annie ernaux mémoire de fille'],
  'jovem': ['le jeune homme', 'annie ernaux le jeune homme'],
  'outra filha': ['l autre fille', "l'autre fille", 'annie ernaux autre fille'],
  'sobre terra somos belos instante': ["on earth we're briefly gorgeous", 'on earth we re briefly gorgeous', 'ocean vuong briefly gorgeous'],
  'terra somos brevemente magnificos': ["on earth we're briefly gorgeous", 'on earth we re briefly gorgeous', 'ocean vuong briefly gorgeous'],
  'tempo mae': ['time is a mother', 'ocean vuong time is a mother'],
  'ceu noturno crivado balas': ['night sky with exit wounds', 'ocean vuong night sky with exit wounds'],
  'ceu noturno feridas saida': ['night sky with exit wounds', 'ocean vuong night sky with exit wounds'],
  'imperador alegria': ['the emperor of gladness', 'ocean vuong emperor gladness'],
  'guerra paz': ['war and peace', 'leo tolstoy war and peace'],
  'anna karenina': ['anna karenina', 'leo tolstoy anna karenina'],
  'morte ivan ilitch': ['the death of ivan ilyich', 'leo tolstoy death ivan ilyich'],
  'ressurreicao': ['resurrection', 'leo tolstoy resurrection'],
  'sonata kreutzer': ['the kreutzer sonata', 'leo tolstoy kreutzer sonata'],
  'confissao': ['a confession', 'leo tolstoy confession'],
  'miseraveis': ['les miserables', 'victor hugo les miserables'],
  'corcunda notre dame': ['the hunchback of notre dame', 'notre dame de paris', 'victor hugo notre dame'],
  'nossa senhora paris': ['notre dame de paris', 'the hunchback of notre dame', 'victor hugo notre dame'],
  'homem ri': ['the man who laughs', 'victor hugo man who laughs'],
  'trabalhadores mar': ['toilers of the sea', 'victor hugo toilers sea'],
  'noventa tres': ['ninety-three', 'quatrevingt-treize', 'victor hugo ninety three'],
  'orgulho preconceito': ['pride and prejudice', 'jane austen pride prejudice'],
  'morro ventos uivantes': ['wuthering heights', 'emily bronte wuthering heights'],
  'grande gatsby': ['the great gatsby', 'f scott fitzgerald great gatsby'],
};

const KNOWN_AUTHOR_SIGNALS: Record<string, string[]> = {
  'tolstoi': ['tolst', 'tolstoy'],
  'tolstoy': ['tolst', 'tolstoy'],
  'lev tolstoi': ['tolst', 'tolstoy'],
  'leon tolstoi': ['tolst', 'tolstoy'],
  'victor hugo': ['victor hugo'],
  'dostoievski': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'dostoievsky': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'dostoievisky': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'dostoevsky': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'crime castigo': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'pequeno principe': ['saint exupery', 'saint exup ry', 'antoine'],
  'irmaos karamazov': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'memorias subsolo': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'noites brancas': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'idiota': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'demonios': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'jogador': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'gente pobre': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'humilhados ofendidos': ['dost', 'dostoevsky', 'dostoyevsky', 'dostoievski', 'dostoievsky', 'fyodor', 'fiodor', 'fedor'],
  'orgulho preconceito': ['jane austen', 'austen'],
  'morro ventos uivantes': ['emily bronte', 'bronte'],
  'grande gatsby': ['fitzgerald'],
};

const KNOWN_DISPLAY_DATA: Record<string, { title: string; authors: string[] }> = {
  'crime castigo': { title: 'Crime e Castigo', authors: ['Fiódor Dostoiévski'] },
  'pequeno principe': { title: 'O Pequeno Príncipe', authors: ['Antoine de Saint-Exupéry'] },
  'irmaos karamazov': { title: 'Os Irmãos Karamázov', authors: ['Fiódor Dostoiévski'] },
  'memorias subsolo': { title: 'Memórias do Subsolo', authors: ['Fiódor Dostoiévski'] },
  'noites brancas': { title: 'Noites Brancas', authors: ['Fiódor Dostoiévski'] },
  'idiota': { title: 'O Idiota', authors: ['Fiódor Dostoiévski'] },
  'demonios': { title: 'Os Demônios', authors: ['Fiódor Dostoiévski'] },
  'jogador': { title: 'O Jogador', authors: ['Fiódor Dostoiévski'] },
  'gente pobre': { title: 'Gente Pobre', authors: ['Fiódor Dostoiévski'] },
  'humilhados ofendidos': { title: 'Humilhados e Ofendidos', authors: ['Fiódor Dostoiévski'] },
  'os anos': { title: 'Os anos', authors: ['Annie Ernaux'] },
  'paixao simples': { title: 'Paixão simples', authors: ['Annie Ernaux'] },
  'acontecimento': { title: 'O acontecimento', authors: ['Annie Ernaux'] },
  'vergonha': { title: 'A vergonha', authors: ['Annie Ernaux'] },
  'lugar': { title: 'O lugar', authors: ['Annie Ernaux'] },
  'mulher': { title: 'Uma mulher', authors: ['Annie Ernaux'] },
  'mulher gelada': { title: 'A mulher gelada', authors: ['Annie Ernaux'] },
  'memoria menina': { title: 'Memória de menina', authors: ['Annie Ernaux'] },
  'jovem': { title: 'O jovem', authors: ['Annie Ernaux'] },
  'outra filha': { title: 'A outra filha', authors: ['Annie Ernaux'] },
  'sobre terra somos belos instante': { title: 'Sobre a terra somos belos por um instante', authors: ['Ocean Vuong'] },
  'terra somos brevemente magnificos': { title: 'Na terra somos brevemente magníficos', authors: ['Ocean Vuong'] },
  'tempo mae': { title: 'O tempo é uma mãe', authors: ['Ocean Vuong'] },
  'ceu noturno crivado balas': { title: 'Céu noturno crivado de balas', authors: ['Ocean Vuong'] },
  'ceu noturno feridas saida': { title: 'Céu noturno com feridas de saída', authors: ['Ocean Vuong'] },
  'imperador alegria': { title: 'O imperador da alegria', authors: ['Ocean Vuong'] },
  'guerra paz': { title: 'Guerra e Paz', authors: ['Liev Tolstói'] },
  'anna karenina': { title: 'Anna Kariênina', authors: ['Liev Tolstói'] },
  'morte ivan ilitch': { title: 'A morte de Ivan Ilitch', authors: ['Liev Tolstói'] },
  'ressurreicao': { title: 'Ressurreição', authors: ['Liev Tolstói'] },
  'sonata kreutzer': { title: 'A sonata a Kreutzer', authors: ['Liev Tolstói'] },
  'confissao': { title: 'Uma confissão', authors: ['Liev Tolstói'] },
  'miseraveis': { title: 'Os miseráveis', authors: ['Victor Hugo'] },
  'corcunda notre dame': { title: 'O corcunda de Notre-Dame', authors: ['Victor Hugo'] },
  'nossa senhora paris': { title: 'Nossa Senhora de Paris', authors: ['Victor Hugo'] },
  'homem ri': { title: 'O homem que ri', authors: ['Victor Hugo'] },
  'trabalhadores mar': { title: 'Os trabalhadores do mar', authors: ['Victor Hugo'] },
  'noventa tres': { title: 'Noventa e três', authors: ['Victor Hugo'] },
  'orgulho preconceito': { title: 'Orgulho e Preconceito', authors: ['Jane Austen'] },
  'morro ventos uivantes': { title: 'O Morro dos Ventos Uivantes', authors: ['Emily Brontë'] },
  'grande gatsby': { title: 'O Grande Gatsby', authors: ['F. Scott Fitzgerald'] },
};

const KNOWN_WORK_TRANSLATIONS: Record<string, { title: string; authors: string[] }> = {
  'passion simple': { title: 'Paixão simples', authors: ['Annie Ernaux'] },
  'les annees': { title: 'Os anos', authors: ['Annie Ernaux'] },
  'l evenement': { title: 'O acontecimento', authors: ['Annie Ernaux'] },
  'la honte': { title: 'A vergonha', authors: ['Annie Ernaux'] },
  'la place': { title: 'O lugar', authors: ['Annie Ernaux'] },
  'une femme': { title: 'Uma mulher', authors: ['Annie Ernaux'] },
  'la femme gelee': { title: 'A mulher gelada', authors: ['Annie Ernaux'] },
  'memoire de fille': { title: 'Memória de menina', authors: ['Annie Ernaux'] },
  'le jeune homme': { title: 'O jovem', authors: ['Annie Ernaux'] },
  'l autre fille': { title: 'A outra filha', authors: ['Annie Ernaux'] },
  'on earth we re briefly gorgeous': { title: 'Sobre a terra somos belos por um instante', authors: ['Ocean Vuong'] },
  'night sky with exit wounds': { title: 'Céu noturno crivado de balas', authors: ['Ocean Vuong'] },
  'time is a mother': { title: 'O tempo é uma mãe', authors: ['Ocean Vuong'] },
  'the emperor of gladness': { title: 'O imperador da alegria', authors: ['Ocean Vuong'] },
  'war and peace': { title: 'Guerra e Paz', authors: ['Liev Tolstói'] },
  'anna karenina': { title: 'Anna Kariênina', authors: ['Liev Tolstói'] },
  'the death of ivan ilyich': { title: 'A morte de Ivan Ilitch', authors: ['Liev Tolstói'] },
  'resurrection': { title: 'Ressurreição', authors: ['Liev Tolstói'] },
  'the kreutzer sonata': { title: 'A sonata a Kreutzer', authors: ['Liev Tolstói'] },
  'a confession': { title: 'Uma confissão', authors: ['Liev Tolstói'] },
  'prestuplenie i nakazanie': { title: 'Crime e Castigo', authors: ['Fiódor Dostoiévski'] },
  'bratya karamazovy': { title: 'Os Irmãos Karamázov', authors: ['Fiódor Dostoiévski'] },
  'idiot': { title: 'O Idiota', authors: ['Fiódor Dostoiévski'] },
  'the idiot': { title: 'O Idiota', authors: ['Fiódor Dostoiévski'] },
  'crime and punishment': { title: 'Crime e Castigo', authors: ['Fiódor Dostoiévski'] },
  'the brothers karamazov': { title: 'Os Irmãos Karamázov', authors: ['Fiódor Dostoiévski'] },
  'notes from underground': { title: 'Memórias do Subsolo', authors: ['Fiódor Dostoiévski'] },
  'white nights': { title: 'Noites Brancas', authors: ['Fiódor Dostoiévski'] },
  'demons': { title: 'Os Demônios', authors: ['Fiódor Dostoiévski'] },
  'the devils': { title: 'Os Demônios', authors: ['Fiódor Dostoiévski'] },
  'les miserables': { title: 'Os miseráveis', authors: ['Victor Hugo'] },
  'notre dame de paris': { title: 'Nossa Senhora de Paris', authors: ['Victor Hugo'] },
  'the hunchback of notre dame': { title: 'O corcunda de Notre-Dame', authors: ['Victor Hugo'] },
  'the man who laughs': { title: 'O homem que ri', authors: ['Victor Hugo'] },
  'toilers of the sea': { title: 'Os trabalhadores do mar', authors: ['Victor Hugo'] },
  'ninety three': { title: 'Noventa e três', authors: ['Victor Hugo'] },
  'quatrevingt treize': { title: 'Noventa e três', authors: ['Victor Hugo'] },
};

const KNOWN_WORK_BOOSTS: Record<string, number> = {
  'on earth we re briefly gorgeous': 520,
  'time is a mother': 260,
  'night sky with exit wounds': 220,
  'the emperor of gladness': 120,
  'war and peace': 520,
  'anna karenina': 500,
  'the death of ivan ilyich': 360,
  'resurrection': 260,
  'the kreutzer sonata': 220,
  'a confession': 180,
  'les miserables': 560,
  'notre dame de paris': 440,
  'the hunchback of notre dame': 400,
  'the man who laughs': 260,
  'toilers of the sea': 220,
  'ninety three': 180,
  'quatrevingt treize': 180,
};

const KNOWN_AUTHOR_QUERIES: Record<string, string> = {
  'tolstoi': 'tolstoy',
  'tolstoy': 'tolstoy',
  'lev tolstoi': 'tolstoy',
  'leon tolstoi': 'tolstoy',
  'dostoievski': 'dostoevsky',
  'dostoievsky': 'dostoevsky',
  'dostoievisky': 'dostoevsky',
  'dostoevsky': 'dostoevsky',
  'victor hugo': 'victor hugo',
};

// ─── Funções de normalização e scoring ───────────────────────────────────────

function normalizeForSearch(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchWords(value: string): string[] {
  return normalizeForSearch(value)
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function getQueryVariants(query: string): string[] {
  const normalized = getSearchWords(query).join(' ');
  return [query, ...(KNOWN_TITLE_ALIASES[normalized] || [])];
}

function getKnownAuthorSignals(query: string): string[] {
  const normalized = getSearchWords(query).join(' ');
  return KNOWN_AUTHOR_SIGNALS[normalized] || [];
}

function getKnownDisplayData(query: string) {
  const normalized = getSearchWords(query).join(' ');
  return KNOWN_DISPLAY_DATA[normalized];
}

function getKnownAuthorQuery(query: string): string | undefined {
  const normalized = getSearchWords(query).join(' ');
  return KNOWN_AUTHOR_QUERIES[normalized];
}

function getKnownWorkTranslation(book: GoogleBook) {
  const titleText = normalizeForSearch(book.volumeInfo.title || '');
  const authorText = normalizeForSearch((book.volumeInfo.authors ?? []).join(' '));
  const isKnownAuthor =
    authorText.includes('annie ernaux') ||
    authorText.includes('ocean vuong') ||
    authorText.includes('tolst') ||
    authorText.includes('dost') ||
    authorText.includes('victor hugo');
  if (!isKnownAuthor) return null;
  return KNOWN_WORK_TRANSLATIONS[titleText] || null;
}

function localizeKnownWorks(book: GoogleBook, currentScore: number): { book: GoogleBook; score: number } {
  const translation = getKnownWorkTranslation(book);
  const titleText = normalizeForSearch(book.volumeInfo.title || '');
  if (!translation) return { book, score: currentScore };
  const boost = ((book._languages ?? []).includes('por') ? 180 : 80) + (KNOWN_WORK_BOOSTS[titleText] || 0);
  return {
    book: {
      ...book,
      _displayTitle: book._displayTitle || translation.title,
      _displayAuthors: book._displayAuthors || translation.authors,
    },
    score: currentScore + boost,
  };
}

const JUNK_PATTERN = /summary|study guide|resumo|guia de estudo|inspirad[ao]s? em|seminario|conference|congresso|boxed set|box set|collection/;

function scoreGoogleBook(book: GoogleBook, query: string): number {
  const variants = getQueryVariants(query);
  const expectedAuthorSignals = getKnownAuthorSignals(query);
  const queryWords = getSearchWords(query);
  const titleText = normalizeForSearch(book.volumeInfo.title || '');
  const authorText = normalizeForSearch((book.volumeInfo.authors ?? []).join(' '));
  const fullText = normalizeForSearch(book._searchText ?? '');
  const titleWords = new Set(getSearchWords(book.volumeInfo.title || ''));
  const authorWords = new Set(getSearchWords((book.volumeInfo.authors ?? []).join(' ')));
  let score = 0;

  variants.forEach((variant, index) => {
    const variantText = normalizeForSearch(variant);
    const variantWords = getSearchWords(variant);
    const m = index === 0 ? 1 : 0.9;
    if (titleText === variantText)              score += 720 * m;
    if (authorText === variantText)             score += 650 * m;
    if (titleText.startsWith(variantText))      score += 440 * m;
    if (titleText.includes(variantText))        score += 320 * m;
    if (authorText.includes(variantText))       score += 260 * m;
    if (fullText.includes(variantText))         score += 180 * m;
    variantWords.forEach(w => {
      if (titleWords.has(w))       score += 86 * m;
      if (authorWords.has(w))      score += 62 * m;
      if (fullText.includes(w))    score += 22 * m;
    });
  });

  queryWords.forEach(w => {
    if (titleWords.has(w))    score += 70;
    if (authorWords.has(w))   score += 58;
  });

  const hasSignal = expectedAuthorSignals.some(s => fullText.includes(s));
  if (expectedAuthorSignals.length && hasSignal)    score += 680;
  if (expectedAuthorSignals.length && !hasSignal)   score -= 900;

  if (book.volumeInfo.language === 'pt')   score += 220;
  if (book.volumeInfo.imageLinks?.thumbnail) score += 80;
  if (book.volumeInfo.description)           score += 28;
  if (book.volumeInfo.pageCount)             score += 18;

  if (JUNK_PATTERN.test(titleText + ' ' + authorText)) score -= 900;

  return score;
}

function scoreOpenLibraryBook(book: GoogleBook, query: string): number {
  const variants = getQueryVariants(query);
  const expectedAuthorSignals = getKnownAuthorSignals(query);
  const queryWords = getSearchWords(query);
  const titleText = normalizeForSearch(book.volumeInfo.title || '');
  const authorText = normalizeForSearch((book.volumeInfo.authors ?? []).join(' '));
  const fullText = normalizeForSearch(book._searchText ?? '');
  const titleWords = new Set(getSearchWords(book.volumeInfo.title || ''));
  const authorWords = new Set(getSearchWords((book.volumeInfo.authors ?? []).join(' ')));
  let score = 0;

  variants.forEach((variant, index) => {
    const variantText = normalizeForSearch(variant);
    const variantWords = getSearchWords(variant);
    const m = index === 0 ? 1 : 0.86;
    if (titleText === variantText)              score += 520 * m;
    if (authorText === variantText)             score += 500 * m;
    if (titleText.startsWith(variantText))      score += 330 * m;
    if (authorText.startsWith(variantText))     score += 300 * m;
    if (titleText.includes(variantText))        score += 245 * m;
    if (authorText.includes(variantText))       score += 230 * m;
    if (fullText.includes(variantText))         score += 360 * m;
    variantWords.forEach(w => {
      if (titleWords.has(w))         score += 58 * m;
      if (authorWords.has(w))        score += 48 * m;
      if (titleText.includes(w))     score += 18 * m;
      if (authorText.includes(w))    score += 14 * m;
      if (fullText.includes(w))      score += 24 * m;
    });
  });

  queryWords.forEach(w => {
    if (titleWords.has(w))          score += 70;
    if (authorWords.has(w))         score += 58;
    if (titleText.includes(w))      score += 22;
    if (authorText.includes(w))     score += 18;
  });

  const hasSignal = expectedAuthorSignals.some(s => fullText.includes(s));
  if (expectedAuthorSignals.length && hasSignal)    score += 780;
  if (expectedAuthorSignals.length && !hasSignal)   score -= 1250;

  const editionCount = book._editionCount ?? 0;
  score += Math.min(Math.log10(editionCount + 1) * 420, 1380);

  if (book.volumeInfo.imageLinks?.thumbnail)        score += 34;
  if (book._hasClassicSignal)                       score += 220;
  if ((book._languages ?? []).includes('por'))      score += 26;
  if ((book._languages ?? []).includes('eng'))      score += 8;

  if (editionCount <= 2 && !book._hasClassicSignal) score -= 420;
  if (JUNK_PATTERN.test(titleText + ' ' + authorText)) score -= 900;

  return score;
}

function scoreKnownAuthorSearch(book: GoogleBook, query: string): number {
  const authorQuery = getKnownAuthorQuery(query);
  if (!authorQuery) return 0;

  const titleText = normalizeForSearch(book.volumeInfo.title || '');
  const authorText = normalizeForSearch((book.volumeInfo.authors ?? []).join(' '));
  const fullText = normalizeForSearch(book._searchText ?? '');

  const hasAuthorMap: Record<string, boolean> = {
    tolstoy:     authorText.includes('tolst') || fullText.includes('tolst'),
    dostoevsky:  authorText.includes('dost')  || fullText.includes('dost'),
    'victor hugo': authorText.includes('victor hugo') || fullText.includes('victor hugo'),
  };
  const primaryAuthorMap: Record<string, boolean> = {
    tolstoy:     authorText.includes('tolst'),
    dostoevsky:  authorText.includes('dost'),
    'victor hugo': authorText.includes('victor hugo'),
  };

  const hasAuthor   = hasAuthorMap[authorQuery]   ?? false;
  const primaryAuth = primaryAuthorMap[authorQuery] ?? false;
  let score = 0;

  if (hasAuthor)              score += 900;
  if (primaryAuth)            score += 900;
  if (hasAuthor && !primaryAuth) score -= 1600;

  if (authorQuery === 'tolstoy') {
    if (titleText === 'war and peace')                        score += 900;
    if (titleText === 'anna karenina')                        score += 860;
    if (titleText.includes('death of ivan ilyich'))           score += 720;
    if (titleText === 'resurrection')                         score += 520;
    if (titleText.includes('kreutzer'))                       score += 420;
  }
  if (authorQuery === 'dostoevsky') {
    if (titleText === 'crime and punishment' || titleText.includes('prestuplenie')) score += 1050;
    if (titleText.includes('crime and punishment'))           score += 520;
    if (titleText === 'the brothers karamazov' || titleText.includes('bratya karamazovy')) score += 1000;
    if (titleText.includes('brothers karamazov') || titleText.includes('karamaz')) score += 440;
    if (titleText === 'the idiot' || titleText.includes('idiot')) score += 760;
    if (titleText.includes('notes from underground'))         score += 650;
    if (titleText.includes('white nights'))                   score += 420;
  }
  if (authorQuery === 'victor hugo') {
    if (titleText.includes('miserables'))                     score += 920;
    if (titleText.includes('notre dame'))                     score += 760;
    if (titleText.includes('hunchback'))                      score += 720;
    if (titleText.includes('man who laughs'))                 score += 520;
    if (titleText.includes('toilers'))                        score += 420;
  }

  if (titleText.includes(authorQuery) && !hasAuthor) score -= 1000;
  if (/biograph|biografia|life of|vida de|study guide|summary|lectures cle|classroom|workbook|critical|criticism|companion|guide|annotated|notes/.test(titleText)) {
    score -= 2200;
  }

  return score;
}

// ─── Utilitários legados mantidos para ISBN e capa ───────────────────────────

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

function extractAmazonASIN(input: string): string | null {
  const match = input.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
}

function isbn13ToIsbn10(isbn13: string): string | null {
  if (!/^978\d{10}$/.test(isbn13)) return null;
  const core = isbn13.slice(3, 12);
  const sum = core.split('').reduce((acc, d, i) => acc + parseInt(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

const LANGUAGE_NAMES: Record<string, string> = {
  pt: 'Português', en: 'Inglês',   es: 'Espanhol',
  fr: 'Francês',   de: 'Alemão',   it: 'Italiano',
  ja: 'Japonês',   ko: 'Coreano',  zh: 'Chinês',
  ar: 'Árabe',     ru: 'Russo',    nl: 'Holandês',
  por: 'Português', eng: 'Inglês', spa: 'Espanhol',
  fre: 'Francês',   ger: 'Alemão', ita: 'Italiano',
  jpn: 'Japonês',   kor: 'Coreano', chi: 'Chinês',
  ara: 'Árabe',     rus: 'Russo',  dut: 'Holandês',
};
function resolveLanguage(code: string): string {
  if (!code) return '';
  const lower = code.toLowerCase().trim();
  return LANGUAGE_NAMES[lower] || LANGUAGE_NAMES[lower.split('-')[0]] || code;
}

// ─── Props e estado do modal ─────────────────────────────────────────────────

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
  coverFallback: '',
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
  const [titleError, setTitleError] = useState(false);
  const [formCoverFailed, setFormCoverFailed] = useState(false);

  const canScan = useMemo(() =>
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'BarcodeDetector' in window,
  []);

  // ── Normaliza um doc da Open Library para GoogleBook ─────────────────────
  function olDocToBook(doc: Record<string, unknown>): GoogleBook {
    const fs = doc.first_sentence;
    const description = typeof fs === 'string' ? fs
      : fs && typeof fs === 'object' && 'value' in (fs as object) ? String((fs as Record<string,unknown>).value)
      : undefined;
    const isbns = (doc.isbn as string[]) ?? [];
    const isbn13ol = isbns.find(s => /^97[89]\d{10}$/.test(s));
    const isbn10ol = isbns.find(s => /^\d{9}[\dX]$/i.test(s));
    let thumbnail: string | undefined;
    if (doc.cover_i) thumbnail = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    else if (isbn13ol) thumbnail = `https://covers.openlibrary.org/b/isbn/${isbn13ol}-L.jpg`;
    else if (isbn10ol) thumbnail = `https://covers.openlibrary.org/b/isbn/${isbn10ol}-L.jpg`;

    const subjects = (doc.subject as string[]) ?? [];
    const olGenre = subjects.find(s =>
      s.length > 3 && s.length < 50 &&
      !/^(fiction|nonfiction|protected daisy|juvenile|accessible book|internet archive|open library|in library|overdrive|general|literature|books|large type|e-books|online)/i.test(s) &&
      !/^\d/.test(s)
    );

    const languages = (doc.language as string[]) ?? [];
    const hasClassicSignal = Boolean(
      (doc.id_project_gutenberg as string[] | undefined)?.length ||
      (doc.id_standard_ebooks as string[] | undefined)?.length ||
      (doc.id_librivox as string[] | undefined)?.length
    );
    const searchText = [
      doc.title,
      (doc.author_name as string[] | undefined)?.join(' '),
      (doc.ia as string[] | undefined)?.join(' '),
      (doc.id_standard_ebooks as string[] | undefined)?.join(' '),
      (doc.id_project_gutenberg as string[] | undefined)?.join(' '),
      (doc.id_librivox as string[] | undefined)?.join(' '),
    ].filter(Boolean).join(' ');

    return {
      id: String(doc.key ?? Math.random()),
      volumeInfo: {
        title: String(doc.title ?? ''),
        authors: (doc.author_name as string[]) ?? [],
        pageCount: (doc.number_of_pages_median as number) || undefined,
        language: languages[0],
        publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
        description,
        imageLinks: thumbnail ? { thumbnail } : undefined,
        categories: olGenre ? [olGenre] : [],
        industryIdentifiers: [
          ...(isbn13ol ? [{ type: 'ISBN_13', identifier: isbn13ol }] : []),
          ...(isbn10ol ? [{ type: 'ISBN_10', identifier: isbn10ol }] : []),
        ],
      },
      _source: 'ol',
      _editionCount: (doc.edition_count as number) || 0,
      _hasClassicSignal: hasClassicSignal,
      _languages: languages,
      _searchText: searchText,
    };
  }

  /** Adiciona campos de scoring a um item bruto do Google Books */
  function enrichGoogleItem(item: GoogleBook): GoogleBook {
    const v = item.volumeInfo;
    const searchText = [
      v.title,
      v.authors?.join(' '),
      v.categories?.join(' '),
      v.industryIdentifiers?.map(i => i.identifier).join(' '),
    ].filter(Boolean).join(' ');
    return { ...item, _source: 'google', _searchText: searchText };
  }

  // ── Open Library: todas variantes × 3 modos (q=, title=, author=) ────────
  // Replica exatamente a estratégia do projeto "Busca Livros"
  async function searchAllOL(rawQuery: string, signal?: AbortSignal): Promise<GoogleBook[]> {
    const base = 'https://openlibrary.org/search.json';
    const fields = 'key,title,author_name,number_of_pages_median,cover_i,isbn,language,first_publish_year,first_sentence,subject,edition_count,ia,id_project_gutenberg,id_standard_ebooks,id_librivox';
    const variants = getQueryVariants(rawQuery);

    const requestConfigs: Array<[string, string][]> = variants.flatMap(variant => [
      [['q', variant], ['limit', '40'], ['fields', fields]],
      [['title', variant], ['limit', '24'], ['fields', fields]],
      [['author', variant], ['limit', '24'], ['fields', fields]],
    ]);

    const requests = requestConfigs.map(async config => {
      const params = new URLSearchParams(config);
      const res = await fetch(`${base}?${params}`, { signal });
      if (!res.ok) throw new Error('ol_fail');
      return res.json();
    });

    const settled = await Promise.allSettled(requests);
    const docs = settled
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<{ docs?: Record<string,unknown>[] }>).value.docs || []);

    // Dedup por key OL — mantém o de maior editionCount
    const byKey = new Map<string, GoogleBook>();
    docs.forEach(doc => {
      const book = olDocToBook(doc);
      const key = book.id || `${book.volumeInfo.title}|${(book.volumeInfo.authors ?? []).join(',')}`;
      const prev = byKey.get(key);
      if (!prev || (book._editionCount ?? 0) > (prev._editionCount ?? 0)) {
        byKey.set(key, book);
      }
    });

    return [...byKey.values()];
  }

  // ── Google Books: todas variantes × 4 modos (q+lang, q, intitle+lang, inauthor) ──
  // Replica exatamente a estratégia do projeto "Busca Livros"
  async function searchAllGoogle(rawQuery: string, apiKey: string, signal?: AbortSignal): Promise<GoogleBook[]> {
    const BOOKS = 'https://www.googleapis.com/books/v1/volumes';
    const variants = getQueryVariants(rawQuery);

    const base: Array<[string, string]> = [
      ['country', 'BR'], ['maxResults', '40'], ['orderBy', 'relevance'], ['printType', 'books'],
      ...(apiKey ? [['key', apiKey] as [string, string]] : []),
    ];
    const requestConfigs: Array<[string, string][]> = variants.flatMap(variant => [
      [...base, ['q', variant], ['langRestrict', 'pt']],
      [...base, ['q', variant]],
      [...base, ['q', `intitle:${variant}`], ['langRestrict', 'pt']],
      [...base, ['q', `inauthor:${variant}`]],
    ]);

    const requests = requestConfigs.map(async config => {
      const params = new URLSearchParams(config);
      const res = await fetch(`${BOOKS}?${params}`, { signal });
      if (!res.ok) throw new Error('google_fail');
      return res.json();
    });

    const settled = await Promise.allSettled(requests);
    const items = settled
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<{ items?: GoogleBook[] }>).value.items || []);

    // Dedup por id do Google
    const byKey = new Map<string, GoogleBook>();
    items.forEach(item => {
      const book = enrichGoogleItem(item);
      const key = book.id || `${book.volumeInfo.title}|${(book.volumeInfo.authors ?? []).join(',')}`;
      byKey.set(key, book);
    });

    return [...byKey.values()];
  }

  // ── Google Books ISBN (fluxo separado, sem variantes) ─────────────────────
  async function searchGoogleByIsbn(q: string, apiKey: string, signal?: AbortSignal): Promise<GoogleBook[] | null> {
    const BOOKS = 'https://www.googleapis.com/books/v1/volumes';
    try {
      const params = new URLSearchParams({ q: `isbn:${q}`, maxResults: '5' });
      if (apiKey) params.set('key', apiKey);
      const res = await fetch(`${BOOKS}?${params}`, { signal });
      const data = await res.json();
      if (data.error) return null;
      return (data.items || []).map((item: GoogleBook) => enrichGoogleItem(item));
    } catch {
      return null;
    }
  }

  async function search(type: 'query' | 'isbn', directQuery?: string) {
    const rawQ = directQuery ?? (type === 'isbn' ? isbn.trim() : query.trim());
    if (!rawQ) return;

    const asin = extractAmazonASIN(rawQ);
    const q: string = asin ?? rawQ;
    const searchType: 'query' | 'isbn' = asin ? 'isbn' : type;

    const apiKey = localStorage.getItem('pbp-google-api-key') || '';

    setLoading(true);
    setSearchError('');
    setFailedCovers(new Set());
    try {
      if (searchType === 'isbn') {
        // ISBN: Google primário (determinístico), OL como fallback
        let items = await searchGoogleByIsbn(q, apiKey);
        if (!items || items.length === 0) {
          items = await searchAllOL(encodeURIComponent(q));
        }
        const finalResults = (items ?? []).slice(0, 10);
        setResults(finalResults);
        if (finalResults.length === 0) setSearchError('Nenhum resultado encontrado.');
        return;
      }

      // ── Busca por título/autor: paralela com scoring inteligente ──────────
      // Estratégia idêntica ao projeto "Busca Livros": todas variantes × todos modos
      const olCtrl = new AbortController();
      const googleCtrl = new AbortController();
      const olTimeout = window.setTimeout(() => olCtrl.abort(), 6000);
      const googleTimeout = window.setTimeout(() => googleCtrl.abort(), 5000);

      const [olSettled, googleSettled] = await Promise.allSettled([
        searchAllOL(q, olCtrl.signal),
        searchAllGoogle(q, apiKey, googleCtrl.signal),
      ]);
      window.clearTimeout(olTimeout);
      window.clearTimeout(googleTimeout);

      const olBooks    = olSettled.status     === 'fulfilled' ? olSettled.value     : [];
      const googleBooks = googleSettled.status === 'fulfilled' ? googleSettled.value : [];

      if (import.meta.env.DEV) {
        console.debug('[pbp:search]', { q, ol: olBooks.length, google: googleBooks.length });
      }

      // Scoring + dedup + localização
      const all = [...olBooks, ...googleBooks];
      const byKey = new Map<string, { book: GoogleBook; score: number }>();

      all.forEach(book => {
        if (!book.volumeInfo.title) return;
        const baseScore = book._source === 'google'
          ? scoreGoogleBook(book, q)
          : scoreOpenLibraryBook(book, q);
        const authorScore = scoreKnownAuthorSearch(book, q);
        const sourceBoost = book._source === 'google' ? 260 : 0;
        const rawScore = baseScore + authorScore + sourceBoost;

        const { book: localized, score } = localizeKnownWorks(book, rawScore);

        const keyTitle = normalizeForSearch(localized._displayTitle || localized.volumeInfo.title);
        const keyAuthor = normalizeForSearch((localized._displayAuthors ?? localized.volumeInfo.authors ?? []).join(','));
        const key = `${keyTitle}|${keyAuthor}`;
        if (!key || key === '|') return;

        const prev = byKey.get(key);
        if (!prev || score > prev.score) {
          byKey.set(key, { book: localized, score });
        }
      });

      // Pós-processamento: aplica displayData forçado para top resultado conhecido
      const sorted = [...byKey.values()]
        .sort((a, b) => b.score - a.score);

      const displayData = getKnownDisplayData(q);
      if (displayData && sorted.length > 0) {
        const expectedSignals = getKnownAuthorSignals(q);
        const top = sorted[0].book;
        const fullText = normalizeForSearch(top._searchText ?? '');
        const hasSignal = expectedSignals.length === 0 || expectedSignals.some(s => fullText.includes(s));
        const editionCount = top._editionCount ?? 0;
        if (hasSignal && (editionCount >= 50 || expectedSignals.length === 0)) {
          sorted[0] = {
            ...sorted[0],
            book: { ...top, _displayTitle: displayData.title, _displayAuthors: displayData.authors },
          };
        }
      }

      const finalResults = sorted.slice(0, 10).map(r => ({ ...r.book, _score: r.score }));
      setResults(finalResults);
      if (finalResults.length === 0) setSearchError('Nenhum resultado encontrado.');
    } catch {
      setSearchError('Erro ao buscar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }

  function selectResult(item: GoogleBook) {
    const { volumeInfo: v } = item;
    const displayTitle   = item._displayTitle   || v.title   || '';
    const displayAuthors = item._displayAuthors || v.authors || [];

    const googleCover = v.imageLinks?.thumbnail?.replace('http://', 'https://') ?? '';
    const isbn13 = v.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier ?? '';
    const isbn10 = v.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier
      || (isbn13 ? isbn13ToIsbn10(isbn13) : null)
      || '';
    const isbnVal = isbn13 || isbn10;

    const olCover = isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`
      : isbn10 ? `https://covers.openlibrary.org/b/isbn/${isbn10}-L.jpg`
      : '';
    const amazonCover = isbn10 ? `https://m.media-amazon.com/images/P/${isbn10}.01._SL500_.jpg` : '';
    const cover         = googleCover || amazonCover || olCover;
    const coverFallback = googleCover ? (amazonCover || olCover) : (amazonCover ? olCover : '');

    setForm({
      title:  displayTitle,
      author: displayAuthors.join(', '),
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
      isbn: isbnVal,
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

  function doAddBook() {
    if (!form.title.trim()) { setTitleError(true); return; }
    setTitleError(false);
    const pagesAdditional = parseInt(form.pagesAdditional) || 0;
    const firstPage = form.firstPageNum !== '' ? (parseInt(form.firstPageNum) || 1) : 1;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doAddBook();
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

                {searchError && (
                  <p className={styles.searchError}>{searchError}</p>
                )}

                {results.length > 0 && (
                  <div className={styles.results}>
                    {results.map(item => {
                      const v = item.volumeInfo;
                      const displayTitle   = item._displayTitle   || v.title;
                      const displayAuthors = item._displayAuthors || v.authors || [];
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
                            <div className={styles.resultTitle}>{displayTitle}</div>
                            <div className={styles.resultAuthor}>
                              {displayAuthors.join(', ')}
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
              <div className="field" style={{ marginBottom: '0.75rem' }}>
                <label className="label">Título *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={e => { if (titleError) setTitleError(false); setForm(f => ({ ...f, title: e.target.value })); }}
                  style={{
                    marginBottom: (form.cover || form.description || fromSearch) ? '0.5rem' : 0,
                    borderColor: titleError ? 'var(--danger)' : undefined,
                  }}
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
          )}
        </div>

        {showForm && (
          <div className={styles.footer}>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              ← Voltar
            </button>
            <button type="button" className="btn-primary" onClick={doAddBook}>
              Adicionar livro
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
