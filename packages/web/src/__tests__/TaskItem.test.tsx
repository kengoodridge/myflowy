import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from '../components/TaskItem';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

function makeTask(id: string, text = '', children: string[] = []) {
  return { id, text, checked: false, pinned: false, collapsed: false, children, updatedAt: '2026-01-01T00:00:00.000Z' };
}

function makeMap(defs: Record<string, { text?: string; children?: string[] }>): TaskMap {
  const m: TaskMap = {};
  for (const [id, { text = id, children = [] }] of Object.entries(defs)) {
    m[id] = makeTask(id, text, children);
  }
  return m;
}

function makeStore(overrides: Partial<TaskStore> = {}): TaskStore {
  return {
    addTask: vi.fn().mockReturnValue('new-id'),
    removeTask: vi.fn(),
    updateTask: vi.fn(),
    indentTask: vi.fn(),
    outdentTask: vi.fn(),
    moveTaskUp: vi.fn(),
    moveTaskDown: vi.fn(),
    getTasks: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    initialize: vi.fn(),
    syncFromDrive: vi.fn(),
    ...overrides,
  } as unknown as TaskStore;
}

function renderItem(
  tasks: TaskMap,
  id: string,
  parentId: string,
  opts: {
    focusId?: string | null;
    onFocusRequest?: (id: string | null) => void;
    store?: TaskStore;
  } = {}
) {
  const store = opts.store ?? makeStore();
  const onFocusRequest = opts.onFocusRequest ?? vi.fn();
  render(
    <TaskItem
      id={id}
      parentId={parentId}
      tasks={tasks}
      store={store}
      depth={0}
      focusId={opts.focusId ?? null}
      onFocusRequest={onFocusRequest}
    />
  );
  return { store, onFocusRequest };
}

describe('TaskItem', () => {
  it('renders task text', () => {
    const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'Hello' } });
    renderItem(tasks, 'a', 'root');
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders children recursively', () => {
    const tasks = makeMap({
      root: { children: ['a'] },
      a: { text: 'Parent', children: ['b'] },
      b: { text: 'Child' },
    });
    renderItem(tasks, 'a', 'root');
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  describe('keyboard: Enter', () => {
    it('calls store.addTask with parentId and current id', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'Hello' } });
      const { store } = renderItem(tasks, 'a', 'root');
      const editable = document.querySelector('[contenteditable]')!;
      fireEvent.keyDown(editable, { key: 'Enter' });
      expect(store.addTask).toHaveBeenCalledWith('root', 'a');
    });

    it('calls onFocusRequest with the new task id', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'Hello' } });
      const onFocusRequest = vi.fn();
      const store = makeStore({ addTask: vi.fn().mockReturnValue('new-id') });
      renderItem(tasks, 'a', 'root', { store, onFocusRequest });
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Enter' });
      expect(onFocusRequest).toHaveBeenCalledWith('new-id');
    });
  });

  describe('keyboard: Backspace on empty', () => {
    it('calls store.removeTask when task is empty with no children', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: '' } });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Backspace' });
      expect(store.removeTask).toHaveBeenCalledWith('a', 'root');
    });

    it('does not call store.removeTask when task has text', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'has text' } });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Backspace' });
      expect(store.removeTask).not.toHaveBeenCalled();
    });

    it('does not call store.removeTask when task has children', () => {
      const tasks = makeMap({
        root: { children: ['a'] },
        a: { text: '', children: ['b'] },
        b: { text: 'child' },
      });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Backspace' });
      expect(store.removeTask).not.toHaveBeenCalled();
    });
  });

  describe('keyboard: Tab', () => {
    it('calls store.indentTask with id and parentId', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const { store } = renderItem(tasks, 'b', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Tab', shiftKey: false });
      expect(store.indentTask).toHaveBeenCalledWith('b', 'root');
    });
  });

  describe('keyboard: Shift+Tab', () => {
    it('calls store.outdentTask when grandparent exists', () => {
      const tasks = makeMap({
        root: { children: ['a'] },
        a: { children: ['b'] },
        b: {},
      });
      const { store } = renderItem(tasks, 'b', 'a');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Tab', shiftKey: true });
      expect(store.outdentTask).toHaveBeenCalledWith('b', 'a', 'root');
    });

    it('does not call store.outdentTask when already at root level', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: {} });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Tab', shiftKey: true });
      expect(store.outdentTask).not.toHaveBeenCalled();
    });
  });

  describe('keyboard: Ctrl+ArrowUp / Ctrl+ArrowDown', () => {
    it('calls store.moveTaskUp on Ctrl+ArrowUp', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const { store } = renderItem(tasks, 'b', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowUp', ctrlKey: true });
      expect(store.moveTaskUp).toHaveBeenCalledWith('b', 'root');
    });

    it('calls store.moveTaskDown on Ctrl+ArrowDown', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowDown', ctrlKey: true });
      expect(store.moveTaskDown).toHaveBeenCalledWith('a', 'root');
    });
  });

  describe('keyboard: ArrowUp / ArrowDown navigation', () => {
    it('calls onFocusRequest with previous task on ArrowUp', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const onFocusRequest = vi.fn();
      renderItem(tasks, 'b', 'root', { onFocusRequest });
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowUp', ctrlKey: false });
      expect(onFocusRequest).toHaveBeenCalledWith('a');
    });

    it('calls onFocusRequest with next task on ArrowDown', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const onFocusRequest = vi.fn();
      renderItem(tasks, 'a', 'root', { onFocusRequest });
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowDown', ctrlKey: false });
      expect(onFocusRequest).toHaveBeenCalledWith('b');
    });
  });

  describe('drag and drop', () => {
    it('calls store.moveTask with inside when dragged onto the middle of a childless task', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const store = makeStore({ moveTask: vi.fn() });
      renderItem(tasks, 'b', 'root', { store });

      const row = document.querySelector('[data-task-id="b"]') as HTMLElement;

      // Simulate dragging 'a' over the middle of 'b' (pct ~0.5 → inside)
      Object.defineProperty(row, 'getBoundingClientRect', {
        value: () => ({ top: 0, height: 40, left: 0, width: 200, bottom: 40, right: 200 }),
        configurable: true,
      });

      fireEvent.dragOver(row, { clientY: 20 }); // 20/40 = 50% → inside
      fireEvent.drop(row, {
        dataTransfer: {
          getData: (key: string) => (key === 'taskId' ? 'a' : 'root'),
        },
      });

      expect(store.moveTask).toHaveBeenCalledWith('a', 'root', 'b', 'root', 'inside');
    });
  });
});
