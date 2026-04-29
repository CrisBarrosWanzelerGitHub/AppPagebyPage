export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function toDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function dayOfYear(dateStr: string): number {
  const date = new Date(dateStr);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs(Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export function remainingDaysInYear(year: number): number {
  const now = today();
  const endOfYear = `${year}-12-31`;
  if (now > endOfYear) return 0;
  return daysBetween(now, endOfYear) + 1;
}

export function remainingDaysInMonth(year: number, month: number): number {
  const now = today();
  const lastDay = daysInMonth(year, month);
  const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  if (now > endOfMonth) return 0;
  return daysBetween(now, endOfMonth) + 1;
}

export function elapsedDaysInYear(year: number): number {
  const now = today();
  const startOfYear = `${year}-01-01`;
  if (now < startOfYear) return 0;
  return dayOfYear(now);
}

export function elapsedDaysInMonth(year: number, month: number): number {
  const now = today();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  if (!now.startsWith(prefix)) {
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
    if (now > endOfMonth) return daysInMonth(year, month);
    return 0;
  }
  return parseInt(now.split('-')[2], 10);
}

export function getMonthName(month: number): string {
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[month - 1] || '';
}

export function getMonthFullName(month: number): string {
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return names[month - 1] || '';
}

export function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export function getAllDaysInYear(year: number): string[] {
  const days: string[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
