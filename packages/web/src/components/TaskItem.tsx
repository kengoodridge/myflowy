import React, { useRef, useState, useEffect } from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { getVisibleOrder, findParent, isAncestorOf, parsePastedText, insertParsedLines } from '@myflowy/core';

type DropPos = 'before' | 'after' | 'inside';

// Module-level state shared across all TaskItem instances (only one touch drag at a time)
interface TouchDragState {
  // Active drag (threshold/delay already met)
  dragId: string | null;
  dragParentId: string | null;
  ghost: HTMLElement | null;
  targetRow: HTMLElement | null;
  dropPos: DropPos | null;
  targetId: string | null;
  targetParentId: string | null;
  offsetX: number;
  offsetY: number;
  // Pending drag (touchstart recorded, waiting for delay before committing)
  pendingId: string | null;
  pendingParentId: string | null;
  startX: number;
  startY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

const activeTouchDrag: TouchDragState = {
  dragId: null,
  dragParentId: null,
  ghost: null,
  targetRow: null,
  dropPos: null,
  targetId: null,
  targetParentId: null,
  offsetX: 0,
  offsetY: 0,
  pendingId: null,
  pendingParentId: null,
  startX: 0,
  startY: 0,
  longPressTimer: null,
};

function clearTouchDragTarget() {
  if (activeTouchDrag.targetRow) {
    activeTouchDrag.targetRow.classList.remove('drop-before', 'drop-after', 'drop-inside');
    activeTouchDrag.targetRow = null;
  }
  activeTouchDrag.dropPos = null;
  activeTouchDrag.targetId = null;
  activeTouchDrag.targetParentId = null;
}

function clearTouchDragGhost() {
  if (activeTouchDrag.ghost) {
    activeTouchDrag.ghost.remove();
    activeTouchDrag.ghost = null;
  }
  document.body.classList.remove('touch-dragging');
}

function cancelPendingTouchDrag() {
  if (activeTouchDrag.longPressTimer) {
    clearTimeout(activeTouchDrag.longPressTimer);
    activeTouchDrag.longPressTimer = null;
  }
  activeTouchDrag.pendingId = null;
  activeTouchDrag.pendingParentId = null;
}

type ParsedLine = { level: number; text: string };

function parseHtmlLines(html: string): ParsedLine[] | null {
  const div = document.createElement('div');
  div.innerHTML = html;

  function getDirectText(li: Element): string {
    let text = '';
    for (const node of li.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? '';
      } else {
        const tag = (node as Element).tagName;
        if (tag !== 'UL' && tag !== 'OL') {
          text += (node as Element).textContent ?? '';
        }
      }
    }
    return text;
  }

  function listDepth(li: Element): number {
    let depth = 0;
    let parent = li.parentElement;
    while (parent && parent !== div) {
      if (parent.tagName === 'UL' || parent.tagName === 'OL') depth++;
      parent = parent.parentElement;
    }
    return depth;
  }

  const items: ParsedLine[] = [];

  // Workflowy copies the root item as a plain element (e.g. <span class="name">)
  // BEFORE the <ul> that holds its children. Detect this and add it at level 0.
  const firstList = div.querySelector('ul, ol');
  let hasRoot = false;
  if (firstList) {
    let prev = firstList.previousElementSibling;
    while (prev) {
      const tag = prev.tagName;
      if (tag !== 'META' && tag !== 'STYLE' && tag !== 'SCRIPT') {
        const text = prev.textContent?.trim();
        if (text) {
          items.push({ level: 0, text });
          hasRoot = true;
          break;
        }
      }
      prev = prev.previousElementSibling;
    }
  }

  for (const li of div.querySelectorAll('li')) {
    const text = getDirectText(li).trim();
    if (text) items.push({ level: listDepth(li), text });
  }

  if (items.length === 0) return null;

  // When there's a root item, children already sit at depth >= 1 — keep that.
  // When there's no root, normalize so the shallowest item lands at level 0.
  if (!hasRoot) {
    const minLevel = Math.min(...items.map(i => i.level));
    if (minLevel > 0) return items.map(i => ({ ...i, level: i.level - minLevel }));
  }

