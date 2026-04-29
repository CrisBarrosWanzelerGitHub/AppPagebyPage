import type { Book, ReadingLog, Goals, MonthStat } from '../types';
import {
  today,
  daysInYear,
  daysInMonth,
  remainingDaysInYear,
  remainingDaysInMonth,
  elapsedDaysInYear,
  elapsedDaysInMonth,
  getLast30Days,
} from './dates';

// ─── Page Totals ────────────────────────────────────────────────────────────

export function getTotalPages(logs: ReadingLog[]): number {
  return logs.reduce((sum, l) => sum + l.pages, 0);
}

export function getPagesInYear(logs: ReadingLog[], year: number): number {
  return logs
    .filter(l => l.date.startsWith(String(year)))
    .reduce((sum, l) => sum + l.pages, 0);
}

export function getPagesInMonth(logs: ReadingLog[], year: number, month: number): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return logs
    .filter(l => l.date.startsWith(prefix))
    .reduce((sum, l) => sum + l.pages, 0);
}

export function getBooksCompletedInYear(books: Book[], year: number): number {
  return books.filter(
    b => b.status === 'done' && b.endDate && b.endDate.startsWith(String(year))
  ).length;
}

// ─── Averages ────────────────────────────────────────────────────────────────

/** Average pages per elapsed calendar day in the year (total pages / days elapsed since Jan 1) */
export function getAvgPagesPerDayYear(logs: ReadingLog[], year: number): number {
  const elapsed = elapsedDaysInYear(year);
  if (elapsed === 0) return 0;
  return getPagesInYear(logs, year) / elapsed;
}

/** Average pages per elapsed calendar day in the month (total pages / days elapsed in month) */
export function getAvgPagesPerDayMonth(logs: ReadingLog[], year: number, month: number): number {
  const elapsed = elapsedDaysInMonth(year, month);
  if (elapsed === 0) return 0;
  return getPagesInMonth(logs, year, month) / elapsed;
}

// ─── Projections ─────────────────────────────────────────────────────────────

export function getProjectedYearPages(logs: ReadingLog[], year: number): number {
  const avg = getAvgPagesPerDayYear(logs, year);
  return Math.round(avg * daysInYear(year));
}

export function getProjectedMonthPages(logs: ReadingLog[], year: number, month: number): number {
  const avg = getAvgPagesPerDayMonth(logs, year, month);
  return Math.round(avg * daysInMonth(year, month));
}

// ─── Daily Targets ────────────────────────────────────────────────────────────

export function getDailyTargetYear(logs: ReadingLog[], goals: Goals, year: number): number {
  const remaining = goals.yearPages - getPagesInYear(logs, year);
  if (remaining <= 0) return 0;
  const days = remainingDaysInYear(year);
  if (days === 0) return 0;
  return Math.ceil(remaining / days);
}

export function getDailyTargetMonth(logs: ReadingLog[], goals: Goals, year: number, month: number): number {
  const remaining = goals.monthPages - getPagesInMonth(logs, year, month);
  if (remaining <= 0) return 0;
  const days = remainingDaysInMonth(year, month);
  if (days === 0) return 0;
  return Math.ceil(remaining / days);
}

// ─── Book Progress ────────────────────────────────────────────────────────────

export function getBookPagesRead(book: Book): number {
  return book.currentPage;
}

export function getBookPercent(book: Book): number {
  if (book.pages === 0) return 0;
  return Math.min(100, Math.round((book.currentPage / book.pages) * 100));
}

