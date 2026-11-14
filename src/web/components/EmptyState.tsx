import { useApp } from '../data.ts';

export function EmptyState() {
  const { status, reload } = useApp();
  if (status === 'loading') {
    return (
      <div class="empty" role="status">
        <p>Načítám předpověď…</p>
      </div>
    );
  }
  return (
    <div class="empty" role="alert">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
        <path d="M2 9c3-3 5 3 8 0s5 3 8 0 3-1 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3-1 4 0" />
      </svg>
      <h2>Předpověď se nepodařilo načíst</h2>
      <p>Data zatím nejsou k dispozici. Zkontrolujte připojení a zkuste to znovu za chvíli.</p>
      <button type="button" class="btn" onClick={reload}>
        Zkusit znovu
      </button>
    </div>
  );
}
