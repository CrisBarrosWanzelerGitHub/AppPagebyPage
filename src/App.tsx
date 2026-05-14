import { useState, useCallback, useEffect, useRef } from 'react';
import { useReadingData } from './hooks/useReadingData';
import type { Toast as ToastType } from './types';
import { getAchievements } from './utils/metrics';
import { fireAchievementConfetti } from './utils/confetti';
import Dashboard from './components/Dashboard';
import Library from './components/Library';
import Libraries from './components/Libraries';
import LogTab from './components/LogTab';
import History from './components/History';
import Achievements from './components/Achievements';
import Settings from './components/Settings';
import Toast from './components/Toast';
import AddBookModal from './components/AddBookModal';
import styles from './App.module.css';

type TabId = 'dashboard' | 'library' | 'nextreads' | 'libraries' | 'log' | 'history' | 'achievements' | 'settings';

const TABS: { id: TabId; label: string; icon: string; iconSize?: string }[] = [
  { id: 'dashboard',    label: 'Hoje',               icon: '⌂',  iconSize: '1.2rem' },
  { id: 'library',      label: 'Biblioteca',         icon: '▤' },
  { id: 'nextreads',    label: 'Próximas leituras',  icon: '☆' },
  { id: 'libraries',    label: 'Locais',             icon: '◫' },
  { id: 'log',          label: 'Registros',          icon: '◎' },
  { id: 'history',      label: 'Performance',        icon: '∿' },
  { id: 'achievements', label: 'Conquistas',         icon: '◇' },
  { id: 'settings',     label: 'Configurações',      icon: '⚙︎' },
];

const ALL_TAB_IDS = TABS.map(t => t.id);

