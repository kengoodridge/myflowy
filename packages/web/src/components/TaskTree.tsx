import React from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { TaskItem } from './TaskItem';

export interface TaskTreeProps {
  rootId: string;
  tasks: TaskMap;
  store: TaskStore;
  focusId: string | null;
  onFocusRequest: (id: string | null) => void;
  onZoom?: (id: string) => void;
  selectedIds?: Set<string>;
  onRowEnter?: (id: string, hasButton: boolean) => void;
}

export function TaskTree({ rootId, tasks, store, focusId, onFocusRequest, onZoom, selectedIds, onRowEnter }: TaskTreeProps) {
  const root = tasks[rootId];
  if (!root) return null;
  const isEmpty = root.children.length === 0;

  return (
    <div className="task-tree">
      {isEmpty && (
        <button
          className="task-tree-empty"
          onClick={() => {
            const newId = store.addTask(rootId, null);
            onFocusRequest(newId);
          }}
          type="button"
        >
          Add first subtask
        </button>
      )}
      {root.children.map((childId) => (
        <TaskItem
          key={childId}
          id={childId}
          parentId={rootId}
          tasks={tasks}
          store={store}
          depth={0}
          focusId={focusId}
          onFocusRequest={onFocusRequest}
          rootId={rootId}
          onZoom={onZoom}
          selectedIds={selectedIds}
          onRowEnter={onRowEnter}
        />
      ))}
    </div>
  );
}
