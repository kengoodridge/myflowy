import type { Task, TaskMap } from '@myflowy/core';
import { uuid, AuthError } from '@myflowy/core';
import type { SyncEngine } from '@myflowy/core';

export class TaskStore extends EventTarget {
  private engine: SyncEngine;
  private tasks: TaskMap = {};
  private undoStack: TaskMap[] = [];
  private batching = false;
  private readonly MAX_UNDO = 100;

  constructor(engine: SyncEngine) {
    super();
    this.engine = engine;
    engine.setAuthErrorHandler(() => this.dispatchEvent(new Event('auth-error')));
    engine.setSyncCompleteHandler((err) => {
      const detail = err ? { ok: false, message: err.message } : { ok: true, message: '' };
      this.dispatchEvent(new CustomEvent('sync-complete', { detail }));
    });
  }

  async initialize(): Promise<void> {
    this.tasks = await this.engine.initialize();
    this.emit();
  }

  async syncFromDrive(): Promise<void> {
    try {
      const remote = await this.engine.syncFromDrive();
      if (remote) {
        this.tasks = remote;
        this.emit();
      }
    } catch (err) {
      if (err instanceof AuthError) {
        this.dispatchEvent(new Event('auth-error'));
      } else {
        throw err;
      }
    }
  }

  async sync(): Promise<void> {
    try {
      const remote = await this.engine.syncFromDrive();
      if (remote) {
        this.tasks = remote;
        this.emit();
      }
      await this.engine.flushToDrive();
    } catch (err) {
      if (err instanceof AuthError) {
        this.dispatchEvent(new Event('auth-error'));
      } else {
        throw err;
      }
    }
  }

  getTasks(): TaskMap {
    return this.tasks;
  }

  // --- undo ---

  private pushUndo(): void {
    if (this.batching) return;
    this.undoStack.push(this.tasks);
    if (this.undoStack.length > this.MAX_UNDO) this.undoStack.shift();
  }

  beginBatch(): void {
    if (this.batching) return;
    this.undoStack.push(this.tasks);
    if (this.undoStack.length > this.MAX_UNDO) this.undoStack.shift();
    this.batching = true;
  }

  endBatch(): void {
    this.batching = false;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    const before = this.tasks;
    this.tasks = prev;
    this.emit();
    for (const id of Object.keys(before)) {
      if (!prev[id]) this.engine.removeTask(id).catch(console.error);
    }
    for (const [id, task] of Object.entries(prev)) {
      if (!before[id] || before[id] !== task) {
        this.engine.setTask(task).catch(console.error);
      }
    }
  }

  // --- mutations ---

  updateTask(task: Task): void {
    this.tasks = { ...this.tasks, [task.id]: task };
    this.emit();
    this.engine.setTask(task).catch(console.error);
  }

  addTask(parentId: string, afterId: string | null): string {
    this.pushUndo();
    const id = uuid();
    const newTask: Task = {
      id,
      text: '',
      checked: false,
      pinned: false,
      collapsed: false,
      children: [],
    };
    const parent = this.tasks[parentId];
    const children = [...parent.children];
    if (afterId === null) {
      children.push(id);
    } else {
      const afterIndex = children.indexOf(afterId);
      children.splice(afterIndex + 1, 0, id);
    }
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [id]: newTask, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(newTask).catch(console.error);
    this.engine.setTask(updatedParent).catch(console.error);
    return id;
  }

  removeTask(id: string, parentId: string): void {
    this.pushUndo();
    const parent = this.tasks[parentId];
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const { [id]: _removed, ...rest } = this.tasks;
    this.tasks = { ...rest, [parentId]: updatedParent };
    this.emit();
    this.engine.removeTask(id).catch(console.error);
    this.engine.setTask(updatedParent).catch(console.error);
  }

  moveTask(
    dragId: string,
    dragParentId: string,
    targetId: string,
    targetParentId: string,
    position: 'before' | 'after' | 'inside',
  ): void {
    this.pushUndo();
    const oldParent = this.tasks[dragParentId];
    const updatedOldParent = { ...oldParent, children: oldParent.children.filter((c) => c !== dragId) };
    let tasks = { ...this.tasks, [dragParentId]: updatedOldParent };

    if (position === 'inside') {
      const target = tasks[targetId];
      const updatedTarget = { ...target, children: [...target.children, dragId], collapsed: false };
      tasks = { ...tasks, [targetId]: updatedTarget };
      this.engine.setTask(updatedTarget).catch(console.error);
    } else {
      const targetParent = tasks[targetParentId];
      const children = [...targetParent.children];
      const targetIdx = children.indexOf(targetId);
      children.splice(position === 'before' ? targetIdx : targetIdx + 1, 0, dragId);
      const updatedTargetParent = { ...targetParent, children };
      tasks = { ...tasks, [targetParentId]: updatedTargetParent };
      this.engine.setTask(updatedTargetParent).catch(console.error);
    }

    this.tasks = tasks;
    this.emit();
    this.engine.setTask(updatedOldParent).catch(console.error);
  }

  removeTaskDeep(id: string, parentId: string): void {
    this.pushUndo();
    const descendants = this.collectDescendants(id);
    const parent = this.tasks[parentId];
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    let newTasks: typeof this.tasks = { ...this.tasks, [parentId]: updatedParent };
    for (const descId of descendants) {
      const { [descId]: _, ...rest } = newTasks;
      newTasks = rest;
    }
    this.tasks = newTasks;
    this.emit();
    for (const descId of descendants) {
      this.engine.removeTask(descId).catch(console.error);
    }
    this.engine.setTask(updatedParent).catch(console.error);
  }

  private collectDescendants(id: string): string[] {
    const result: string[] = [id];
    const task = this.tasks[id];
    if (task) {
      for (const childId of task.children) {
        result.push(...this.collectDescendants(childId));
      }
    }
    return result;
  }

  indentTask(id: string, parentId: string): void {
    this.pushUndo();
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === 0) return;
    const newParentId = parent.children[idx - 1];
    const newParent = this.tasks[newParentId];
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const updatedNewParent = { ...newParent, children: [...newParent.children, id] };
    this.tasks = { ...this.tasks, [parentId]: updatedParent, [newParentId]: updatedNewParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
    this.engine.setTask(updatedNewParent).catch(console.error);
  }

  outdentTask(id: string, parentId: string, grandparentId: string): void {
    this.pushUndo();
    const parent = this.tasks[parentId];
    const grandparent = this.tasks[grandparentId];
    const parentIdx = grandparent.children.indexOf(parentId);
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const gpChildren = [...grandparent.children];
    gpChildren.splice(parentIdx + 1, 0, id);
    const updatedGrandparent = { ...grandparent, children: gpChildren };
    this.tasks = { ...this.tasks, [parentId]: updatedParent, [grandparentId]: updatedGrandparent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
    this.engine.setTask(updatedGrandparent).catch(console.error);
  }

  moveTaskUp(id: string, parentId: string): void {
    this.pushUndo();
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === 0) return;
    const children = [...parent.children];
    [children[idx - 1], children[idx]] = [children[idx], children[idx - 1]];
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
  }

  moveTaskDown(id: string, parentId: string): void {
    this.pushUndo();
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === parent.children.length - 1) return;
    const children = [...parent.children];
    [children[idx], children[idx + 1]] = [children[idx + 1], children[idx]];
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
  }

  private emit(): void {
    this.dispatchEvent(new Event('change'));
  }
}
