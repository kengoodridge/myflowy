const DEFAULT_IDLE_RESYNC_MS = 60_000;

export function getIdleResyncMs(env: Record<string, unknown> = import.meta.env): number {
  const value = env.VITE_IDLE_RESYNC_MS;
  if (typeof value !== 'string' || value.trim() === '') return DEFAULT_IDLE_RESYNC_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_IDLE_RESYNC_MS;
  return parsed;
}

