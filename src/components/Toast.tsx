import type { Toast as ToastType } from '../types';
import styles from './Toast.module.css';

interface Props {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

export default function Toast({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      {toasts.map(toast => {
        if (toast.type === 'delete') {
          return (
            <div key={toast.id} className={`${styles.toast} ${styles.deleteToast}`}>
              <div className={styles.deleteBody}>
                <span className={styles.icon}>⚠</span>
                <span className={styles.message}>{toast.message}</span>
              </div>
              <div className={styles.deleteActions}>
                <button
                  className={styles.undoBtnDark}
                  onClick={() => onRemove(toast.id)}
                >
                  Cancelar
                </button>
                {toast.onConfirm && (
                  <button
                    className={styles.confirmBtn}
                    onClick={() => { toast.onConfirm!(); onRemove(toast.id); }}
                  >
                    {toast.confirmLabel ?? 'Confirmar'}
                  </button>
                )}
              </div>
              {toast.countdown && (
                <div className={styles.countdownTrack}>
                  <div
                    className={styles.countdownBar}
                    style={{ animationDuration: `${toast.countdown}ms` }}
                  />
                </div>
              )}
            </div>
          );
        }

        return (
          <div
            key={toast.id}
            className={`${styles.toast} ${toast.type === 'error' ? styles.error : styles.success}`}
          >
            <span className={styles.icon}>{toast.type === 'error' ? '✕' : '✓'}</span>
            <span className={styles.message}>{toast.message}</span>
            {toast.undo && (
              <button
                className={styles.undoBtn}
                onClick={() => { toast.undo!(); onRemove(toast.id); }}
              >
                Desfazer
              </button>
            )}
            <button className={styles.close} onClick={() => onRemove(toast.id)} aria-label="Fechar">×</button>
          </div>
        );
      })}
    </div>
  );
}
