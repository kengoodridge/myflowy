import React, { useRef, useState } from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { getVisibleOrder, findParent, isAncestorOf, parsePastedText, insertParsedLines } from '@myflowy/core';
import { useEffect } from 'react';

type DropPos = 'before' | 'after' | 'inside';

function getCursorPosition(el: HTMLElement): number {
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (container === el || container.parentNode === el) {
      return range.endOffset;
    }
  }
  return 0;
}

function setCursorPosition(el: HTMLElement, pos: number): void {
  const node = el.childNodes[0];
  if (!node) return;
  const safePos = Math.min(pos, node.textContent?.length ?? 0);
  const range = document.createRange();
  range.setStart(node, safePos);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export interface TaskItemProps {
  id: string;
  parentId: string;
  tasks: TaskMap;
  store: TaskStore;
  depth: number;
  focusId: string | null;
  onFocusRequest: (id: string | null) => void;
  rootId?: string;
  onZoom?: (id: string) => void;
  selectedIds?: Set<string>;
  onRowEnter?: (id: string, hasButton: boolean) => void;
}

export function TaskItem({ id, parentId, tasks, store, depth, focusId, onFocusRequest, rootId = 'root', onZoom, selectedIds, onRowEnter }: TaskItemProps) {
  const task = tasks[id];
  const divRef = useRef<HTMLDivElement>(null);
  const savedCursorPos = useRef<number | null>(null);
  const [dropPos, setDropPos] = useState<DropPos | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (divRef.current) divRef.current.textContent = task?.text ?? '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (divRef.current && document.activeElement !== divRef.current) {
      divRef.current.textContent = task?.text ?? '';
    }
  }, [task?.text]);

  useEffect(() => {
    if (focusId === id && divRef.current && document.activeElement !== divRef.current) {
      divRef.current.focus();
      if (savedCursorPos.current !== null) {
        setCursorPosition(divRef.current, savedCursorPos.current);
        savedCursorPos.current = null;
      }
    }
  }, [focusId, id]);

  if (!task) return null;

  const hasChildren = task.children.length > 0;

  const clearExpandTimer = () => {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', id);
    e.dataTransfer.setData('taskParentId', parentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = e.dataTransfer.types.includes('taskid') ? '' : '';
    // Use element position to determine drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = y / rect.height;

    let pos: DropPos;
    if (!hasChildren) {
      pos = pct < 0.5 ? 'before' : 'after';
    } else {
      pos = pct < 0.25 ? 'before' : pct > 0.75 ? 'after' : 'inside';
    }
    setDropPos(pos);

    if (pos === 'inside' && task.collapsed) {
      if (!expandTimer.current) {
        expandTimer.current = setTimeout(() => {
          store.updateTask({ ...task, collapsed: false });
          expandTimer.current = null;
        }, 600);
      }
    } else {
      clearExpandTimer();
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropPos(null);
      clearExpandTimer();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    clearExpandTimer();
    const dragId = e.dataTransfer.getData('taskId');
    const dragParentId = e.dataTransfer.getData('taskParentId');
    setDropPos(null);

    if (!dropPos || !dragId || dragId === id) return;
    if (isAncestorOf(dragId, id, tasks)) return;

    store.moveTask(dragId, dragParentId, id, parentId, dropPos);
  };

  const handleToggleCollapse = () => {
    store.updateTask({ ...task, collapsed: !task.collapsed });
  };

  const handleToggleChecked = () => {
    store.updateTask({ ...task, checked: !task.checked });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      store.updateTask({ ...task, checked: !task.checked });
      return;
    }

    if (e.ctrlKey && e.key === 'Backspace') {
      e.preventDefault();
      if (task.children.length > 0 && !window.confirm(`Delete "${task.text || '(empty)'}" and all its children?`)) return;
      const order = getVisibleOrder(rootId, tasks);
      const idx = order.indexOf(id);
      const prevId = idx > 0 ? order[idx - 1] : null;
      store.removeTaskDeep(id, parentId);
      onFocusRequest(prevId);
      return;
    }

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
          const order = getVisibleOrder(rootId, tasks);
          const idx = order.indexOf(id);
          const prevId = idx > 0 ? order[idx - 1] : null;
          store.removeTask(id, parentId);
          onFocusRequest(prevId);
        }
        break;
      }
      case 'Tab': {
        e.preventDefault();
        savedCursorPos.current = divRef.current ? getCursorPosition(divRef.current) : 0;
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
          const order = getVisibleOrder(rootId, tasks);
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
          const order = getVisibleOrder(rootId, tasks);
          const idx = order.indexOf(id);
          if (idx < order.length - 1) onFocusRequest(order[idx + 1]);
        }
        break;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    const lines = parsePastedText(text);
    if (lines.length <= 1) return;
    e.preventDefault();
    let afterId = id;
    let startLines = lines;
    if (task.text === '' && lines[0].level === 0) {
      store.updateTask({ ...task, text: lines[0].text });
      if (divRef.current) divRef.current.textContent = lines[0].text;
      startLines = lines.slice(1);
    }
    if (startLines.length > 0) {
      const lastId = insertParsedLines(startLines, store, afterId, parentId);
      onFocusRequest(lastId);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    store.updateTask({ ...task, text: e.currentTarget.textContent ?? '' });
  };

  return (
    <div className="task-item">
      <div
        className={`task-row${dropPos ? ` drop-${dropPos}` : ''}${selectedIds?.has(id) ? ' task-row--selected' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={(e) => onRowEnter?.(id, e.buttons === 1)}
      >
        <span
          className="task-drag-handle"
          draggable
          onDragStart={handleDragStart}
          title="Drag to reorder"
        >
          ⠿
        </span>
        <button
          className={`task-toggle${hasChildren ? '' : ' task-toggle--hidden'}`}
          onClick={handleToggleCollapse}
          tabIndex={-1}
          aria-label={task.collapsed ? 'expand' : 'collapse'}
        >
          {hasChildren ? (task.collapsed ? '▶' : '▼') : ''}
        </button>
        <button
          className="task-bullet"
          onClick={() => onZoom?.(id)}
          tabIndex={-1}
          title="Zoom in"
        >
          •
        </button>
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.checked}
          onChange={handleToggleChecked}
          tabIndex={-1}
        />
        <div
          ref={divRef}
          className={`task-text${task.text === '' ? ' task-text--empty' : ''}${task.checked ? ' task-text--checked' : ''}`}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          data-placeholder="task here…"
          data-testid={`task-${id}`}
        />
        <button
          className={`task-pin${task.pinned ? ' task-pin--active' : ''}`}
          onClick={() => store.updateTask({ ...task, pinned: !task.pinned })}
          tabIndex={-1}
          title={task.pinned ? 'Unpin' : 'Pin'}
        >
          ★
        </button>
        <button
          className="task-delete"
          onClick={() => {
            if (task.children.length > 0 && !window.confirm(`Delete "${task.text || '(empty)'}" and all its children?`)) return;
            const order = getVisibleOrder(rootId, tasks);
            const idx = order.indexOf(id);
            const prevId = idx > 0 ? order[idx - 1] : null;
            store.removeTaskDeep(id, parentId);
            onFocusRequest(prevId);
          }}
          tabIndex={-1}
          title="Delete (Ctrl+Backspace)"
        >
          ×
        </button>
      </div>
      {!task.collapsed && hasChildren && (
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
              rootId={rootId}
              onZoom={onZoom}
              selectedIds={selectedIds}
              onRowEnter={onRowEnter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