  return items;
}

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
  const rowRef = useRef<HTMLDivElement>(null);
  const savedCursorPos = useRef<number | null>(null);
  const [dropPos, setDropPos] = useState<DropPos | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to current tasks so touch handlers always see up-to-date data
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

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

  // Non-passive touchmove handler so we can call preventDefault to suppress scrolling during drag.
  // Also handles the drag-initiation threshold: if the user moves before the long-press timer fires,
  // the pending drag is cancelled so native scrolling is uninterrupted.
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const MOVE_CANCEL_THRESHOLD = 8; // px — cancel pending drag if finger moves this far first

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];

      // Pending phase: long-press timer hasn't fired yet; cancel drag if user moved too far
      if (activeTouchDrag.pendingId === id && activeTouchDrag.dragId !== id) {
        const dx = touch.clientX - activeTouchDrag.startX;
        const dy = touch.clientY - activeTouchDrag.startY;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_CANCEL_THRESHOLD) {
          cancelPendingTouchDrag();
        }
        return; // don't preventDefault — let the browser scroll
      }

      // Active drag phase
      if (activeTouchDrag.dragId !== id) return;
      e.preventDefault();

      if (activeTouchDrag.ghost) {
        activeTouchDrag.ghost.style.left = `${touch.clientX - activeTouchDrag.offsetX}px`;
        activeTouchDrag.ghost.style.top = `${touch.clientY - activeTouchDrag.offsetY}px`;
      }

      // Temporarily hide the ghost so elementFromPoint finds the element below
      if (activeTouchDrag.ghost) activeTouchDrag.ghost.style.visibility = 'hidden';
      const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      if (activeTouchDrag.ghost) activeTouchDrag.ghost.style.visibility = '';

      const targetRow = elemBelow?.closest('.task-row') as HTMLElement | null;

      clearTouchDragTarget();

      if (targetRow) {
        const targetTaskId = targetRow.dataset.taskId;
        if (!targetTaskId || targetTaskId === activeTouchDrag.dragId) return;

        const rowRect = targetRow.getBoundingClientRect();
        const y = touch.clientY - rowRect.top;
        const pct = y / rowRect.height;
        const hasTargetChildren = targetRow.dataset.hasChildren === 'true';

        let pos: DropPos;
        if (!hasTargetChildren) {
          pos = pct < 0.5 ? 'before' : 'after';
        } else {
          pos = pct < 0.25 ? 'before' : pct > 0.75 ? 'after' : 'inside';
        }

        targetRow.classList.add(`drop-${pos}`);
        activeTouchDrag.targetRow = targetRow;
        activeTouchDrag.dropPos = pos;
        activeTouchDrag.targetId = targetTaskId;
        activeTouchDrag.targetParentId = targetRow.dataset.parentId ?? null;
      }
    };

    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener('touchmove', onTouchMove, opts);
    return () => {
      el.removeEventListener('touchmove', onTouchMove, opts);
      // Clean up if this component unmounts during an active drag
      if (activeTouchDrag.dragId === id || activeTouchDrag.pendingId === id) {
        clearTouchDragGhost();
        clearTouchDragTarget();
        cancelPendingTouchDrag();
        activeTouchDrag.dragId = null;
        activeTouchDrag.dragParentId = null;
      }
    };
  }, [id]);

  if (!task) return null;

  const hasChildren = task.children.length > 0;

  const clearExpandTimer = () => {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
  };

  const beginTouchDrag = (clientX: number, clientY: number, rowEl: HTMLDivElement) => {
    cancelPendingTouchDrag();
    clearTouchDragGhost();
    clearTouchDragTarget();

    const rect = rowEl.getBoundingClientRect();
    activeTouchDrag.dragId = id;
    activeTouchDrag.dragParentId = parentId;
    activeTouchDrag.offsetX = clientX - rect.left;
    activeTouchDrag.offsetY = clientY - rect.top;

    const ghost = rowEl.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.opacity = '0.7';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.background = 'var(--task-ghost-bg, #fff)';
    ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    ghost.style.borderRadius = '4px';
    document.body.appendChild(ghost);
    document.body.classList.add('touch-dragging');
    activeTouchDrag.ghost = ghost;
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging when the user starts from the contentEditable text area
    if ((e.target as HTMLElement).isContentEditable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('taskId', id);
    e.dataTransfer.setData('taskParentId', parentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't initiate drag from interactive elements
    if (target.isContentEditable || target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
      return;
    }

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();

    // Record pending drag; the actual drag starts after a short delay (long-press).
    // This lets the user scroll without accidentally triggering a drag.
    activeTouchDrag.pendingId = id;
    activeTouchDrag.pendingParentId = parentId;
    activeTouchDrag.startX = touch.clientX;
    activeTouchDrag.startY = touch.clientY;
    activeTouchDrag.offsetX = touch.clientX - rect.left;
    activeTouchDrag.offsetY = touch.clientY - rect.top;

    const rowEl = e.currentTarget;
    activeTouchDrag.longPressTimer = setTimeout(() => {
      if (activeTouchDrag.pendingId !== id) return;
      activeTouchDrag.longPressTimer = null;
      activeTouchDrag.dragId = id;
      activeTouchDrag.dragParentId = activeTouchDrag.pendingParentId;
      activeTouchDrag.pendingId = null;
      activeTouchDrag.pendingParentId = null;

      // Create a floating ghost copy of the row for visual feedback
      beginTouchDrag(touch.clientX, touch.clientY, rowEl);
    }, 250);
  };

  const handleTouchHandleStart = (e: React.TouchEvent<HTMLSpanElement>) => {
    if (!rowRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    e.stopPropagation();
    beginTouchDrag(touch.clientX, touch.clientY, rowRef.current);
  };

  const handleTouchEnd = () => {
    cancelPendingTouchDrag();

    const { dragId, dragParentId, dropPos: touchDropPos, targetId, targetParentId } = activeTouchDrag;

    clearTouchDragGhost();
    clearTouchDragTarget();
    activeTouchDrag.dragId = null;
    activeTouchDrag.dragParentId = null;

    if (dragId && targetId && touchDropPos && dragParentId && targetParentId) {
      if (!isAncestorOf(dragId, targetId, tasksRef.current)) {
        store.moveTask(dragId, dragParentId, targetId, targetParentId, touchDropPos);
      }
    }
  };

  const handleTouchCancel = () => {
    cancelPendingTouchDrag();
    clearTouchDragGhost();
    clearTouchDragTarget();
    activeTouchDrag.dragId = null;
    activeTouchDrag.dragParentId = null;
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
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    const htmlLines = html ? parseHtmlLines(html) : null;
    const lines = htmlLines ?? parsePastedText(plain);
    console.debug('[paste] types:', [...e.clipboardData.types]);
    console.debug('[paste] html:', html);
    console.debug('[paste] plain:', plain);
    console.debug('[paste] parsed lines:', lines);
    if (lines.length <= 1) return;
    e.preventDefault();
    store.beginBatch();
    const afterId = id;
    let startLines = lines;
    let consumedParentId: string | undefined;
    if (task.text === '' && lines[0].level === 0) {
      store.updateTask({ ...task, text: lines[0].text });
      if (divRef.current) divRef.current.textContent = lines[0].text;
      startLines = lines.slice(1);
      consumedParentId = id;
    }
    if (startLines.length > 0) {
      const lastId = insertParsedLines(startLines, store, afterId, parentId, consumedParentId);
      onFocusRequest(lastId);
    }
    store.endBatch();
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    store.updateTask({ ...task, text: e.currentTarget.textContent ?? '' });
  };

  return (
    <div className="task-item">
      <div
        ref={rowRef}
        className={`task-row${dropPos ? ` drop-${dropPos}` : ''}${selectedIds?.has(id) ? ' task-row--selected' : ''}`}
        draggable
        data-task-id={id}
        data-parent-id={parentId}
        data-has-children={hasChildren ? 'true' : 'false'}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={(e) => onRowEnter?.(id, e.buttons === 1)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <span
          className="task-drag-handle"
          title="Drag to reorder"
          onTouchStart={handleTouchHandleStart}
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
          onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
