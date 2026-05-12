import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { AppState } from '../types';
import {
  getTotalPages,
  getPagesInYear,
  getPagesInMonth,
  getBooksCompletedInYear,
  getHeatmapData,
  getHeatmapColorGoal,
  HEATMAP_LEGEND,
  getMonthlyStats,
  getMonthGoal,
  getStreak,
  getBestMonth,
  getAchievements,
} from '../utils/metrics';
import { getAllDaysInYear, getMonthName, getMonthFullName, toDisplayDate } from '../utils/dates';
import styles from './History.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Props {
  state: AppState;
  showToast?: unknown;
  onNavigateToNextReads?: () => void;
  onNavigateToToday?: () => void;
  [key: string]: unknown;
}

export default function History({ state, onNavigateToNextReads }: Props) {
  const { logs, goals, books } = state;
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [showBooksModal, setShowBooksModal] = useState(false);

  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute('data-theme') === 'dark'
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!showBooksModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowBooksModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showBooksModal]);

  // ─── Year selector ────────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    logs.forEach(l => years.add(parseInt(l.date.split('-')[0])));
    return [...years].sort((a, b) => a - b);
  }, [logs, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => {
    if (logs.length === 0) return currentYear;
    return Math.max(...logs.map(l => parseInt(l.date.split('-')[0])));
  });

  // ─── Core data ────────────────────────────────────────────────────────────
  const totalPages   = useMemo(() => getTotalPages(logs), [logs]);
  const yearPages    = useMemo(() => getPagesInYear(logs, selectedYear), [logs, selectedYear]);
  const heatmapData  = useMemo(() => getHeatmapData(logs, selectedYear), [logs, selectedYear]);
  const monthlyStats = useMemo(() => getMonthlyStats(logs, goals, selectedYear), [logs, goals, selectedYear]);
  const allDays      = useMemo(() => getAllDaysInYear(selectedYear), [selectedYear]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const daysRead = useMemo(() => allDays.filter(d => d <= todayStr && (heatmapData.get(d) || 0) > 0).length, [allDays, heatmapData, todayStr]);
  const daysPast = useMemo(() => allDays.filter(d => d <= todayStr).length, [allDays, todayStr]);
  const streak   = useMemo(() => getStreak(logs), [logs]);

  const month            = selectedYear === currentYear ? currentMonth : 12;
  const monthPages       = useMemo(() => getPagesInMonth(logs, selectedYear, month), [logs, selectedYear, month]);
  const booksYTD         = useMemo(() => getBooksCompletedInYear(books, selectedYear), [books, selectedYear]);

  const booksReadInYear  = useMemo(() =>
    books
      .filter(b => b.status === 'done' && b.endDate?.startsWith(String(selectedYear)))
      .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? '')),
    [books, selectedYear]
  );
  const currentMonthGoal = useMemo(() => getMonthGoal(goals, selectedYear, month), [goals, selectedYear, month]);
  const yearPct  = goals.yearPages  > 0 ? Math.min(100, Math.round((yearPages  / goals.yearPages)  * 100)) : 0;
  const monthPct = currentMonthGoal > 0 ? Math.min(100, Math.round((monthPages / currentMonthGoal) * 100)) : 0;

  // ─── Hoje ─────────────────────────────────────────────────────────────────
  const todayPages = useMemo(
    () => logs.filter(l => l.date === todayStr).reduce((s, l) => s + l.pages, 0),
    [logs, todayStr]
  );

  // ─── Best month + journey ─────────────────────────────────────────────────
  const bestMonth = useMemo(() => getBestMonth(logs, selectedYear), [logs, selectedYear]);

  const journeyData = useMemo(() => {
    const maxMonth = selectedYear === currentYear ? currentMonth : 12;
    return Array.from({ length: maxMonth }, (_, i) => ({
      month: i + 1,
      pages: getPagesInMonth(logs, selectedYear, i + 1),
      goal:  getMonthGoal(goals, selectedYear, i + 1),
    }));
  }, [logs, goals, selectedYear, currentYear, currentMonth]);

  // ─── Conquistas (mesmas da aba Conquistas) ────────────────────────────────
  const yearAchievements = useMemo(
    () => getAchievements(logs, goals, selectedYear),
    [logs, goals, selectedYear]
  );

  // ─── Pool de quotes (todos os trechos de todos os livros) ────────────────
  const quotePool = useMemo(() => {
    const pool: { text: string; title: string; author: string }[] = [];
    for (const b of books) {
      const qs = b.quotes?.length
        ? b.quotes
        : b.quote?.trim() ? [b.quote.trim()] : [];
      for (const q of qs) {
        if (q.trim()) pool.push({ text: q, title: b.title, author: b.author });
      }
    }
    return pool;
  }, [books]);

  // Índice do quote exibido — inicia aleatório, avança 1 a cada clique no card
  const [quoteOffset, setQuoteOffset] = useState(() => Math.floor(Math.random() * 1000));
  const currentQuote = quotePool.length > 0
    ? quotePool[quoteOffset % quotePool.length]
    : null;

  // Efeito typewriter: revela letra a letra da esquerda para a direita
  const typeRaf = useRef<number>(0);
  const [typed, setTyped] = useState<string | null>(null);

  function typewriterReveal(target: string) {
    cancelAnimationFrame(typeRaf.current);

    // Delay base adaptativo: ~3000ms de base para qualquer tamanho, mínimo 28ms/char
    const baseDelay = Math.max(28, Math.min(55, 3000 / target.length));

    // Pré-calcula o momento (ms desde início) em que cada caractere deve aparecer
    const charTimes: number[] = [];
    let t = 0;
    for (let i = 0; i < target.length; i++) {
      const prev = i > 0 ? target[i - 1] : '';
      let delay = baseDelay + (Math.random() * 20 - 10); // ±10ms de jitter humano

      if ('.!?'.includes(prev))        delay += 200 + Math.random() * 100; // pausa de fim de frase
      else if (',;:—'.includes(prev))  delay +=  80 + Math.random() *  50; // pausa de vírgula/dois-pontos
      else if (prev === ' ')           delay +=  40 + Math.random() *  30; // respiro entre palavras

      t += delay;
      charTimes.push(t);
    }

    let last = performance.now();
    let elapsed = 0;

    function tick(now: number) {
      elapsed += now - last;
      last = now;

      let revealed = 0;
      while (revealed < target.length && charTimes[revealed] <= elapsed) revealed++;

      setTyped(target.slice(0, revealed));
      if (revealed < target.length) {
        typeRaf.current = requestAnimationFrame(tick);
      } else {
        setTyped(null);
      }
    }
    typeRaf.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => cancelAnimationFrame(typeRaf.current), []);

  function advanceQuote() {
    if (quotePool.length <= 1) return;
    const next = quoteOffset + 1;
    setQuoteOffset(next);
    const q = quotePool[next % quotePool.length];
    if (q) typewriterReveal(q.text);
  }

  // ─── Hover hint (heatmap) ─────────────────────────────────────────────────
  const [hoverHint, setHoverHint] = useState<string | null>(null);

  // ─── Yearly evolution (pages per year — bar chart) ────────────────────────
  const yearlyEvolution = useMemo(() => {
    const map = new Map<number, number>();
    logs.forEach(l => {
      const y = parseInt(l.date.split('-')[0]);
      map.set(y, (map.get(y) || 0) + l.pages);
    });
    if (map.size === 0) return [];
    const minYear = Math.min(...map.keys());
    const maxYear = Math.max(currentYear, ...map.keys());
    const result: { year: number; pages: number }[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      result.push({ year: y, pages: map.get(y) || 0 });
    }
    return result;
  }, [logs, currentYear]);

  // ─── Heatmap weeks ────────────────────────────────────────────────────────
  const weeks = useMemo(() => {
    const firstDay = new Date(selectedYear, 0, 1);
    const startDow = (firstDay.getDay() + 6) % 7;
    const cells: { date: string | null; pages: number }[] = [
      ...Array(startDow).fill({ date: null, pages: 0 }),
      ...allDays.map(d => ({ date: d, pages: heatmapData.get(d) || 0 })),
    ];
    const result: { date: string | null; pages: number }[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [allDays, heatmapData, selectedYear]);

  const monthLabelPositions = useMemo(() => {
    const positions: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const firstReal = week.find(d => d.date !== null);
      if (firstReal?.date) {
        const m = parseInt(firstReal.date.split('-')[1]);
        if (m !== lastMonth) { positions.push({ label: getMonthName(m), col }); lastMonth = m; }
      }
    });
    return positions;
  }, [weeks]);

  // ─── Monthly bar chart ────────────────────────────────────────────────────
  const monthlyBarValues = useMemo(
    () => MONTH_SHORT.map((_, i) => {
      const stat = monthlyStats.find(s => s.month === i + 1);
      return stat ? stat.pagesRead : 0;
    }),
    [monthlyStats]
  );

  const goalValues = useMemo(
    () => MONTH_SHORT.map((_, i) => {
      const stat = monthlyStats.find(s => s.month === i + 1);
      return stat ? stat.goal : getMonthGoal(goals, selectedYear, i + 1);
    }),
    [monthlyStats, goals, selectedYear]
  );

  const maxMonthly = Math.max(...monthlyBarValues, ...goalValues, 1);

  // ─── Genre / store / format / language counts ─────────────────────────────
  const genreCounts = useMemo(() => {
    const m = new Map<string, number>();
    books.forEach(b => { if (b.genre?.trim()) m.set(b.genre.trim(), (m.get(b.genre.trim()) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [books]);

  const storeCounts = useMemo(() => {
    const m = new Map<string, number>();
    books.forEach(b => { if (b.store?.trim()) m.set(b.store.trim(), (m.get(b.store.trim()) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [books]);

  const formatCounts = useMemo(() => [
    { label: '📖 Físico',  count: books.filter(b => b.format === 'physical').length },
    { label: '📱 Digital', count: books.filter(b => b.format === 'digital').length },
  ].filter(f => f.count > 0), [books]);

  const languageCounts = useMemo(() => {
    const m = new Map<string, number>();
    books.forEach(b => { if (b.language?.trim()) m.set(b.language.trim(), (m.get(b.language.trim()) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [books]);

  // ─── Chart helpers ────────────────────────────────────────────────────────
  const WARM_PALETTE = [
    '#D4A72C', '#6B4423', '#B5463C', '#8F7A48', '#4A7C6F',
    '#7B5EA7', '#3D7AB8', '#C96E2D', '#5A9E5A', '#D4715C',
    '#9E6B84', '#5C7E9E',
  ];
  const tickColor = isDark ? '#8c8a88' : '#6b6868';
  const gridColor = isDark ? '#3c3a3e' : '#ddd9d1';
  const emptyBar  = isDark ? '#3c3a3e' : '#ddd9d1';

  // Plugin: labels above monthly bars
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barLabelPlugin = useMemo(() => ({
    id: 'barLabels',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDatasetsDraw(chart: any) {
      const { ctx, data } = chart;
      const meta = chart.getDatasetMeta(0);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = dark ? '#8c8a88' : '#6b6868';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta.data.forEach((bar: any, i: number) => {
        const v = data.datasets[0].data[i] as number;
        if (!v) return;
        const goal = goalValues[i];
        const pct  = goal > 0 ? Math.round((v / goal) * 100) : null;
        ctx.save();
        ctx.fillStyle = textColor;
        ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.toLocaleString('pt-BR'), bar.x, bar.y - 4);
        if (pct !== null) {
          ctx.fillStyle = pct >= 100
            ? (dark ? 'rgba(245,196,0,0.9)' : 'rgba(165,135,0,0.9)')
            : textColor;
          ctx.font = '500 9px Inter, sans-serif';
          ctx.fillText(`${pct}%`, bar.x, bar.y - 16);
        }
        ctx.restore();
      });
    },
  }), [goalValues]);

  // Plugin: labels above yearly bars
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yearBarPlugin = useMemo(() => ({
    id: 'yearBarLabels',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDatasetsDraw(chart: any) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = dark ? '#8c8a88' : '#6b6868';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta.data.forEach((bar: any, i: number) => {
        const v = yearlyEvolution[i]?.pages;
        if (!v) return;
        ctx.save();
        ctx.fillStyle = textColor;
        ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.toLocaleString('pt-BR'), bar.x, bar.y - 5);
        ctx.restore();
      });
    },
  }), [yearlyEvolution]);

  const chartData = {
    labels: MONTH_SHORT,
    datasets: [
      {
        data: monthlyBarValues,
        backgroundColor: monthlyBarValues.map((v, i) => {
          if (v === 0) return emptyBar;
          const g = goalValues[i];
          if (!g) return isDark ? 'rgba(245,196,0,0.85)' : 'rgba(245,196,0,0.70)';
          const pct = v / g;
          if (pct >= 1)   return isDark ? 'rgba(245,196,0,0.90)' : 'rgba(245,196,0,0.75)';
          if (pct >= 0.5) return isDark ? 'rgba(245,196,0,0.55)' : 'rgba(245,196,0,0.45)';
          return             isDark ? 'rgba(245,196,0,0.28)' : 'rgba(245,196,0,0.22)';
        }),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        type: 'line' as const,
        data: goalValues,
        borderColor: isDark ? 'rgba(245,196,0,0.28)' : 'rgba(180,155,0,0.35)',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 28 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { datasetIndex: number; raw: unknown }) =>
            ctx.datasetIndex === 1 ? `Meta: ${ctx.raw} págs` : `${ctx.raw} páginas`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 10 }, color: tickColor, maxRotation: 0 },
      },
      y: {
        grid: { color: gridColor },
        ticks: { font: { family: 'Inter', size: 10 }, color: tickColor, stepSize: Math.ceil(maxMonthly / 4) },
        min: 0,
        suggestedMax: Math.ceil(maxMonthly * 1.2),
      },
    },
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>

      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        {/* Título + subtítulo: grupo visual coeso */}
        <div className={styles.heroHeading}>
          <h1 className={styles.heroTitle}>Performance que conta uma história</h1>
          <p className={styles.heroSub}>Menos planilha e mais jornada</p>
        </div>

        {/* Seletor alinhado à última coluna (card Hoje) */}
        <div className={styles.heroToolbar}>
          <select
            className={`form-select ${styles.yearSelect}`}
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {totalPages > 0 && (
          <p className={styles.heroIntro}>
            <em>
              Sua jornada de leitura já acumula{' '}
              <span className={styles.heroIntroNum}>{totalPages.toLocaleString('pt-BR')}</span>
              {' passos em páginas.'}
            </em>
          </p>
        )}
      </div>

      {/* ─── Stat Cards (funil horizontal + destaque do dia) ─────────── */}
      <div className={styles.statFunnelGrid}>
        <StatCard
          label={`Páginas em ${selectedYear}`}
          value={yearPages.toLocaleString('pt-BR')}
          sub={goals.yearPages > 0
            ? `de ${goals.yearPages.toLocaleString('pt-BR')} • ${yearPct}%`
            : 'páginas no ano'}
          color="olive"
        />
        <StatCard
          label="Páginas no mês"
          value={monthPages.toLocaleString('pt-BR')}
          sub={currentMonthGoal > 0
            ? `de ${currentMonthGoal.toLocaleString('pt-BR')} • ${monthPct}%`
            : 'páginas no mês'}
          color="olive"
        />
        <StatCard
          label={`Livros lidos em ${selectedYear}`}
          value={String(booksYTD)}
          sub={booksYTD === 1 ? 'livro concluído' : 'livros concluídos'}
          color="gold"
          onClick={booksYTD > 0 ? () => setShowBooksModal(true) : undefined}
        />
        <StatCard
          label="Sequência atual"
          value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`}
          sub={streak > 0 ? 'Você está em uma sequência!' : 'Leia hoje para começar!'}
          color="gold"
        />
        <StatCard
          label="Hoje"
          value={todayPages > 0 ? todayPages.toLocaleString('pt-BR') : '—'}
          sub={todayPages > 0 ? 'páginas lidas' : 'Ainda não registrado'}
          color="gold"
          highlight={todayPages > 0}
        />
      </div>

      {/* ─── Mapa de atividade ───────────────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Mapa de atividade</h2>
        <div className={styles.heatmapScroll}>
          <div className={styles.heatmapContainer}>
            <div className={styles.monthLabels} style={{ gridTemplateColumns: `repeat(${weeks.length}, 13px)` }}>
              {monthLabelPositions.map(pos => (
                <span key={pos.col} className={styles.monthLabel} style={{ gridColumn: pos.col + 1 }}>
                  {pos.label}
                </span>
              ))}
            </div>
            <div className={styles.heatmapGrid} style={{ gridTemplateColumns: `repeat(${weeks.length}, 13px)` }}>
              {weeks.map((week, wi) =>
                week.map((day, di) => {
                  const isPast = !!day.date && day.date <= todayStr;
                  const hasPgs = day.pages > 0;
                  const dailyGoal = day.date
                    ? getMonthGoal(goals, parseInt(day.date.slice(0,4)), parseInt(day.date.slice(5,7))) / new Date(parseInt(day.date.slice(0,4)), parseInt(day.date.slice(5,7)), 0).getDate()
                    : 0;
                  const bg     = !day.date ? 'transparent'
                               : !isPast   ? 'transparent'
                               : hasPgs    ? getHeatmapColorGoal(day.pages, dailyGoal)
                               : 'rgba(255,255,255,0.06)';
                  const border = (day.date && isPast) ? '0.5px solid rgba(0,0,0,0.07)' : 'none';
                  return (
                    <div
                      key={`${wi}-${di}`}
                      className={styles.heatCell}
                      style={{ background: bg, border, gridRow: di + 1, gridColumn: wi + 1 }}
                      onMouseEnter={() => {
                        if (day.date && isPast) {
                          const label = `${toDisplayDate(day.date).slice(0, 5)} · ${day.pages > 0 ? `${day.pages} págs` : 'sem leitura'}`;
                          setHoverHint(label);
                        }
                      }}
                      onMouseLeave={() => setHoverHint(null)}
                    />
                  );
                })
              )}
            </div>
            <div className={styles.heatLegend}>
              {HEATMAP_LEGEND.map(({ bg, label }) => (
                <div
                  key={label}
                  className={styles.heatCell}
                  style={{ background: bg, border: '0.5px solid rgba(0,0,0,0.08)', cursor: 'default' }}
                  onMouseEnter={() => setHoverHint(label)}
                  onMouseLeave={() => setHoverHint(null)}
                />
              ))}
            </div>
            <div className={styles.heatHintRow}>
              <span className={`${styles.heatHintLeft} ${hoverHint ? styles.visible : ''}`}>
                {hoverHint || ''}
              </span>
              {daysPast > 0 && (
                <span>
                  {streak} {streak === 1 ? 'dia lendo' : 'dias lendo'}
                  {' · '}{daysPast} dias
                  {' · '}{Math.round((daysRead / daysPast) * 100)}% com leitura
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sua jornada ─────────────────────────────────────────────── */}
      {journeyData.some(d => d.pages > 0) && (
        <JourneySection data={journeyData} bestMonth={bestMonth} />
      )}

      {/* ─── Resumo por mês (bar chart) ──────────────────────────────── */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Resumo por mês</h2>
        <div className={styles.chartWrapper}>
          <Bar data={chartData as never} options={chartOptions as never} plugins={[barLabelPlugin as never]} />
        </div>
      </div>

      {/* ─── Por gênero ──────────────────────────────────────────────── */}
      {genreCounts.length > 0 && (() => {
        const total = genreCounts.reduce((s, [, c]) => s + c, 0);
        return (
          <div className={`card ${styles.section}`}>
            <h2 className={styles.sectionTitle}>Por gênero</h2>
            <div style={{
              display: 'flex', height: 20,
              borderRadius: 999, overflow: 'hidden',
              gap: 2, marginBottom: '1rem',
              background: 'var(--border-subtle)',
            }}>
              {genreCounts.map(([genre, count], i) => (
                <div
                  key={genre}
                  style={{ flex: count, background: WARM_PALETTE[i % WARM_PALETTE.length], minWidth: 3 }}
                  title={`${genre}: ${Math.round(count / total * 100)}%`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 1.1rem' }}>
              {genreCounts.map(([genre, count], i) => {
                const pct = Math.round(count / total * 100);
                return (
                  <div key={genre} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: WARM_PALETTE[i % WARM_PALETTE.length], flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{genre}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ─── Local · Formato · Idioma ────────────────────────────────── */}
      {(storeCounts.length > 0 || formatCounts.length > 0 || languageCounts.length > 0) && (
        <div className={styles.chartGrid3}>

          {storeCounts.length > 0 && (
            <div className={`card ${styles.section}`}>
              <h2 className={styles.sectionTitle}>Por local</h2>
              <div className={styles.doughnutWrapperSm}>
                <Doughnut
                  data={{
                    labels: storeCounts.map(([s]) => s),
                    datasets: [{
                      data: storeCounts.map(([, c]) => c),
                      backgroundColor: WARM_PALETTE.slice(2).map(c => c + 'CC'),
                      borderColor: isDark ? '#2a2826' : '#F5EFE3',
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          generateLabels: (chart: any) => {
                            const ds = chart.data.datasets[0];
                            const total: number = ds.data.reduce((s: number, v: number) => s + v, 0);
                            return chart.data.labels.map((label: string, i: number) => {
                              const val = ds.data[i] as number;
                              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                              const bg = ds.backgroundColor[i];
                              return { text: `${label} · ${pct}%`, fillStyle: bg, strokeStyle: bg, lineWidth: 0, hidden: false, index: i, datasetIndex: 0 };
                            });
                          },
                          font: { family: 'Inter', size: 10 }, color: tickColor, padding: 6, boxWidth: 10,
                        },
                      },
                      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} livro(s)` } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {formatCounts.length > 0 && (
            <div className={`card ${styles.section}`}>
              <h2 className={styles.sectionTitle}>Por formato</h2>
              <div className={styles.doughnutWrapperSm}>
                <Doughnut
                  data={{
                    labels: formatCounts.map(f => f.label),
                    datasets: [{
                      data: formatCounts.map(f => f.count),
                      backgroundColor: ['rgba(212,167,44,0.85)', 'rgba(107,68,35,0.80)'],
                      borderColor: isDark ? '#2a2826' : '#F5EFE3',
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          generateLabels: (chart: any) => {
                            const ds = chart.data.datasets[0];
                            const total: number = ds.data.reduce((s: number, v: number) => s + v, 0);
                            return chart.data.labels.map((label: string, i: number) => {
                              const val = ds.data[i] as number;
                              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                              const bg = ds.backgroundColor[i];
                              return { text: `${label} · ${pct}%`, fillStyle: bg, strokeStyle: bg, lineWidth: 0, hidden: false, index: i, datasetIndex: 0 };
                            });
                          },
                          font: { family: 'Inter', size: 10 }, color: tickColor, padding: 6, boxWidth: 10,
                        },
                      },
                      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} livro(s)` } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {languageCounts.length > 0 && (
            <div className={`card ${styles.section}`}>
              <h2 className={styles.sectionTitle}>Por idioma</h2>
              <div className={styles.doughnutWrapperSm}>
                <Doughnut
                  data={{
                    labels: languageCounts.map(([l]) => l),
                    datasets: [{
                      data: languageCounts.map(([, c]) => c),
                      backgroundColor: WARM_PALETTE.map(c => c + 'CC'),
                      borderColor: isDark ? '#2a2826' : '#F5EFE3',
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          generateLabels: (chart: any) => {
                            const ds = chart.data.datasets[0];
                            const total: number = ds.data.reduce((s: number, v: number) => s + v, 0);
                            return chart.data.labels.map((label: string, i: number) => {
                              const val = ds.data[i] as number;
                              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                              const bg = ds.backgroundColor[i];
                              return { text: `${label} · ${pct}%`, fillStyle: bg, strokeStyle: bg, lineWidth: 0, hidden: false, index: i, datasetIndex: 0 };
                            });
                          },
                          font: { family: 'Inter', size: 10 }, color: tickColor, padding: 6, boxWidth: 10,
                        },
                      },
                      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} livro(s)` } },
                    },
                  }}
                />
              </div>
            </div>
          )}

        </div>
      )}

      {/* ─── Páginas por ano (bar chart · título = total histórico) ──── */}
      {yearlyEvolution.length >= 1 && (
        <div className={`card ${styles.section}`}>
          <div className={styles.yearChartHeader}>
            <div>
              <p className={styles.yearChartTotal}>{totalPages.toLocaleString('pt-BR')}</p>
              <p className={styles.yearChartTotalSub}>Número que expressa sua história em páginas até agora</p>
            </div>
            <span className={styles.yearChartLabel}>Páginas por ano</span>
          </div>
          <div className={styles.chartWrapper} style={{ marginTop: '1rem' }}>
            <Bar
              data={{
                labels: yearlyEvolution.map(d => String(d.year)),
                datasets: [{
                  data: yearlyEvolution.map(d => d.pages),
                  backgroundColor: yearlyEvolution.map((_, i) =>
                    i === yearlyEvolution.length - 1
                      ? (isDark ? 'rgba(245,196,0,0.90)' : 'rgba(245,196,0,0.80)')
                      : (isDark ? 'rgba(245,196,0,0.40)' : 'rgba(245,196,0,0.35)')
                  ),
                  borderRadius: 5,
                  borderSkipped: false,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 24 } },
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => `${(ctx.raw as number).toLocaleString('pt-BR')} páginas` } },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter', size: 11 }, color: tickColor },
                  },
                  y: {
                    grid: { color: gridColor },
                    ticks: { font: { family: 'Inter', size: 10 }, color: tickColor },
                    min: 0,
                  },
                },
              }}
              plugins={[yearBarPlugin as never]}
            />
          </div>
        </div>
      )}

      {/* ─── Conquistas + Insight (lado a lado) ──────────────────────── */}
      <div className={styles.twoCol}>
        <div className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>Suas conquistas este ano</h2>
          <AchievementsTrack achievements={yearAchievements} />
        </div>
        {bestMonth.pages > 0 && (
          <InsightPanel
            bestMonth={bestMonth}
            bestMonthGoal={getMonthGoal(goals, selectedYear, bestMonth.month)}
          />
        )}
      </div>

      {/* ─── Próximo capítulo + Isso me marcou (lado a lado) ────────── */}
      <div className={styles.twoCol}>
        {selectedYear === currentYear && currentMonthGoal > 0 && (
          <NextChapterPanel month={month} monthPages={monthPages} monthGoal={currentMonthGoal} />
        )}
        <div
          className={`card ${styles.section} ${styles.quoteSection} ${quotePool.length > 1 ? styles.quoteSectionTappable : ''}`}
          onClick={advanceQuote}
          role={quotePool.length > 1 ? 'button' : undefined}
          title={quotePool.length > 1 ? 'Toque para ver outro trecho' : undefined}
        >
          {currentQuote ? (
            <div className={`${styles.quoteCard} ${typed !== null ? styles.quoteTyping : ''}`}>
              <p className={styles.quoteText}>"{typed ?? currentQuote.text}"</p>
              <p className={styles.quoteAttrib}>
                — {currentQuote.title}
                {currentQuote.author ? ` · ${currentQuote.author}` : ''}
              </p>
              {quotePool.length > 1 && (
                <span className={styles.quoteTapHint}>toque para outro</span>
              )}
            </div>
          ) : (
            <p className={styles.quotePlaceholder}>
              Escreva algo que tenha te marcado para reler aqui, será sua surpresa boa do dia.
            </p>
          )}
        </div>
      </div>

      {/* ─── CTA próximas leituras ────────────────────────────────────── */}
      {onNavigateToNextReads && (
        <button className={styles.nextReadsCTA} onClick={onNavigateToNextReads}>
          Mantenha sua lista de próximas leituras atualizada!
        </button>
      )}

      {/* ─── Modal: livros lidos no ano ───────────────────────────────── */}
      {showBooksModal && (
        <div
          className={styles.booksModalOverlay}
          onClick={e => { if (e.target === e.currentTarget) setShowBooksModal(false); }}
        >
          <div className={styles.booksModal}>
            <div className={styles.booksModalHeader}>
              <h2 className={styles.booksModalTitle}>
                Livros lidos em {selectedYear}
                <span className={styles.booksModalCount}>{booksReadInYear.length}</span>
              </h2>
              <button
                className={styles.booksModalClose}
                onClick={() => setShowBooksModal(false)}
                aria-label="Fechar"
              >×</button>
            </div>
            <div className={styles.booksModalBody}>
              {booksReadInYear.map(book => (
                <div key={book.id} className={styles.booksModalItem}>
                  {book.cover ? (
                    <img src={book.cover} alt="" className={styles.booksModalCover} />
                  ) : (
                    <div className={styles.booksModalCoverPlaceholder}>📖</div>
                  )}
                  <div className={styles.booksModalInfo}>
                    <p className={styles.booksModalBookTitle}>{book.title}</p>
                    <p className={styles.booksModalAuthor}>{book.author}</p>
                    <p className={styles.booksModalMeta}>
                      {book.startDate && toDisplayDate(book.startDate)}
                      {book.startDate && book.endDate && ' → '}
                      {book.endDate && toDisplayDate(book.endDate)}
                      {book.pages > 0 && (
                        <span className={styles.booksModalPages}>
                          · {book.pages.toLocaleString('pt-BR')} páginas
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, highlight, onClick }: {
  label: string; value: string; sub: string; color: 'olive' | 'gold'; highlight?: boolean; onClick?: () => void;
}) {
  const isChocolate = !!onClick;

  const cardStyle = isChocolate
    ? { background: 'rgba(245, 196, 0, 0.18)' }
    : highlight
    ? { background: 'var(--accent-surface)', boxShadow: 'var(--shadow-md)' }
    : undefined;

  const labelStyle = isChocolate
    ? { color: 'var(--accent-text-hover)' }
    : highlight
    ? { color: 'rgba(26,22,20,0.6)' }
    : undefined;

  const valueStyle = {
    color: isChocolate ? 'var(--accent-text-hover)' : highlight ? '#1A1614' : color === 'gold' ? 'var(--gold)' : 'var(--olive)',
  };

  const subStyle = isChocolate
    ? { color: 'var(--accent-text-hover)', opacity: 0.7 }
    : highlight
    ? { color: 'rgba(26,22,20,0.65)' }
    : undefined;

  return (
    <div
      className={`card ${styles.statCard} ${isChocolate ? styles.statCardClickable : ''}`}
      style={cardStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <span className="label" style={labelStyle}>{label}</span>
      <div className={styles.statValue} style={valueStyle}>{value}</div>
      <div className={styles.statSub} style={subStyle}>{sub}</div>
    </div>
  );
}

// ─── Journey Section ─────────────────────────────────────────────────────────
interface JourneyMonth { month: number; pages: number; goal: number; }

function JourneySection({ data, bestMonth }: {
  data: JourneyMonth[];
  bestMonth: { month: number; pages: number };
}) {
  const nonZero = data.filter(d => d.pages > 0);
  if (nonZero.length === 0) return null;

  const maxPages = Math.max(...data.map(d => d.pages), 1);
  const bestIdx  = data.findIndex(d => d.month === bestMonth.month && d.pages === bestMonth.pages);

  const narratives = data.map((d, i) => {
    if (d.pages === 0) return 'uma pausa — você volta!';
    if (i === bestIdx) return 'seu melhor mês!';
    if (i > 0 && data[i - 1].pages === 0) return 'de volta às páginas';
    if (d === nonZero[0]) return 'e assim começa';
    const goal = d.goal || 0;
    if (goal > 0 && d.pages >= goal) return 'meta batida!';
    if (goal > 0 && d.pages >= goal * 0.7) return 'quase na meta';
    return 'seguindo em frente';
  });

  const getSize = (pages: number) =>
    pages === 0 ? 26 : Math.round(28 + (pages / maxPages) * 40);

  const getCircleColor = (pages: number, idx: number) => {
    if (pages === 0) return 'var(--border)';
    if (idx === bestIdx) return 'var(--accent-text)';
    const ratio = pages / maxPages;
    if (ratio >= 0.7) return 'var(--accent-surface)';
    if (ratio >= 0.4) return '#C49B30';
    return '#C4AE70';
  };

  const firstNonZero = nonZero[0];
  const multiplier = firstNonZero && firstNonZero.month !== bestMonth.month && firstNonZero.pages > 0
    ? (bestMonth.pages / firstNonZero.pages).toFixed(1)
    : null;

  return (
    <div className={`card ${styles.section}`}>
      <h2 className={styles.sectionTitle}>Sua jornada</h2>
      <p className={styles.journeyHint}>
        Seus passos representados: o tamanho mostra páginas, a legenda explica o que aconteceu.
      </p>
      <div className={styles.journeyRow}>
        <div className={styles.journeyScroll}>
          <div className={styles.journeyTrack}>
            <div className={styles.journeyLine} />
            {data.map((d, i) => {
              const size      = getSize(d.pages);
              const color     = getCircleColor(d.pages, i);
              const narrative = narratives[i];
              const isBest    = i === bestIdx;
              return (
                <div key={i} className={styles.journeyItem}>
                  <span className={styles.journeyPages}>
                    {d.pages > 0 ? d.pages.toLocaleString('pt-BR') : ''}
                  </span>
                  <div
                    className={`${styles.journeyCircle} ${isBest ? styles.journeyCircleBest : ''}`}
                    style={{ width: size, height: size, background: color }}
                  >
                    <span
                      className={styles.journeyMonthLabel}
                      style={{
                        color: d.pages === 0 ? 'var(--warm-gray)' : 'white',
                        fontSize: size < 40 ? '0.6rem' : '0.75rem',
                      }}
                    >
                      {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}
                    </span>
                  </div>
                  <span className={`${styles.journeyNarrative} ${isBest ? styles.journeyNarrativeBold : ''}`}>
                    {narrative}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {multiplier && parseFloat(multiplier) > 1.2 && (
          <div className={styles.viradaCard}>
            <span className={styles.viradaLabel}>Virada da história</span>
            <p className={styles.viradaText}>
              {getMonthFullName(bestMonth.month)} foi {multiplier}x {getMonthFullName(firstNonZero.month).toLowerCase()}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Achievements Track ───────────────────────────────────────────────────────
function AchievementsTrack({ achievements }: {
  achievements: { id: string; icon: string; title: string; unlocked: boolean }[];
}) {
  return (
    <div className={styles.achievementsTrack}>
      <div className={styles.achievementsConnector} />
      {achievements.map(a => (
        <div key={a.id} className={styles.achievementItem}>
          <div className={`${styles.achievementDot} ${a.unlocked ? styles.achievementDotUnlocked : ''}`}>
            <span className={styles.achievementIcon}>{a.icon}</span>
          </div>
          <span className={`${styles.achievementDotLabel} ${!a.unlocked ? styles.achievementDotLabelMuted : ''}`}>
            {a.title}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Insight Panel ────────────────────────────────────────────────────────────
function InsightPanel({ bestMonth, bestMonthGoal }: {
  bestMonth: { month: number; pages: number };
  bestMonthGoal: number;
}) {
  const pct = bestMonthGoal > 0 ? Math.round((bestMonth.pages / bestMonthGoal) * 100) : null;
  return (
    <div className={styles.insightCard}>
      <h3 className={styles.insightTitle}>
        {getMonthFullName(bestMonth.month)} foi seu melhor mês.
      </h3>
      <p className={styles.insightSub}>
        {bestMonth.pages.toLocaleString('pt-BR')} páginas lidas
        {pct !== null ? ` — ${pct}% da meta mensal.` : '.'}
      </p>
    </div>
  );
}

// ─── Next Chapter Panel ───────────────────────────────────────────────────────
function NextChapterPanel({ month, monthPages, monthGoal }: {
  month: number;
  monthPages: number;
  monthGoal: number;
}) {
  const goalMet     = monthGoal > 0 && monthPages >= monthGoal;
  const targetMonth = goalMet ? month + 1 : month;
  if (targetMonth > 12) return null;

  return (
    <div className={`card ${styles.section} ${styles.nextChapterCard}`}>
      <h2 className={styles.sectionTitle}>Meu próximo capítulo</h2>
      <p className={styles.nextChapterText}>
        {goalMet ? 'Conquistar' : 'Fechar'}{' '}
        {getMonthFullName(targetMonth).toLowerCase()} com {monthGoal.toLocaleString('pt-BR')} páginas.
      </p>
    </div>
  );
}