function loadTabOrder(): TabId[] {
  try {
    const saved = localStorage.getItem('pbp-tab-order');
    if (saved) {
      const order = JSON.parse(saved) as TabId[];
      // Valida: deve conter exatamente os IDs atuais
      if (order.length === ALL_TAB_IDS.length && ALL_TAB_IDS.every(id => order.includes(id))) {
        return order;
      }
    }
  } catch { /* ignore */ }
  return ALL_TAB_IDS;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [logTabBookId, setLogTabBookId] = useState<string | null>(null);
  const [logTabResetKey, setLogTabResetKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const data = useReadingData();

  // ── Reordenação de abas ──
  const [tabOrder, setTabOrder]           = useState<TabId[]>(loadTabOrder);
  const [tabDragId, setTabDragId]         = useState<TabId | null>(null);
  const [tabDragOverId, setTabDragOverId] = useState<TabId | null>(null);
  const [tabDropSide, setTabDropSide]     = useState<'before' | 'after'>('before');

  const orderedTabs = TABS.slice().sort(
    (a, b) => tabOrder.indexOf(a.id) - tabOrder.indexOf(b.id)
  );

  function handleTabDragStart(id: TabId, e: React.DragEvent) {
    setTabDragId(id);

    // Ghost customizado: parece um card flutuando com o ícone + label da aba
    const tab = TABS.find(t => t.id === id)!;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const ghost = document.createElement('div');
    ghost.style.cssText = [
      'position:fixed',
      'top:-9999px',
      'left:-9999px',
      `background:${isDark ? '#2a2820' : '#fffcf5'}`,
      `color:${isDark ? '#f0ebe0' : '#2c2a27'}`,
      `border:1px solid ${isDark ? '#3a3830' : '#e8e0d0'}`,
      'border-radius:10px',
      'padding:0.5rem 1rem 0.5rem 0.75rem',
      'display:flex',
      'align-items:center',
      'gap:0.45rem',
      'font-size:0.82rem',
      'font-weight:600',
      'white-space:nowrap',
      'box-shadow:0 6px 20px rgba(0,0,0,0.18)',
      'pointer-events:none',
    ].join(';');

    ghost.innerHTML = `
      <svg width="6" height="10" viewBox="0 0 6 10" fill="${isDark ? '#888' : '#aaa'}" style="flex-shrink:0">
        <circle cx="1.5" cy="1.5" r="1"/><circle cx="4.5" cy="1.5" r="1"/>
        <circle cx="1.5" cy="5"   r="1"/><circle cx="4.5" cy="5"   r="1"/>
        <circle cx="1.5" cy="8.5" r="1"/><circle cx="4.5" cy="8.5" r="1"/>
      </svg>
      <span style="font-size:${tab.iconSize ?? '0.88rem'}">${tab.icon}</span>
      <span>${tab.label}</span>
    `;

    document.body.appendChild(ghost);
    // Força reflow para medir as dimensões reais antes de usar como ghost
    const w = ghost.offsetWidth;
    const h = ghost.offsetHeight;
    e.dataTransfer.setDragImage(ghost, w / 2, h / 2);
    requestAnimationFrame(() => ghost.remove());
  }

  function handleTabDragOver(e: React.DragEvent, id: TabId) {
    e.preventDefault();
    // Detecta em qual metade horizontal da aba o cursor está
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    setTabDragOverId(id);
    setTabDropSide(side);
  }

  function handleTabDrop(targetId: TabId) {
    if (!tabDragId || tabDragId === targetId) { resetTabDrag(); return; }
    const next = [...tabOrder];
    const from = next.indexOf(tabDragId);
    next.splice(from, 1);                       // remove primeiro
    const to = next.indexOf(targetId);          // recalcula índice após remoção
    const insertAt = tabDropSide === 'after' ? to + 1 : to;
    next.splice(insertAt, 0, tabDragId);
    setTabOrder(next);
    localStorage.setItem('pbp-tab-order', JSON.stringify(next));
    resetTabDrag();
  }

  function resetTabDrag() {
    setTabDragId(null);
    setTabDragOverId(null);
  }

  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('pbp-theme');
    if (saved) return saved === 'dark';
    return false; // default: light mode na primeira visita
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('pbp-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // ─── Atalho de teclado: "N" abre o modal de cadastro ──────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowAddBook(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = useCallback((
    message: string,
    type: ToastType['type'] = 'success',
    options?: { undo?: () => void; onExpire?: () => void; countdown?: number; onConfirm?: () => void; confirmLabel?: string },
  ) => {
    const id = crypto.randomUUID();
    const { undo, onExpire, countdown, onConfirm, confirmLabel } = options ?? {};
    setToasts(t => [...t, { id, message, type, undo, onExpire, countdown, onConfirm, confirmLabel }]);
    const duration = countdown ?? (undo ? 7000 : 3200);
    setTimeout(() => {
      setToasts(prev => {
        const toast = prev.find(x => x.id === id);
        toast?.onExpire?.();
        return prev.filter(x => x.id !== id);
      });
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // ─── Achievement unlock detection ────────────────────────────────────────
  // null = not yet initialised (first render); after that, a Set of unlocked ids
  const prevUnlockedRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const year = new Date().getFullYear();
    const achievements = getAchievements(data.state.logs, data.state.goals, year);
    const nowUnlocked   = new Set(achievements.filter(a => a.unlocked).map(a => a.id));

    if (prevUnlockedRef.current === null) {
      // First render — just snapshot current state, no celebration
      prevUnlockedRef.current = nowUnlocked;
      return;
    }

    const newlyUnlocked = achievements.filter(
      a => a.unlocked && !prevUnlockedRef.current!.has(a.id)
    );

    if (newlyUnlocked.length > 0) {
      fireAchievementConfetti();
      newlyUnlocked.forEach(ach => {
        showToast(`◇ Conquista desbloqueada: ${ach.title}!`);
      });
    }

    prevUnlockedRef.current = nowUnlocked;
  }, [data.state.logs, data.state.goals, showToast]);
  // ─────────────────────────────────────────────────────────────────────────

  const tabProps = { ...data, showToast };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand} onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }} title="Ir para Hoje" role="button" aria-label="Ir para página principal">
            {/* Open book logo */}
            <svg
              className={styles.brandLogo}
              viewBox="0 0 48 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Left page */}
              <path
                d="M24 32 C24 32 10 27 2 29 L2 4 C10 2 24 8 24 8 Z"
                fill="currentColor"
                opacity="0.85"
              />
              {/* Right page */}
              <path
                d="M24 32 C24 32 38 27 46 29 L46 4 C38 2 24 8 24 8 Z"
                fill="currentColor"
              />
              {/* Spine line */}
              <line x1="24" y1="8" x2="24" y2="32" stroke="var(--bg-surface)" strokeWidth="1.5"/>
            </svg>
            <div className={styles.brandText}>
              <span className={styles.brandName}>PageByPage</span>
              <span className={styles.brandTagline}>Não é sobre quantidade. É sobre constância.</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className={styles.themeToggle}
              onClick={() => setDark(d => !d)}
              title={dark ? 'Modo claro' : 'Modo escuro'}
              aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {dark ? '☀︎' : <span style={{ display: 'inline-block', transform: 'rotate(15deg)' }}>☽</span>}
            </button>
            <button
              className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
              onClick={() => setMenuOpen(m => !m)}
              aria-label="Menu de navegação"
              aria-expanded={menuOpen}
            >
              <span className={styles.hLine} />
              <span className={styles.hLine} />
              <span className={styles.hLine} />
            </button>
          </div>
        </div>
      </header>

      {/* Frosted glass frame — position:fixed garante backdrop-filter sem conflito */}
      <div className={styles.navBlurFrame} aria-hidden="true" />

      <nav className={styles.nav} aria-label="Navegação principal">
        <div className={styles.navScroll}>
        <div className={styles.navInner}>
          {orderedTabs.map(tab => (
            <button
              key={tab.id}
              draggable
              className={[
                styles.navTab,
                activeTab === tab.id ? styles.navTabActive : '',
                tabDragId === tab.id ? styles.navTabDragging : '',
                tabDragOverId === tab.id && tabDragId !== tab.id
                  ? tabDropSide === 'before' ? styles.navTabDropBefore : styles.navTabDropAfter
                  : '',
              ].filter(Boolean).join(' ')}
              onDragStart={e => handleTabDragStart(tab.id, e)}
              onDragOver={e => handleTabDragOver(e, tab.id)}
              onDrop={() => handleTabDrop(tab.id)}
              onDragEnd={resetTabDrag}
              onClick={() => {
                if (tab.id === 'log') {
                  setLogTabBookId(null);
                  if (activeTab === 'log') setLogTabResetKey(k => k + 1);
                }
                setActiveTab(tab.id);
              }}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className={styles.navGrip} aria-hidden="true">
                <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor">
                  <circle cx="1.5" cy="1.5" r="1"/><circle cx="4.5" cy="1.5" r="1"/>
                  <circle cx="1.5" cy="5"   r="1"/><circle cx="4.5" cy="5"   r="1"/>
                  <circle cx="1.5" cy="8.5" r="1"/><circle cx="4.5" cy="8.5" r="1"/>
                </svg>
              </span>
              <span className={styles.navIcon} aria-hidden="true" style={tab.iconSize ? { fontSize: tab.iconSize, transform: 'translateY(-2px)' } : undefined}>{tab.icon}</span>
              <span className={styles.navLabel}>{tab.label}</span>
            </button>
          ))}
        </div>
        </div>
      </nav>

      {/* ─── Mobile Menu ───────────────────────────────────────────────── */}
      {menuOpen && (
        <>
          <div className={styles.mobileMenuOverlay} onClick={() => setMenuOpen(false)} />
          <nav className={styles.mobileMenu} aria-label="Menu mobile">
            {orderedTabs.map(tab => (
              <button
                key={tab.id}
                className={`${styles.mobileMenuItem} ${activeTab === tab.id ? styles.mobileMenuItemActive : ''}`}
                onClick={() => {
                  if (tab.id === 'log') {
                    setLogTabBookId(null);
                    if (activeTab === 'log') setLogTabResetKey(k => k + 1);
                  }
                  setActiveTab(tab.id);
                  setMenuOpen(false);
                }}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <span className={styles.mobileMenuIcon} aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
            <a
              href="mailto:pagebypageapp@gmail.com"
              className={styles.mobileMenuSupport}
              onClick={() => setMenuOpen(false)}
            >
              <span className={styles.mobileMenuIcon} aria-hidden="true">✉</span>
              <span>Suporte, elogios e sugestões</span>
            </a>
          </nav>
        </>
      )}

      <main className={styles.main}>
        <div className={styles.content}>
          {activeTab === 'dashboard'    && <Dashboard    {...tabProps} onNavigateToLog={(bookId?: string) => { if (bookId) setLogTabBookId(bookId); setActiveTab('log'); }} onNavigateToLibraries={() => setActiveTab('libraries')} onNavigateToPerformance={() => setActiveTab('history')} />}
          {activeTab === 'library'      && <Library      {...tabProps} onNavigateToLog={(bookId?: string) => { if (bookId) setLogTabBookId(bookId); setActiveTab('log'); }} />}
          {activeTab === 'nextreads'    && <Library      {...tabProps} initialStatus="want" onNavigateToLog={(bookId?: string) => { if (bookId) setLogTabBookId(bookId); setActiveTab('log'); }} />}
          {activeTab === 'libraries'    && <Libraries    libraries={data.state.libraries ?? []} addLibrary={data.addLibrary} updateLibrary={data.updateLibrary} deleteLibrary={data.deleteLibrary} showToast={showToast} />}
          {activeTab === 'log'          && <LogTab       {...tabProps} key={logTabResetKey} initialBookId={logTabBookId ?? undefined} />}
          {activeTab === 'history'      && <History      {...tabProps} onNavigateToNextReads={() => setActiveTab('nextreads')} onNavigateToToday={() => setActiveTab('dashboard')} />}
          {activeTab === 'achievements' && <Achievements {...tabProps} />}
          {activeTab === 'settings'     && <Settings     {...tabProps} />}
        </div>
      </main>

      <Toast toasts={toasts} onRemove={removeToast} />

      {/* ─── FAB global ───────────────────────────────────────────────── */}
      <button
        className={styles.fab}
        onClick={() => setShowAddBook(true)}
        title="Adicionar livro (N)"
        aria-label="Adicionar livro"
      >
        +
      </button>

      {showAddBook && (
        <AddBookModal
          existingTags={Array.from(new Set(data.state.books.flatMap(b => b.tags))).sort()}
          existingStores={Array.from(new Set(data.state.books.map(b => b.store).filter((s): s is string => !!s))).sort()}
          existingGenres={Array.from(new Set(data.state.books.map(b => b.genre).filter(Boolean))).sort()}
          onClose={() => setShowAddBook(false)}
          onAdd={(book) => {
            data.addBook(book);
            setShowAddBook(false);
            showToast('Livro adicionado!');
          }}
        />
      )}
    </div>
  );
}
