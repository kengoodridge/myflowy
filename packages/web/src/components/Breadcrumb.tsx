import React from 'react';
import type { TaskMap } from '@myflowy/core';
import { findParent } from '@myflowy/core';

function buildCrumbs(id: string, tasks: TaskMap): Array<{ id: string; text: string }> {
  const crumbs: Array<{ id: string; text: string }> = [];
  let current: string | null = id;
  while (current && current !== 'root') {
    const task = tasks[current];
    crumbs.unshift({ id: current, text: task?.text || '(empty)' });
    current = findParent(current, tasks);
  }
  crumbs.unshift({ id: 'root', text: 'Home' });
  return crumbs;
}

export interface BreadcrumbProps {
  rootId: string;
  tasks: TaskMap;
  onNavigate: (id: string) => void;
}

export function Breadcrumb({ rootId, tasks, onNavigate }: BreadcrumbProps) {
  if (rootId === 'root') return null;
  const crumbs = buildCrumbs(rootId, tasks);

  return (
    <nav className="breadcrumb">
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.id}>
          {i > 0 && <span className="breadcrumb-sep"> › </span>}
          {i < crumbs.length - 1 ? (
            <button className="breadcrumb-link" onClick={() => onNavigate(crumb.id)}>
              {crumb.text}
            </button>
          ) : (
            <span className="breadcrumb-current">{crumb.text}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
