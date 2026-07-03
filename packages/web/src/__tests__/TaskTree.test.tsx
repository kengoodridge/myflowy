import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskTree } from '../components/TaskTree';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

function makeMap(defs: Record<string, { text?: string; children?: string[] }>): TaskMap {
  const m: TaskMap = {};
  for (const [id, { text = id, children = [] }] of Object.entries(defs)) {
    m[id] = { id, text, checked: false, pinned: false, collapsed: false, children };
  }
  return m;
}

function makeStore(): TaskStore {
  return {
    addTask: vi.fn().mockReturnValue('new-id'),
    removeTask: vi.fn(),
    moveTask: vi.fn(),
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
  } as unknown as TaskStore;
}

describe('TaskTree', () => {
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    width: 100,
    height: 100,
    toJSON: () => ({}),
  } as DOMRect;

  it('renders each top-level task', () => {
    const tasks = makeMap({
      root: { children: ['a', 'b'] },
      a: { text: 'Alpha' },
      b: { text: 'Beta' },
    });
    render(
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={makeStore()}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders nested children via TaskItem', () => {
    const tasks = makeMap({
      root: { children: ['a'] },
      a: { text: 'Parent', children: ['b'] },
      b: { text: 'Child' },
    });
    render(
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={makeStore()}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('renders nothing when root is missing', () => {
    const { container } = render(
      <TaskTree
        rootId="root"
        tasks={{}}
        store={makeStore()}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a first-subtask action for empty roots', () => {
    const tasks = makeMap({
      root: { text: 'Parent', children: [] },
    });

    render(
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={makeStore()}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Add first subtask' })).toBeInTheDocument();
  });

  it('adds and focuses the first subtask when the empty action is pressed', () => {
    const tasks = makeMap({
      root: { text: 'Parent', children: [] },
    });
    const store = makeStore();
    const onFocusRequest = vi.fn();

    render(
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={store}
        focusId={null}
        onFocusRequest={onFocusRequest}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add first subtask' }));

    expect(store.addTask).toHaveBeenCalledWith('root', null);
    expect(onFocusRequest).toHaveBeenCalledWith('new-id');
  });

  it('moves a task inside another task via touch drag on the handle', () => {
    const tasks = makeMap({
      root: { children: ['a', 'b'] },
      a: { text: 'Alpha' },
      b: { text: 'Beta', children: ['c'] },
      c: { text: 'Child' },
    });
    const store = makeStore();

    const elementFromPoint = vi.fn();
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    });
    const getBoundingClientRectMock = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect);

    render(
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={store}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );

    const [sourceHandle] = screen.getAllByTitle('Drag to reorder');
    const rows = document.querySelectorAll('.task-row');
    const sourceRow = rows[0] as HTMLElement;
    const targetRow = rows[1] as HTMLElement;
    elementFromPoint.mockReturnValue(targetRow);

    fireEvent.touchStart(sourceHandle, { touches: [{ clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(sourceRow, { touches: [{ clientX: 50, clientY: 50 }] });
    fireEvent.touchEnd(sourceRow);

    expect(store.moveTask).toHaveBeenCalledWith('a', 'root', 'b', 'root', 'inside');

    getBoundingClientRectMock.mockRestore();
  });
});
