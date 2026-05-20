import { describe, it, expect } from 'vitest';
import { getVisibleOrder, findParent } from '../utils/treeUtils';
import type { TaskMap } from '@myflowy/core';

function makeTask(id: string, children: string[] = [], collapsed = false) {
  return { id, text: id, checked: false, pinned: false, collapsed, children };
}

describe('getVisibleOrder', () => {
  it('returns all non-root tasks in DFS order', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a', 'b']),
      a: makeTask('a', ['c']),
      b: makeTask('b'),
      c: makeTask('c'),
    };
    expect(getVisibleOrder('root', tasks)).toEqual(['a', 'c', 'b']);
  });

  it('skips children of collapsed tasks', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a', 'b']),
      a: makeTask('a', ['c'], true),
      b: makeTask('b'),
      c: makeTask('c'),
    };
    expect(getVisibleOrder('root', tasks)).toEqual(['a', 'b']);
  });

  it('returns empty array for root with no children', () => {
    const tasks: TaskMap = {
      root: makeTask('root', []),
    };
    expect(getVisibleOrder('root', tasks)).toEqual([]);
  });

  it('skips missing task ids gracefully', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a', 'ghost']),
      a: makeTask('a'),
    };
    expect(getVisibleOrder('root', tasks)).toEqual(['a']);
  });
});

describe('findParent', () => {
  it('finds the parent of a task', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a']),
      a: makeTask('a', ['b']),
      b: makeTask('b'),
    };
    expect(findParent('b', tasks)).toBe('a');
    expect(findParent('a', tasks)).toBe('root');
  });

  it('returns null when task has no parent', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a']),
      a: makeTask('a'),
    };
    expect(findParent('root', tasks)).toBeNull();
  });
});
