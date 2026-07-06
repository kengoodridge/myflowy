import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Controls } from '../components/Controls';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

function makeMap(defs: Record<string, { children?: string[] }>): TaskMap {
  const m: TaskMap = {};
  for (const [id, { children = [] }] of Object.entries(defs)) {
    m[id] = { id, text: id, checked: false, pinned: false, collapsed: false, children, updatedAt: '2026-01-01T00:00:00.000Z' };
  }
  return m;
}

function makeStore(): TaskStore {
  return {
    indentTask: vi.fn(),
    outdentTask: vi.fn(),
    moveTaskUp: vi.fn(),
    moveTaskDown: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(),
    updateTask: vi.fn(),
    getTasks: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    initialize: vi.fn(),
    syncFromDrive: vi.fn(),
  } as unknown as TaskStore;
}

describe('Controls', () => {
  it('renders 4 buttons', () => {
    render(
      <Controls tasks={{}} store={makeStore()} focusId={null} onFocusRequest={vi.fn()} />
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('all buttons are disabled when focusId is null', () => {
    render(
      <Controls tasks={{}} store={makeStore()} focusId={null} onFocusRequest={vi.fn()} />
    );
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
  });

  it('indent button calls store.indentTask and keeps focus', () => {
    const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
    const store = makeStore();
    const onFocusRequest = vi.fn();

    render(<Controls tasks={tasks} store={store} focusId="b" onFocusRequest={onFocusRequest} />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(store.indentTask).toHaveBeenCalledWith('b', 'root');
    expect(onFocusRequest).toHaveBeenCalledWith('b');
  });

  it('outdent button calls store.outdentTask and keeps focus', () => {
    const tasks = makeMap({
      root: { children: ['a'] },
      a: { children: ['b'] },
      b: {},
    });
    const store = makeStore();
    const onFocusRequest = vi.fn();

    render(<Controls tasks={tasks} store={store} focusId="b" onFocusRequest={onFocusRequest} />);

    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(store.outdentTask).toHaveBeenCalledWith('b', 'a', 'root');
    expect(onFocusRequest).toHaveBeenCalledWith('b');
  });

  it('move up button calls store.moveTaskUp', () => {
    const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
    const store = makeStore();

    render(<Controls tasks={tasks} store={store} focusId="b" onFocusRequest={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(store.moveTaskUp).toHaveBeenCalledWith('b', 'root');
  });

  it('move down button calls store.moveTaskDown', () => {
    const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
    const store = makeStore();

    render(<Controls tasks={tasks} store={store} focusId="a" onFocusRequest={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button')[3]);
    expect(store.moveTaskDown).toHaveBeenCalledWith('a', 'root');
  });

  it('outdent button is disabled when focused task is at root level (no grandparent)', () => {
    const tasks = makeMap({ root: { children: ['a'] }, a: {} });

    render(<Controls tasks={tasks} store={makeStore()} focusId="a" onFocusRequest={vi.fn()} />);

    expect(screen.getAllByRole('button')[1]).toBeDisabled();
  });
});
