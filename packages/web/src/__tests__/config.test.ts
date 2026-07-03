import { describe, expect, it } from 'vitest';
import { getIdleResyncMs } from '../config';

describe('getIdleResyncMs', () => {
  it('defaults to 1 minute when unset', () => {
    expect(getIdleResyncMs({})).toBe(60_000);
  });

  it('uses VITE_IDLE_RESYNC_MS when valid', () => {
    expect(getIdleResyncMs({ VITE_IDLE_RESYNC_MS: '90000' })).toBe(90_000);
  });

  it('falls back when override is invalid', () => {
    expect(getIdleResyncMs({ VITE_IDLE_RESYNC_MS: 'abc' })).toBe(60_000);
    expect(getIdleResyncMs({ VITE_IDLE_RESYNC_MS: '-5' })).toBe(60_000);
  });
});

