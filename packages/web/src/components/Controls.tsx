import React from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { findParent } from '@myflowy/core';

export interface ControlsProps {
  tasks: TaskMap;
  store: TaskStore;
  focusId: string | null;
  onFocusRequest: (id: string | null) => void;
}

export function Controls({ tasks, store, focusId, onFocusRequest }: ControlsProps) {
  const parentId = focusId ? findParent(focusId, tasks) : null;
  const grandparentId = parentId ? findParent(parentId, tasks) : null;

  const keepFocus = () => onFocusRequest(focusId);

  return (
    <div className="controls">
      <button
        disabled={!focusId || !parentId}
        onClick={() => {
          if (focusId && parentId) {
            store.indentTask(focusId, parentId);
            keepFocus();
          }
        }}
      >
        →
      </button>
      <button
        disabled={!focusId || !parentId || !grandparentId}
        onClick={() => {
          if (focusId && parentId && grandparentId) {
            store.outdentTask(focusId, parentId, grandparentId);
            keepFocus();
          }
        }}
      >
        ←
      </button>
      <button
        disabled={!focusId || !parentId}
        onClick={() => {
          if (focusId && parentId) {
            store.moveTaskUp(focusId, parentId);
            keepFocus();
          }
        }}
      >
        ↑
      </button>
      <button
        disabled={!focusId || !parentId}
        onClick={() => {
          if (focusId && parentId) {
            store.moveTaskDown(focusId, parentId);
            keepFocus();
          }
        }}
      >
        ↓
      </button>
    </div>
  );
}
