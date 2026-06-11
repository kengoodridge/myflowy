import React from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { findParent } from '@myflowy/core';

function getAncestorPath(id: string, tasks: TaskMap): string[] {
  const path: string[] = [];
  let current: string | null = findParent(id, tasks);
  while (current && current !== 'root') {
    const task = tasks[current];
    if (task) path.unshift(task.text || '(empty)');
    current = findParent(current, tasks);
  }
  return path;
}

export interface PinnedPanelProps {
  tasks: TaskMap;
  store: TaskStore;
  onNavigate: (id: string) => void;
}

export function PinnedPanel({ tasks, store, onNavigate }: PinnedPanelProps) {
  const pinned = Object.values(tasks).filter((t) => t.pinned && t.id !== 'root');
  if (pinned.length === 0) return null;

  return (
    <section className="pinned-panel">
      {pinned.map((task) => {
        const path = getAncestorPath(task.id, tasks);

        return (
          <div key={task.id} className="pin-card">
            <div className="pin-card-header">
              <button
                className="pin-card-text"
                onClick={() => onNavigate(task.id)}
                title="Navigate to task"
              >
                {task.text || '(empty)'}
              </button>
              <button
                className="pin-unpin"
                onClick={() => store.updateTask({ ...task, pinned: false })}
                title="Unpin"
              >
                ★
              </button>
            </div>
            {path.length > 0 && (
              <div className="pin-card-location">
                {path.map((p, i) => (
                  <span key={i} className="pin-location-item">{p}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
