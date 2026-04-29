import { useMemo } from 'react';
import type { AppState } from '../types';
import { getAchievements } from '../utils/metrics';
import styles from './Achievements.module.css';

interface Props {
  state: AppState;
  [key: string]: unknown;
}

export default function Achievements({ state }: Props) {
  const { logs, goals } = state;
  const year = new Date().getFullYear();

  const achievements = useMemo(
    () => getAchievements(logs, goals, year),
    [logs, goals, year]
  );

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Conquistas</h2>
        <p className={styles.subtitle}>
          Conquistas anuais e mensais. Meta anual:{' '}
          <strong>{goals.yearPages.toLocaleString('pt-BR')} páginas</strong> · mensal:{' '}
          <strong>{goals.monthPages.toLocaleString('pt-BR')} páginas</strong>.
        </p>
      </div>

      <div className={styles.grid}>
        {achievements.map(ach => (
          <div
            key={ach.id}
            className={`${styles.card} ${ach.unlocked ? styles.unlocked : styles.locked}`}
          >
            <div className={styles.iconWrapper}>
              <span className={styles.icon}>{ach.icon}</span>
              {!ach.unlocked && <span className={styles.lockOverlay}>⊘</span>}
            </div>
            <div className={styles.info}>
              <div className={styles.achTitle}>{ach.title}</div>
              <div className={styles.achDesc}>{ach.description}</div>
              {ach.unlocked ? (
                <div className={styles.status}>
                  <span className={styles.statusUnlocked}>✓ Conquistado!</span>
                </div>
              ) : (
                <div className={styles.status}>
                  <span className={styles.statusLocked}>
                    Faltam {ach.pagesNeeded.toLocaleString('pt-BR')} páginas
                  </span>
                  <div className="progress-bar" style={{ marginTop: '0.4rem' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: (() => {
                          const total = ach.type === 'monthly'
                            ? (ach.target ?? goals.monthPages)
                            : goals.yearPages * ach.threshold / 100;
                          return `${Math.min(100, Math.round(((total - ach.pagesNeeded) / total) * 100))}%`;
                        })(),
                        background: 'var(--warm-gray)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
