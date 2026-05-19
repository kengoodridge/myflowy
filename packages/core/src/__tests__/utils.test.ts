import { describe, it, expect } from 'vitest';
import { uuid, initialRoot } from '../utils';

describe('uuid', () => {
  it('returns a v4-shaped string', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns unique values', () => {
    expect(uuid()).not.toBe(uuid());
  });
});

describe('initialRoot', () => {
  it('returns a root task with id "root"', () => {
    const root = initialRoot();
    expect(root.id).toBe('root');
    expect(root.children).toEqual([]);
    expect(root.checked).toBe(false);
  });
});
