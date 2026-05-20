import React, { useRef, useEffect } from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { getVisibleOrder, findParent } from '../utils/treeUtils';

export interface TaskItemProps {
  id: string;
  parentId: string;
  tasks: TaskMap;
  store: TaskStore;
  depth: number;
  focusId: string | null;
  onFocusRequest: (id: string | null) => void;
}

export function TaskItem({ id, parentId, tasks, store, depth, focusId, onFocusRequest }: TaskItemProps) {
  const task = tasks[id];
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusId === id && divRef.current && document.activeElement !== divRef.current) {
      divRef.current.focus();
    }
  }, [focusId, id]);

  if (!task) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        const newId = store.addTask(parentId, id);
        onFocusRequest(newId);
        break;
      }
      case 'Backspace': {
        if (task.text === '' && task.children.length === 0) {
          e.preventDefault();
          const order = getVisibleOrder('root', tasks);
          const idx = order.indexOf(id);
          const prevId = idx > 0 ? order[idx - 1] : null;
          store.removeTask(id, parentId);
          onFocusRequest(prevId);
        }
        break;
      }
      case 'Tab': {
        e.preventDefault();
        if (e.shiftKey) {
          const grandparentId = findParent(parentId, tasks);
          if (grandparentId) {
            store.outdentTask(id, parentId, grandparentId);
            onFocusRequest(id);
          }
        } else {
          store.indentTask(id, parentId);
          onFocusRequest(id);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (e.ctrlKey) {
          store.moveTaskUp(id, parentId);
          onFocusRequest(id);
        } else {
          const order = getVisibleOrder('root', tasks);
          const idx = order.indexOf(id);
          if (idx > 0) onFocusRequest(order[idx - 1]);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (e.ctrlKey) {
          store.moveTaskDown(id, parentId);
          onFocusRequest(id);
        } else {
          const order = getVisibleOrder('root', tasks);
          const idx = order.indexOf(id);
          if (idx < order.length - 1) onFocusRequest(order[idx + 1]);
        }
        break;
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    store.updateTask({ ...task, text: e.currentTarget.textContent ?? '' });
  };

  return (
    <div className="task-item">
      <div className="task-row">
        <div
          ref={divRef}
          className="task-text"
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          data-testid={`task-${id}`}
        >
          {task.text}
        </div>
      </div>
      {!task.collapsed && task.children.length > 0 && (
        <div className="task-children">
          {task.children.map((childId) => (
            <TaskItem
              key={childId}
              id={childId}
              parentId={id}
              tasks={tasks}
              store={store}
              depth={depth + 1}
              focusId={focusId}
              onFocusRequest={onFocusRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
