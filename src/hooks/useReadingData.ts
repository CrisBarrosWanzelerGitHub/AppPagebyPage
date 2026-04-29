import { useState, useEffect } from 'react';
import type { AppState, Book, ReadingLog, Goals, ReadSession, LibraryPlace } from '../types';

const STORAGE_KEY = 'pagebypage_v1';

const defaultState: AppState = {
  goals: { yearPages: 5000, monthPages: 420 },
  books: [],
  logs: [],
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
}

export function useReadingData() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addBook = (book: Book) =>
    setState(s => ({ ...s, books: [...s.books, book] }));

  const updateBook = (book: Book) =>
    setState(s => {
      const oldBook = s.books.find(b => b.id === book.id);

      // Atualiza bookTitle nos logs se o título mudou
      let updatedLogs = s.logs.map(l =>
        l.bookId === book.id ? { ...l, bookTitle: book.title } : l
      );

      // Se o livro está "lido" e o total de páginas aumentou,
      // adiciona um log de correção com a diferença para manter as métricas corretas
      if (
        book.status === 'done' &&
        oldBook &&
        book.pages > 0 &&
        book.pages > (oldBook.pages ?? 0)
      ) {
        const pageDiff = book.pages - oldBook.pages;
        const correctionLog: ReadingLog = {
          id: crypto.randomUUID(),
          bookId: book.id,
          bookTitle: book.title,
          date: new Date().toISOString().split('T')[0],
          pages: pageDiff,
          currentPage: book.pages,
        };
        updatedLogs = [...updatedLogs, correctionLog];
      }

      return {
        ...s,
        books: s.books.map(b => (b.id === book.id ? book : b)),
        logs: updatedLogs,
      };
    });

  const deleteBook = (id: string) =>
    setState(s => ({
      ...s,
      books: s.books.filter(b => b.id !== id),
      logs: s.logs.filter(l => l.bookId !== id),
    }));

  const addLog = (log: ReadingLog) =>
    setState(s => {
      const books = s.books.map(b => {
        if (b.id !== log.bookId) return b;
        const updated: Book = { ...b, currentPage: log.currentPage ?? b.currentPage };
        // Auto-set startDate if not set e livro está em leitura ou releitura
        if (!updated.startDate && (updated.status === 'reading' || updated.status === 'rereading')) {
          updated.startDate = log.date;
        }
        return updated;
      });
      return { ...s, books, logs: [...s.logs, log] };
    });

  const deleteLog = (id: string) =>
    setState(s => {
      const logToDelete = s.logs.find(l => l.id === id);
      const remainingLogs = s.logs.filter(l => l.id !== id);
      if (!logToDelete) return { ...s, logs: remainingLogs };

      const books = s.books.map(b => {
        if (b.id !== logToDelete.bookId) return b;
        const bookLogs = remainingLogs
          .filter(l => l.bookId === b.id)
          .sort((a, x) => x.date.localeCompare(a.date) || x.id.localeCompare(a.id));
        const lastLog = bookLogs[0];
        const newCurrentPage = lastLog?.currentPage ?? 0;
        const hasPastSessions = (b.readSessions?.length ?? 0) > 0;
        const newStatus: Book['status'] =
          newCurrentPage >= b.pages && b.pages > 0
            ? 'done'
            : newCurrentPage > 0
            ? 'reading'
            : hasPastSessions ? 'rereading' : 'want';
        return { ...b, currentPage: newCurrentPage, status: newStatus };
      });
      return { ...s, books, logs: remainingLogs };
    });

  const deleteLogs = (ids: string[]) =>
    setState(s => {
      const idSet = new Set(ids);
      const deletedLogs = s.logs.filter(l => idSet.has(l.id));
      const remainingLogs = s.logs.filter(l => !idSet.has(l.id));
      const affectedBookIds = new Set(deletedLogs.map(l => l.bookId));

      const books = s.books.map(b => {
        if (!affectedBookIds.has(b.id)) return b;
        const bookLogs = remainingLogs
          .filter(l => l.bookId === b.id)
          .sort((a, x) => x.date.localeCompare(a.date) || x.id.localeCompare(a.id));
        const lastLog = bookLogs[0];
        const newCurrentPage = lastLog?.currentPage ?? 0;
        const hasPastSessions = (b.readSessions?.length ?? 0) > 0;
        const newStatus: Book['status'] =
          newCurrentPage >= b.pages && b.pages > 0
            ? 'done'
            : newCurrentPage > 0
            ? 'reading'
            : hasPastSessions ? 'rereading' : 'want';
        return { ...b, currentPage: newCurrentPage, status: newStatus };
      });
      return { ...s, books, logs: remainingLogs };
    });

  /** Cancela a releitura em andamento e restaura o estado de "Lido" anterior */
  const abandonReread = (bookId: string) =>
    setState(s => {
      const book = s.books.find(b => b.id === bookId);
      if (!book || !(book.readSessions?.length)) return s;
      const sessions = [...book.readSessions];
      const prev = sessions.pop()!;          // restaura a sessão concluída anterior
      const updated: Book = {
        ...book,
        status: 'done',
        currentPage: book.pages,
        readSessions: sessions,
        startDate: prev.startDate,
        endDate: prev.endDate,
        startPage: undefined,
      };
      return { ...s, books: s.books.map(b => b.id === bookId ? updated : b) };
    });

  /** Arquiva a leitura atual e começa uma releitura do zero */
  const startReread = (bookId: string) =>
    setState(s => {
      const book = s.books.find(b => b.id === bookId);
      if (!book || book.status !== 'done') return s;
      const session: ReadSession = {
        startDate: book.startDate,
        endDate: book.endDate,
        totalPages: Math.max(0, book.currentPage - (book.startPage ?? 0)),
      };
      const updated: Book = {
        ...book,
        status: 'rereading',
        currentPage: 0,
        startPage: undefined,
        startDate: undefined,
        endDate: undefined,
        readSessions: [...(book.readSessions ?? []), session],
      };
      return { ...s, books: s.books.map(b => b.id === bookId ? updated : b) };
    });

  const setGoals = (goals: Goals) =>
    setState(s => ({ ...s, goals }));

  // ─── Libraries (locais/plataformas) ────────────────────────────────────────
  const addLibrary = (lib: LibraryPlace) =>
    setState(s => ({ ...s, libraries: [...(s.libraries ?? []), lib] }));

  const updateLibrary = (lib: LibraryPlace) =>
    setState(s => ({
      ...s,
      libraries: (s.libraries ?? []).map(l => l.id === lib.id ? lib : l),
    }));

  const deleteLibrary = (id: string) =>
    setState(s => ({ ...s, libraries: (s.libraries ?? []).filter(l => l.id !== id) }));

  // ─── Quero Ler — ordem manual ───────────────────────────────────────────────
  const setWantOrder = (order: string[]) =>
    setState(s => ({ ...s, wantOrder: order }));

  const resetData = () => setState(defaultState);

  /** Substitui todos os dados por um backup importado, preservando metas */
  const importData = (books: Book[], logs: ReadingLog[]) =>
    setState(s => ({ ...s, books, logs }));

  /** Adiciona um ou mais logs históricos sem alterar livros */
  const addLogs = (newLogs: ReadingLog[]) =>
    setState(s => ({ ...s, logs: [...s.logs, ...newLogs] }));

  /** Mescla livros importados, pulando títulos que já existem (case-insensitive) */
  const addBooks = (newBooks: Book[]) =>
    setState(s => {
      const existingTitles = new Set(s.books.map(b => b.title.toLowerCase().trim()));
      const toAdd = newBooks.filter(b => !existingTitles.has(b.title.toLowerCase().trim()));
      return { ...s, books: [...s.books, ...toAdd] };
    });

  return {
    state,
    addBook,
    addBooks,
    updateBook,
    deleteBook,
    addLog,
    addLogs,
    deleteLog,
    deleteLogs,
    setGoals,
    resetData,
    importData,
    startReread,
    abandonReread,
    addLibrary,
    updateLibrary,
    deleteLibrary,
    setWantOrder,
  };
}
