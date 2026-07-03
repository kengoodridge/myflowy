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
});
