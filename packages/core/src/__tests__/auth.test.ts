import { describe, it, expect, beforeEach } from 'vitest';
import { getAccessToken, setAccessToken, clearAccessToken } from '../auth';

describe('auth tokens', () => {
  beforeEach(() => clearAccessToken());

  it('returns null when no token set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('returns token after setAccessToken', () => {
    setAccessToken('tok-abc');
    expect(getAccessToken()).toBe('tok-abc');
  });

  it('returns null after clearAccessToken', () => {
    setAccessToken('tok-abc');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});
