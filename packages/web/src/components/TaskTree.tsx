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

  return (
    <div className="task-tree">
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
