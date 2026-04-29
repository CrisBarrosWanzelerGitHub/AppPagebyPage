export interface ReadSession {
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  totalPages: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  pages: number;
  cover: string;
  status: 'want' | 'reading' | 'done' | 'abandoned' | 'rereading';
  tags: string[];
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD
  currentPage: number;
  startPage?: number;    // virtual page 0: pages read = currentPage - startPage
  firstPageNum?: number; // displayed number of the first page (for placeholder / min validation)
  isbn?: string;         // ISBN-13 or ISBN-10
  format?: 'physical' | 'digital'; // formato do exemplar
  store?: string;        // onde encontrar/adquirir o livro
  language?: string;     // idioma do livro
  readSessions?: ReadSession[]; // sessões de leitura concluídas anteriores
  quotes?: string[];            // múltiplos trechos marcantes
  quote?: string;               // @deprecated — migrar para quotes
}

export interface ReadingLog {
  id: string;
  bookId: string;
  bookTitle: string;
  date: string;         // YYYY-MM-DD
  pages: number;
  currentPage?: number;
}

export interface Goals {
  yearPages: number;
  monthPages: number;                        // meta mensal padrão (fallback)
  monthlyGoals?: Record<string, number>;     // metas específicas por mês: "YYYY-MM" → páginas
}

export interface LibraryPlace {
  id: string;
  name: string;
  url?: string;
  address?: string;
  note?: string;
  tags?: string[];
}

export interface AppState {
  goals: Goals;
  books: Book[];
  logs: ReadingLog[];
  libraries?: LibraryPlace[];
  wantOrder?: string[];         // IDs dos livros "Quero Ler" na ordem manual
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'delete';
  undo?: () => void;
  onExpire?: () => void;
  countdown?: number;   // ms
  onConfirm?: () => void;
  confirmLabel?: string;
}

export interface HeatmapDay {
  date: string;
  pages: number;
  dayOfWeek: number;
}

export interface MonthStat {
  year: number;
  month: number;
  pagesRead: number;
  goal: number;
  percent: number;
}