export function getBookEstimatedFinish(book: Book, logs: ReadingLog[]): string | null {
  const avg = getAvgPagesPerDayYear(logs, new Date().getFullYear());
  if (avg <= 0) return null;
  const remaining = book.pages - book.currentPage;
  if (remaining <= 0) return 'Concluído';
  const daysLeft = Math.ceil(remaining / avg);
  const finish = new Date();
  finish.setDate(finish.getDate() + daysLeft);
  const [y, m, d] = finish.toISOString().split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export function getStreak(logs: ReadingLog[]): number {
  if (logs.length === 0) return 0;
  const datesWithLogs = new Set(logs.map(l => l.date));
  let streak = 0;
  const cursor = new Date();
  // Check if today has a log; if not, start from yesterday
  const todayStr = today();
  if (!datesWithLogs.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (!datesWithLogs.has(dateStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ─── Last 30 Days ─────────────────────────────────────────────────────────────

export function getLast30DaysData(logs: ReadingLog[]): { date: string; pages: number }[] {
  const last30 = getLast30Days();
  const byDate = new Map<string, number>();
  logs.forEach(l => {
    byDate.set(l.date, (byDate.get(l.date) || 0) + l.pages);
  });
  return last30.map(date => ({ date, pages: byDate.get(date) || 0 }));
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

export function getHeatmapData(logs: ReadingLog[], year: number): Map<string, number> {
  const byDate = new Map<string, number>();
  logs
    .filter(l => l.date.startsWith(String(year)))
    .forEach(l => {
      byDate.set(l.date, (byDate.get(l.date) || 0) + l.pages);
    });
  return byDate;
}

export function getHeatmapColor(pages: number): string {
  if (pages === 0) return 'var(--border)';
  if (pages < 10) return 'rgba(245,196,0,0.25)';
  if (pages < 25) return 'rgba(245,196,0,0.50)';
  if (pages < 50) return 'rgba(245,196,0,0.78)';
  return 'rgba(245,196,0,1)';
}

// Goal-aware heatmap: 4 tiers relative to daily goal (monthPages / daysInMonth)
export function getHeatmapColorGoal(pages: number, dailyGoal: number): string {
  if (pages <= 0) return 'rgba(255,255,255,0.06)';           // sem leitura
  if (dailyGoal <= 0) return 'rgba(245,196,0,0.65)';        // sem meta definida → trata como na meta
  if (pages < dailyGoal) return 'rgba(245,196,0,0.30)';     // abaixo da meta
  if (pages < dailyGoal * 1.5) return 'rgba(245,196,0,0.68)'; // na meta
  return 'rgba(245,196,0,1)';                                // acima da meta
}

export const HEATMAP_LEGEND = [
  { bg: 'rgba(255,255,255,0.06)', label: 'Sem leitura'    },
  { bg: 'rgba(245,196,0,0.30)',   label: 'Abaixo da meta' },
  { bg: 'rgba(245,196,0,0.68)',   label: 'Na meta'        },
  { bg: 'rgba(245,196,0,1)',      label: 'Acima da meta'  },
];

// ─── Month goal helper ────────────────────────────────────────────────────────

export function getMonthGoal(goals: Goals, year: number, month: number): number {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return goals.monthlyGoals?.[key] ?? goals.monthPages;
}

// ─── Best Month ──────────────────────────────────────────────────────────────

export function getBestMonth(logs: ReadingLog[], year: number): { month: number; pages: number } {
  let best = { month: new Date().getMonth() + 1, pages: 0 };
  for (let m = 1; m <= 12; m++) {
    const p = getPagesInMonth(logs, year, m);
    if (p > best.pages) best = { month: m, pages: p };
  }
  return best;
}

// ─── Monthly Stats ────────────────────────────────────────────────────────────

export function getMonthlyStats(logs: ReadingLog[], goals: Goals, year: number): MonthStat[] {
  const stats: MonthStat[] = [];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const maxMonth = year < currentYear ? 12 : currentMonth;

  for (let month = 1; month <= maxMonth; month++) {
    const pagesRead = getPagesInMonth(logs, year, month);
    const goal = getMonthGoal(goals, year, month);
    const percent = goal > 0 ? Math.round((pagesRead / goal) * 100) : 0;
    stats.push({ year, month, pagesRead, goal, percent });
  }
  return stats;
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  threshold: number;
  unlocked: boolean;
  pagesNeeded: number;
  type?: 'yearly' | 'monthly';
  target?: number; // pages target (for monthly type)
}

export function getAchievements(logs: ReadingLog[], goals: Goals, year: number): Achievement[] {
  const pagesRead = getPagesInYear(logs, year);
  const yearGoal = goals.yearPages;

  const currentMonth    = new Date().getMonth() + 1;
  const monthGoal       = goals.monthPages;
  // Best month in the year: if the goal was ever hit this year, keep the achievement unlocked
  let bestMonthPages = 0;
  for (let m = 1; m <= 12; m++) {
    const mp = getPagesInMonth(logs, year, m);
    if (mp > bestMonthPages) bestMonthPages = mp;
  }
  // Progress bar shows current month; unlock uses the best month
  const monthPagesRead  = Math.max(getPagesInMonth(logs, year, currentMonth), bestMonthPages);
  const monthGoalHit    = bestMonthPages >= monthGoal;

  const defs = [
    { id: 'ten',     title: 'Primeiros 10%',       description: 'Você começou! Os primeiros passos já foram dados.', icon: '○', threshold: 10 },
    { id: 'quarter', title: 'Um quarto da meta',   description: 'Já percorreu 25% do caminho. Continue assim!',      icon: '◔', threshold: 25 },
    { id: 'half',    title: 'Metade do caminho',   description: 'Você chegou na metade. A segunda parte começa!',    icon: '◑', threshold: 50 },
    { id: 'three4',  title: 'Três quartos lá',     description: '75% concluído. O fim está próximo!',               icon: '◕', threshold: 75 },
    { id: 'full',    title: 'Meta anual atingida!', description: 'Parabéns! Você alcançou sua meta de leitura.',     icon: '●', threshold: 100 },
  ];

  const yearlyAchievements: Achievement[] = defs.map(def => {
    const pagesForThreshold = Math.ceil((def.threshold / 100) * yearGoal);
    const unlocked = pagesRead >= pagesForThreshold;
    return {
      ...def,
      type: 'yearly' as const,
      target: pagesForThreshold,
      unlocked,
      pagesNeeded: unlocked ? 0 : pagesForThreshold - pagesRead,
    };
  });

  const monthlyAchievement: Achievement = {
    id:          'monthly_goal',
    title:       'Meta mensal atingida!',
    description: `Você leu ${monthGoal.toLocaleString('pt-BR')} páginas em um mês. Constância é tudo!`,
    icon:        '◆',
    threshold:   100,
    type:        'monthly',
    target:      monthGoal,
    unlocked:    monthGoalHit,
    pagesNeeded: monthGoalHit ? 0 : monthGoal - monthPagesRead,
  };

  return [monthlyAchievement, ...yearlyAchievements];
}
